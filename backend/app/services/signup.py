"""Create account -> branded confirmation email -> click the link -> sign in.

We create the account ourselves (unconfirmed) so the email is OUR designed one, not Supabase's stock template. The link carries
an HMAC-signed token (account id + email + expiry); opening it confirms the email and sends the browser to the login page.
Public endpoints: they answer the same whether or not the address already has an account.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time

from fastapi import HTTPException

from ..core.config import settings
from . import delivery, email_templates, gotrue, throttle

VALID_HOURS = 24
RESEND_COOLDOWN_S = 60
GENERIC = {"sent": True}
_last_sent: dict[str, float] = {}


def _key() -> bytes:
    return (settings.verification_secret or settings.supabase_jwt_secret or "dashtor-dev-only").encode()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(user_id: str, email: str) -> str:
    body = _b64(json.dumps({"u": user_id, "e": email, "x": int(time.time()) + VALID_HOURS * 3600}).encode())
    return f"{body}.{_b64(hmac.new(_key(), body.encode(), hashlib.sha256).digest())}"


def read_token(token: str) -> dict | None:
    """The token's contents, or None if it is forged, damaged or expired."""
    try:
        body, sig = token.split(".", 1)
        if not hmac.compare_digest(_unb64(sig), hmac.new(_key(), body.encode(), hashlib.sha256).digest()):
            return None
        data = json.loads(_unb64(body))
        return data if data["x"] > time.time() else None
    except (ValueError, KeyError, TypeError):
        return None


def app_url() -> str:
    return (settings.app_url or (settings.cors_origins[0] if settings.cors_origins else "")).rstrip("/")


def _ready() -> None:
    if not settings.auth_enabled:
        raise HTTPException(404, "Sign-in is off on this server.")
    if not gotrue.email_change_enabled():
        raise HTTPException(501, "Creating accounts isn't enabled on this server.")


def _valid(email: str, password: str | None = None) -> str:
    email = (email or "").strip().lower()
    if not re.match(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$", email):
        raise HTTPException(400, "Enter a valid email address.")
    if password is not None and not 8 <= len(password) <= 72:
        raise HTTPException(400, "Choose a password of 8 to 72 characters.")
    return email


def _send_link(user_id: str, email: str) -> None:
    now = throttle.clock()
    if now - _last_sent.get(email, -1e9) < RESEND_COOLDOWN_S:
        return  # a mail just went out; the same answer is returned, so nothing is revealed
    _last_sent[email] = now
    url = f"{app_url()}/api/auth/confirm?t={make_token(user_id, email)}"
    subject, text, html = email_templates.link_email(
        "Confirm your email", "Welcome to Dashtor! Confirm your email address to finish creating your account.",
        "Confirm email address", url, "If you didn't create a Dashtor account, you can safely ignore this email.", VALID_HOURS)
    try:
        delivery.send_email(email, subject, text, html)
    except delivery.DeliveryError as e:
        raise HTTPException(502, str(e)) from e


def _guard(email: str, ip: str) -> None:
    keys = (f"signup:email:{email}", f"signup:ip:{ip}")
    throttle.check(*keys)
    throttle.fail(*keys)  # every request counts, so sign-up can't be used to flood mailboxes


def sign_up(raw_email: str, password: str, ip: str) -> dict:
    _ready()
    email = _valid(raw_email, password)
    _guard(email, ip)
    uid = gotrue.create_user(email, password)
    if uid:
        _send_link(uid, email)
    else:  # already registered: an unconfirmed one gets the link again, a confirmed one gets nothing (and the same answer)
        _resend_if_unconfirmed(email)
    return GENERIC


def resend(raw_email: str, ip: str) -> dict:
    _ready()
    email = _valid(raw_email)
    _guard(email, ip)
    _resend_if_unconfirmed(email)
    return GENERIC


def _resend_if_unconfirmed(email: str) -> None:
    user = gotrue.find_user(email)
    if user and not user.get("email_confirmed_at"):
        _send_link(user["id"], email)


def confirm(token: str) -> bool:
    data = read_token(token)
    if not data:
        return False
    gotrue.confirm_email(data["u"])
    return True
