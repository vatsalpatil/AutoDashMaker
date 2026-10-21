"""Backoffice user control: list every account (Supabase + per-workspace usage), suspend, delete."""
from __future__ import annotations

import time
from pathlib import Path

import httpx
from fastapi import HTTPException

from ...core import tenant
from ...core.config import settings
from ...core.store import store
from ..account import gotrue

_COUNTS = ("datasets", "dashboards", "datasources", "charts", "queries", "alerts")


def _accounts() -> list[dict]:
    """Every sign-in account from Supabase (admin API, service key). Local mode = the one local user."""
    if not settings.auth_enabled:
        return [{"id": "local", "email": "local@localhost", "created_at": None}]
    if not settings.supabase_service_key:  # no admin API: everyone who has used the app (from the activity log)
        return store.execute("SELECT user_id AS id, MAX(email) AS email, MIN(created_at) AS created_at FROM activity_log "
                             "WHERE user_id IS NOT NULL AND user_id <> 'local' GROUP BY 1")
    out = []
    for page in range(1, 51):
        try:
            r = httpx.get(f"{gotrue._base()}/admin/users", params={"page": page, "per_page": 200}, headers=gotrue._admin_headers(), timeout=15)
        except httpx.HTTPError as e:
            raise HTTPException(502, "Could not reach Supabase to list users.") from e
        if r.status_code >= 300:
            raise HTTPException(502, f"Supabase refused the user list ({r.status_code}). Check SUPABASE_SERVICE_KEY.")
        users = r.json().get("users", [])
        out += users
        if len(users) < 200:
            break
    return out


_owners: dict = {"at": 0.0, "map": {}}


def owner_map() -> dict[str, str]:
    """workspace id -> account email (cached 2 min: it costs a Supabase call)."""
    if time.time() - _owners["at"] > 120:
        try:
            _owners.update(at=time.time(), map={_ws(u["id"]): u.get("email") or u["id"] for u in _accounts()})
        except HTTPException:
            pass
    return _owners["map"]


def _ws(user_id: str) -> str:
    return tenant.DEFAULT_WS if user_id == "local" else tenant.workspace_for_user(user_id)


def _dir_bytes(ws: str) -> int:
    total = 0
    for d in {Path(tenant.analytics_path(ws)).parent, tenant.upload_dir(ws)}:
        total += sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
    return total


def _per_workspace(table: str) -> dict[str, int]:
    return {r["w"]: r["n"] for r in store.execute(f"SELECT workspace_id AS w, COUNT(*) AS n FROM {table} GROUP BY 1")}


def _summary(u: dict, counts: dict, last: dict, flags: dict, ai: dict) -> dict:
    ws = _ws(u["id"])
    meta = u.get("app_metadata") or {}
    return {
        "id": u["id"], "email": u.get("email"), "workspace_id": ws, "provider": meta.get("provider"),
        "created_at": u.get("created_at"), "last_sign_in_at": u.get("last_sign_in_at"),
        "email_confirmed": bool(u.get("email_confirmed_at") or u.get("confirmed_at")),
        "banned_until": u.get("banned_until"), **_flag_fields(flags.get(u["id"]) or {}),
        "last_active_at": last.get(u["id"]), "ai_calls_30d": ai.get(ws, 0),
        **{t: counts[t].get(ws, 0) for t in _COUNTS},
    }


def _flag_fields(f: dict) -> dict:
    return {"suspended": bool(f.get("suspended")), "suspend_reason": f.get("reason"), "ai_blocked": bool(f.get("ai_blocked")),
            "quota_mb": f.get("quota_mb"), "max_datasets": f.get("max_datasets"), "note": f.get("note")}


def list_users() -> list[dict]:
    counts = {t: _per_workspace(t) for t in _COUNTS}
    last = {r["user_id"]: r["t"] for r in store.execute("SELECT user_id, MAX(created_at) AS t FROM activity_log GROUP BY 1")}
    flags = {r["user_id"]: r for r in store.execute("SELECT * FROM admin_user_flags")}
    ai = {r["w"]: r["n"] for r in store.execute(
        "SELECT workspace_id AS w, COUNT(*) AS n FROM ai_usage WHERE created_at > now() - INTERVAL 30 DAY GROUP BY 1")}
    return [_summary(u, counts, last, flags, ai) for u in _accounts()]


def get_user(user_id: str) -> dict:
    user = next((u for u in list_users() if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404, "No such user")
    ws = user["workspace_id"]
    user["storage_bytes"] = _dir_bytes(ws)
    user["datasets_list"] = store.execute(
        "SELECT id, name, row_count, created_at, refreshed_at FROM datasets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100", [ws])
    user["dashboards_list"] = store.execute(
        "SELECT id, name, created_at, updated_at FROM dashboards WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100", [ws])
    user["ai_by_model"] = store.execute(
        "SELECT provider, model, COUNT(*) AS calls, SUM(tokens_in) AS tokens_in, SUM(tokens_out) AS tokens_out, "
        "SUM(CASE WHEN ok THEN 0 ELSE 1 END) AS errors FROM ai_usage WHERE workspace_id = ? GROUP BY 1, 2 ORDER BY calls DESC", [ws])
    return user


def set_suspended(user_id: str, suspended: bool, reason: str, admin_email: str) -> dict:
    """Suspend = API refuses the user at once (core/admin.is_suspended) + Supabase ban so they cannot sign in again."""
    if user_id == "local":
        raise HTTPException(400, "The local user cannot be suspended")
    from .controls import set_flags
    set_flags(user_id, {"suspended": suspended, "reason": reason[:300]}, admin_email)
    if settings.supabase_service_key:
        try:
            httpx.put(f"{gotrue._base()}/admin/users/{user_id}", json={"ban_duration": "876000h" if suspended else "none"},
                      headers=gotrue._admin_headers(), timeout=15)
        except httpx.HTTPError:
            pass  # the API-side block above still holds
    return {"id": user_id, "suspended": suspended}


def delete_user(user_id: str) -> dict:
    from ..account.delete import _purge
    if user_id == "local":
        raise HTTPException(400, "The local user cannot be deleted")
    if settings.supabase_service_key:
        gotrue.delete_user(user_id)
    _purge(user_id, tenant.workspace_for_user(user_id))
    store.execute("DELETE FROM admin_user_flags WHERE user_id = ?", [user_id])
    return {"deleted": True}
