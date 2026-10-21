"""Backoffice runtime switches, read on every request (cached until a backoffice write bumps the table version).

  - system_settings rows: maintenance {on, message}, announcement {on, text, level}, ai {enabled, message},
    limits {user_quota_mb, max_datasets, max_rows_per_dataset, max_upload_mb} (overrides of the .env defaults).
  - admin_user_flags: per-user suspended / ai_blocked / quota_mb / max_datasets.
Enforcement: MaintenanceMiddleware (below), ai._call -> check_ai, services/quota.py -> limit.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ...core import tenant
from ...core.config import settings
from ...core.store import store

DEFAULTS: dict[str, dict] = {
    "maintenance": {"on": False, "message": "Dashtor is being upgraded. Back in a few minutes."},
    "announcement": {"on": False, "text": "", "level": "info"},
    "ai": {"enabled": True, "message": "AI features are paused by the administrator."},
    "limits": {},
}
LIMIT_KEYS = ("user_quota_mb", "max_datasets", "max_rows_per_dataset", "max_upload_mb")
_USER_KEYS = ("quota_mb", "max_datasets", "ai_blocked", "note", "suspended", "reason")
_cache: dict[str, Any] = {"v": None}


def _load() -> dict:
    v = (store.version("system_settings"), store.version("admin_user_flags"))
    if _cache["v"] != v:
        conf = {k: dict(d) for k, d in DEFAULTS.items()}
        for r in store.execute("SELECT id, value FROM system_settings"):
            if r["id"] in conf:
                conf[r["id"]].update(r["value"] if isinstance(r["value"], dict) else json.loads(r["value"] or "{}"))
        flags = {tenant.workspace_for_user(r["user_id"]): r for r in store.execute("SELECT * FROM admin_user_flags")
                 if r["user_id"] not in ("local", "?")}
        _cache.update(v=v, conf=conf, flags=flags)
    return _cache


def get(key: str) -> dict:
    return _load()["conf"][key]


def all_settings() -> dict:
    return {"settings": _load()["conf"], "defaults": {k: getattr(settings, k) for k in LIMIT_KEYS}}


def put(key: str, value: dict, admin_email: str) -> dict:
    if key not in DEFAULTS:
        raise HTTPException(404, f"Unknown setting {key}")
    if key == "limits":  # full replace: an empty field means "back to the .env default"
        merged = {k: int(v) for k, v in value.items() if k in LIMIT_KEYS and v not in (None, "")}
    else:
        merged = {**get(key), **{k: v for k, v in value.items() if k in DEFAULTS[key]}}
    store.execute("DELETE FROM system_settings WHERE id = ?", [key])
    with tenant.all_workspaces():
        store.insert("system_settings", {"id": key, "value": json.dumps(merged), "updated_by": admin_email})
    return merged


def limit(name: str) -> int:
    """The effective limit for the current workspace: per-user override > backoffice default > .env."""
    c = _load()
    user = c["flags"].get(tenant.current()) or {}
    override = user.get("quota_mb" if name == "user_quota_mb" else name)
    return int(override or c["conf"]["limits"].get(name) or getattr(settings, name))


def check_ai() -> None:
    c = _load()
    if not c["conf"]["ai"]["enabled"]:
        raise HTTPException(503, c["conf"]["ai"]["message"])
    if (c["flags"].get(tenant.current()) or {}).get("ai_blocked"):
        raise HTTPException(403, "AI features are turned off for this account. Contact support.")


def notice() -> dict:
    """Public: what every client should show (banner, maintenance screen)."""
    c = _load()["conf"]
    return {"announcement": c["announcement"] if c["announcement"].get("on") and c["announcement"].get("text") else None,
            "maintenance": c["maintenance"] if c["maintenance"].get("on") else None}


def set_flags(user_id: str, patch: dict, admin_email: str) -> dict:
    """Change some of a user's backoffice flags, keeping the rest. Empty value = back to the platform default."""
    rows = store.execute("SELECT * FROM admin_user_flags WHERE user_id = ?", [user_id])
    row = {k: v for k, v in (rows[0] if rows else {"user_id": user_id, "suspended": False}).items() if k != "created_at"}
    for k in _USER_KEYS:
        if k in patch:
            row[k] = None if patch[k] in ("", None) else patch[k]
    row.update(updated_by=admin_email, updated_at=datetime.now(timezone.utc))
    store.execute("DELETE FROM admin_user_flags WHERE user_id = ?", [user_id])
    with tenant.all_workspaces():
        store.insert("admin_user_flags", row)
    return row


_OPEN = ("/api/health", "/api/auth", "/api/admin", "/api/public", "/api/notice")


class MaintenanceMiddleware:
    """While maintenance is on, every /api call except auth/admin/public answers 503 (admins pass straight through).
    The email comes from the unverified token: a forged one only skips this screen, the route's own auth still rejects it."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] == "http" and path.startswith("/api/") and not path.startswith(_OPEN):
            m = get("maintenance")
            if m["on"]:
                from .activity import _claims
                from ...core.admin import is_admin
                if not is_admin({"email": _claims(dict(scope.get("headers") or [])).get("email", "")}):
                    body = json.dumps({"detail": {"code": "maintenance", "message": m["message"]}}).encode()
                    await send({"type": "http.response.start", "status": 503, "headers": [(b"content-type", b"application/json")]})
                    return await send({"type": "http.response.body", "body": body})
        await self.app(scope, receive, send)
