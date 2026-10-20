"""Backoffice access: `require_admin` (signed in + email in ADMIN_EMAILS) and the per-user suspension check.

Admin requests see every workspace (tenant.set_system), so admin services must never write user data by accident:
they only read, or act through explicit helpers (suspend, delete).
"""
from fastapi import Depends, HTTPException

from . import tenant
from .auth import require_user
from .config import settings
from .store import store

_flags: dict = {"version": -1, "suspended": set()}


def is_suspended(user_id: str) -> bool:
    v = store.version("admin_user_flags")
    if v != _flags["version"]:  # re-read only after a backoffice change (startup counts as one)
        with tenant.all_workspaces():
            rows = store.execute("SELECT user_id FROM admin_user_flags WHERE suspended")
        _flags.update(version=v, suspended={r["user_id"] for r in rows})
    return user_id in _flags["suspended"]


def is_admin(user: dict) -> bool:
    if not settings.auth_enabled:
        return True  # local single-user mode: you are the owner
    return (user.get("email") or "").lower() in {e.strip().lower() for e in settings.admin_emails if e.strip()}


async def require_admin(user: dict = Depends(require_user)) -> dict:
    if not is_admin(user):
        raise HTTPException(403, "Backoffice access is for administrators only.")
    tenant.set_system()
    return user
