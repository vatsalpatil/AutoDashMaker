"""Public, read-only links to one dashboard.

A share is a random token tied to (workspace, dashboard). Anyone holding the link can view that dashboard and run
ONLY its own saved chart queries — never arbitrary SQL, never other dashboards. Links can expire and be revoked.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from ..core import tenant
from ..core.store import store

MAX_DAYS = 365
PUBLIC_FIELDS = ("id", "name", "description", "pages")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(v: Any) -> datetime | None:
    if not v:
        return None
    d = v if isinstance(v, datetime) else datetime.fromisoformat(str(v))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def create(dashboard_id: str, days: int | None, user_email: str = "") -> dict[str, Any]:
    if not store.get("dashboards", dashboard_id):
        raise LookupError("dashboard not found")
    expires = _now() + timedelta(days=min(max(int(days), 1), MAX_DAYS)) if days else None
    return store.insert("dashboard_shares", {"dashboard_id": dashboard_id, "token": secrets.token_urlsafe(24),
                                             "expires_at": expires, "revoked": False, "views": 0, "created_by": user_email})


def list_for(dashboard_id: str) -> list[dict[str, Any]]:
    return [{**s, "active": is_active(s)} for s in store.list("dashboard_shares", where="dashboard_id = ?", params=[dashboard_id])]


def revoke(share_id: str) -> None:
    store.update("dashboard_shares", share_id, {"revoked": True, "updated_at": _now()})


def is_active(s: dict[str, Any]) -> bool:
    exp = _aware(s.get("expires_at"))
    return not s.get("revoked") and (exp is None or exp > _now())


def resolve(token: str) -> dict[str, Any] | None:
    """The active share for a token (any workspace), or None. Constant-time compare guards against timing probes."""
    if not token or len(token) > 64:
        return None
    with tenant.all_workspaces():
        rows = store.execute("SELECT * FROM dashboard_shares WHERE token = ?", [token])
    s = rows[0] if rows else None
    if not s or not secrets.compare_digest(str(s["token"]), token) or not is_active(s):
        return None
    return s


def record_view(s: dict[str, Any]) -> None:
    with tenant.use(s["workspace_id"]):
        store.update("dashboard_shares", s["id"], {"views": int(s.get("views") or 0) + 1, "last_viewed_at": _now()})
