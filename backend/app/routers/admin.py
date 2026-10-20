"""Backoffice API (/api/admin): admins only (core/admin.require_admin, ADMIN_EMAILS). Sees every workspace."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..core.admin import require_admin
from ..services.admin import activity, overview, users
from ..services.audit import record

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


class Suspend(BaseModel):
    suspended: bool
    reason: str = ""


@router.get("/me")
def me(admin: dict = Depends(require_admin)):
    return {"email": admin["email"], "admin": True}


@router.get("/overview")
def get_overview():
    return overview.overview()


@router.get("/users")
def list_users():
    return users.list_users()


@router.get("/users/{user_id}")
def get_user(user_id: str):
    return users.get_user(user_id)


@router.post("/users/{user_id}/suspend")
def suspend(user_id: str, body: Suspend, admin: dict = Depends(require_admin)):
    record("admin.suspend" if body.suspended else "admin.unsuspend", entity_type="user", entity_id=user_id, detail=f"by {admin['email']}: {body.reason}")
    return users.set_suspended(user_id, body.suspended, body.reason, admin["email"])


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    record("admin.delete_user", entity_type="user", entity_id=user_id, detail=f"by {admin['email']}")
    return users.delete_user(user_id)


@router.get("/activity")
def list_activity(user_id: str | None = None, q: str | None = None, status: str | None = None, limit: int = 200):
    return activity.query(user_id, q, status, limit)


@router.get("/audit")
def list_audit(limit: int = 300):
    from ..core.store import store
    return store.list("audit_log", order=f"created_at DESC LIMIT {max(1, min(limit, 2000))}")
