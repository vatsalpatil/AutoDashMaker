"""Forgot password, done by us so the email is the branded one: email -> 6-digit code -> new password.

Public endpoints, so nothing may reveal whether an address has an account: `request` always answers the same, and a wrong
email at `confirm` fails like a wrong code. Wrong codes count towards the 20-per-10-minutes lockout. Needs SUPABASE_SERVICE_KEY.
"""
from __future__ import annotations

import re

from fastapi import HTTPException

from ..core.store import store
from . import gotrue, throttle, verification as v
from ..core.config import settings

CHANNEL = "email_reset"
GENERIC = {"sent": True}
BAD_CODE = "That code is not correct or has expired. Request a new one."


def _email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if not re.match(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$", email):
        raise HTTPException(400, "Enter a valid email address.")
    return email


def _user_id(email: str) -> str | None:
    row = store.execute("SELECT user_id FROM user_contacts WHERE lower(email) = ? LIMIT 1", [email])
    return row[0]["user_id"] if row else gotrue.find_user_id(email)


def _ready() -> None:
    if not settings.auth_enabled:
        raise HTTPException(404, "Sign-in is off on this server.")
    if not gotrue.email_change_enabled():  # the backend needs the service key to set a password
        raise HTTPException(501, "Password reset isn't enabled on this server.")


def request(raw_email: str, ip: str) -> dict:
    _ready()
    email = _email(raw_email)
    keys = (f"reset:email:{email}", f"reset:ip:{ip}")
    throttle.check(*keys)
    throttle.fail(*keys)  # every request counts: a flood of reset mails is blocked like password guessing
    uid = _user_id(email)
    if uid:
        try:
            v.issue({"id": uid}, CHANNEL, email, purpose="password reset")
        except HTTPException:
            pass  # cooldown / hourly cap: answer the same so nobody can probe which addresses exist
    return GENERIC


def confirm(raw_email: str, code: str, new_password: str, ip: str) -> dict:
    _ready()
    email = _email(raw_email)
    if not 8 <= len(new_password or "") <= 72:
        raise HTTPException(400, "Choose a password of 8 to 72 characters.")
    keys = (f"reset:email:{email}", f"reset:ip:{ip}")
    throttle.check(*keys)
    uid = _user_id(email)
    if not uid:
        throttle.fail(*keys)
        raise HTTPException(400, BAD_CODE)
    row = v.check_code({"id": uid}, CHANNEL, code)  # counts wrong codes towards the lockout
    if row["target"] != email:
        raise HTTPException(400, BAD_CODE)
    gotrue.set_password(uid, new_password)
    v.consume(row)
    throttle.clear(*keys, f"login:email:{email}")  # they can sign in straight away
    return {"ok": True}
