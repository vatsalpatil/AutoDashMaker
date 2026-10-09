"""Delete my own account, with proof: a code emailed to the account's address AND the address typed back.

Order matters: the sign-in account is removed first (if that fails nothing has been touched), then every row, file
and folder that belonged to the user's workspace. Needs SUPABASE_SERVICE_KEY, like the email change.
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from ..core import tenant
from ..core.config import settings
from ..core.store import store
from . import gotrue, verification as v

log = logging.getLogger("dashtor.account")
CHANNEL = "email_delete"


def _require_ready(user: dict[str, Any]) -> dict[str, Any]:
    if not settings.auth_enabled or user["workspace_id"] == tenant.DEFAULT_WS:
        raise HTTPException(400, "There is no account to delete in local mode.")
    if not gotrue.email_change_enabled():  # same switch: the backend holds the service key
        raise HTTPException(501, "Deleting accounts isn't enabled on this server.")
    c = v.ensure_contact(user)
    if not c["email"]:
        raise HTTPException(400, "This account has no email address to send the code to.")
    return c


def start(user: dict[str, Any]) -> dict[str, Any]:
    c = _require_ready(user)
    return v.issue(user, CHANNEL, c["email"], purpose="account deletion")


def finish(user: dict[str, Any], code: str, typed_email: str) -> dict[str, Any]:
    c = _require_ready(user)
    if (typed_email or "").strip().lower() != c["email"].lower():
        raise HTTPException(400, "Type your account's email address exactly to confirm.")
    row = v.check_code(user, CHANNEL, code)
    if row["target"] != c["email"]:
        raise HTTPException(400, "That code was sent for a different address. Request a new code.")
    gotrue.delete_user(user["id"])  # first: a failure here leaves everything as it was
    v.consume(row)
    _purge(user["id"], user["workspace_id"])
    log.warning("account deleted: %s (%s)", user["id"], user["workspace_id"])
    return {"deleted": True}


def _purge(user_id: str, ws: str) -> None:
    """Remove everything the workspace owns. Table names come from the database's own catalogue, never from input."""
    tables = [r["table_name"] for r in store.execute("SELECT table_name FROM information_schema.columns WHERE column_name = 'workspace_id'")]
    for t in tables:
        store.execute(f"DELETE FROM {t} WHERE workspace_id = ?", [ws])
    for t in ("user_contacts", "verification_codes"):
        store.execute(f"DELETE FROM {t} WHERE user_id = ?", [user_id])
    from .engine import engine  # lazy: the engine imports a lot
    with engine._lock:  # noqa: SLF001 - forget the cached connection holder for this workspace
        engine._engines.pop(ws, None)  # noqa: SLF001
    for d in (Path(tenant.analytics_path(ws)).parent, tenant.upload_dir(ws)):
        if d.name == ws:  # only ever the workspace's own folder
            shutil.rmtree(d, ignore_errors=True)
