"""Backoffice API (/api/admin): admins only (core/admin.require_admin, ADMIN_EMAILS). Sees and controls every workspace.

Every change is written to the audit trail as admin.* with the admin's email. `public_router` serves /api/notice
(announcement + maintenance) to every client, signed in or not.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.admin import require_admin
from ..core.store import store
from ..services.admin import activity, ai_admin, controls, data, overview, system, users
from ..services.audit import record

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])
public_router = APIRouter(tags=["admin"])


def _log(admin: dict, action: str, entity_type: str, entity_id: str, detail: str = "") -> None:
    record(f"admin.{action}", entity_type=entity_type, entity_id=entity_id, detail=f"by {admin['email']}{': ' + detail if detail else ''}")


class Suspend(BaseModel):
    suspended: bool
    reason: str = ""


class UserLimits(BaseModel):
    quota_mb: int | None = None
    max_datasets: int | None = None
    ai_blocked: bool | None = None
    note: str | None = None


class Email(BaseModel):
    subject: str
    body: str


@public_router.get("/api/notice")
def notice():
    return controls.notice()


@router.get("/me")
def me(admin: dict = Depends(require_admin)):
    return {"email": admin["email"], "admin": True}


# ---- overview / users ------------------------------------------------------------------------------------------
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
    _log(admin, "suspend" if body.suspended else "unsuspend", "user", user_id, body.reason)
    return users.set_suspended(user_id, body.suspended, body.reason, admin["email"])


@router.put("/users/{user_id}/limits")
def set_limits(user_id: str, body: UserLimits, admin: dict = Depends(require_admin)):
    patch = body.model_dump(exclude_unset=True)
    _log(admin, "user_limits", "user", user_id, str(patch))
    return controls.set_flags(user_id, patch, admin["email"])


@router.post("/users/{user_id}/email")
def email_user(user_id: str, body: Email, admin: dict = Depends(require_admin)):
    from ..services.account.delivery import send_email
    to = users.owner_map().get(users._ws(user_id))
    if not to or "@" not in to:
        raise HTTPException(404, "No email address for this user")
    _log(admin, "email_user", "user", user_id, body.subject)
    return {"sent": True, "via": send_email(to, body.subject, body.body)}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    _log(admin, "delete_user", "user", user_id)
    return users.delete_user(user_id)


# ---- data ------------------------------------------------------------------------------------------------------
@router.get("/data/storage")
def data_storage():
    return data.storage()


@router.get("/data/{kind}")
def list_data(kind: str):
    return data.list_data(kind)


@router.delete("/data/{kind}/{row_id}")
def delete_data(kind: str, row_id: str, admin: dict = Depends(require_admin)):
    _log(admin, f"delete_{kind}", kind, row_id)
    return data.delete(kind, row_id)


@router.post("/data/datasets/{dataset_id}/refresh")
def refresh_dataset(dataset_id: str, admin: dict = Depends(require_admin)):
    _log(admin, "refresh_dataset", "dataset", dataset_id)
    return data.refresh(dataset_id)


@router.post("/data/shares/{share_id}/revoke")
def revoke_share(share_id: str, admin: dict = Depends(require_admin)):
    _log(admin, "revoke_share", "share", share_id)
    return data.revoke_share(share_id)


# ---- AI --------------------------------------------------------------------------------------------------------
@router.get("/ai")
def ai_overview(days: int = 30):
    return ai_admin.overview(days)


@router.post("/ai/providers/{provider_id}/unblock")
def unblock_provider(provider_id: str, admin: dict = Depends(require_admin)):
    _log(admin, "unblock_provider", "ai_provider", provider_id)
    return ai_admin.unblock_provider(provider_id)


# ---- platform settings / system -------------------------------------------------------------------------------
@router.get("/settings")
def get_settings():
    return controls.all_settings()


@router.put("/settings/{key}")
def put_setting(key: str, body: dict[str, Any], admin: dict = Depends(require_admin)):
    _log(admin, f"setting.{key}", "setting", key, str(body)[:300])
    return controls.put(key, body, admin["email"])


@router.get("/system")
def system_info():
    return system.info()


@router.get("/logs")
def logs(level: str | None = None, limit: int = 300):
    return system.recent_logs(level, max(1, min(limit, 500)))


@router.get("/activity")
def list_activity(user_id: str | None = None, q: str | None = None, status: str | None = None, limit: int = 200):
    return activity.query(user_id, q, status, limit)


@router.get("/audit")
def list_audit(q: str | None = None, limit: int = 300):
    where, params = ("action ILIKE ? OR detail ILIKE ?", [f"%{q}%", f"%{q}%"]) if q else ("", [])
    rows = store.list("audit_log", where=where, params=params, order=f"created_at DESC LIMIT {max(1, min(limit, 2000))}")
    owners = users.owner_map()
    for r in rows:
        r["owner"] = owners.get(r["workspace_id"], r["workspace_id"])
    return rows
