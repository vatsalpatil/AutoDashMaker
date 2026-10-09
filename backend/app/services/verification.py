"""Email + mobile verification with one-time codes.

Every signed-in user has one `user_contacts` row (created the first time we see them, so users who signed up before this
feature are covered automatically). Codes are 6 digits, stored only as an HMAC, valid 10 minutes, 5 tries each, with a resend
cooldown and an hourly cap. Enforcement (`VERIFICATION_REQUIRED`) only starts after a per-user grace period.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from ..core.config import settings
from ..core.store import store
from . import delivery

CODE_TTL_S = 600
RESEND_COOLDOWN_S = 60
MAX_SENDS_PER_HOUR = 5
MAX_ATTEMPTS = 5
E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash(user_id: str, channel: str, target: str, code: str) -> str:
    key = (settings.verification_secret or settings.supabase_jwt_secret or "dashtor-dev-only").encode()
    return hmac.new(key, f"{user_id}|{channel}|{target}|{code}".encode(), hashlib.sha256).hexdigest()


def mask(channel: str, target: str) -> str:
    if channel == "email":
        name, _, host = target.partition("@")
        return f"{name[:1]}{'*' * max(len(name) - 1, 2)}@{host}"
    return f"{target[:3]}{'*' * max(len(target) - 6, 3)}{target[-3:]}"


def ensure_contact(user: dict[str, Any]) -> dict[str, Any]:
    """The user's contact row, created (or kept in step with the sign-in email) on first sight."""
    uid, email, now = user["id"], user.get("email") or "", _now()
    trusted = bool(user.get("email_verified"))  # e.g. Google already proved the address
    row = (store.execute("SELECT * FROM user_contacts WHERE user_id = ?", [uid]) or [None])[0]
    if row is None:
        store.execute("INSERT INTO user_contacts (user_id, email, email_verified_at, first_seen_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                      [uid, email, now if trusted and email else None, now, now])
    elif row["email"] != email:  # the account's email changed: it must be proven again
        store.execute("UPDATE user_contacts SET email = ?, email_verified_at = ?, updated_at = ? WHERE user_id = ?",
                      [email, now if trusted and email else None, now, uid])
    elif trusted and email and not row["email_verified_at"]:
        store.execute("UPDATE user_contacts SET email_verified_at = ?, updated_at = ? WHERE user_id = ?", [now, now, uid])
    return store.execute("SELECT * FROM user_contacts WHERE user_id = ?", [uid])[0]


def _missing(c: dict[str, Any]) -> list[str]:
    out = []
    if settings.verification_email and not c["email_verified_at"]:
        out.append("email")
    if settings.verification_phone and not c["phone_verified_at"]:
        out.append("phone")
    return out


def status(user: dict[str, Any]) -> dict[str, Any]:
    c = ensure_contact(user)
    grace_ends = c["first_seen_at"] + timedelta(days=settings.verification_grace_days)
    missing = _missing(c)
    return {
        "email": c["email"], "email_masked": mask("email", c["email"]) if c["email"] else "",
        "email_verified": bool(c["email_verified_at"]),
        "phone_masked": mask("phone", c["phone"]) if c["phone"] else "", "phone_verified": bool(c["phone_verified_at"]),
        "channels": {"email": settings.verification_email, "phone": settings.verification_phone},
        "missing": missing, "complete": not missing,
        "required": settings.verification_required, "grace_ends_at": grace_ends.isoformat(),
        "blocked": bool(missing) and settings.verification_required and _now() > grace_ends,
        "delivery": {"email": delivery.email_mode(), "phone": delivery.sms_mode()},
    }


def is_blocked(user: dict[str, Any]) -> bool:
    return status(user)["blocked"]


def send_code(user: dict[str, Any], channel: str, phone: str | None = None) -> dict[str, Any]:
    if channel not in ("email", "phone"):
        raise HTTPException(400, "channel must be email or phone")
    c = ensure_contact(user)
    if channel == "email":
        target = c["email"]
        if not target:
            raise HTTPException(400, "This account has no email address.")
    else:
        target = re.sub(r"[\s\-()]", "", phone or "")
        if not E164.match(target):
            raise HTTPException(400, "Enter the number with its country code, like +919876543210.")
        taken = store.execute("SELECT 1 FROM user_contacts WHERE phone = ? AND phone_verified_at IS NOT NULL AND user_id <> ?", [target, user["id"]])
        if taken:
            raise HTTPException(409, "That number is already verified on another account.")
    now = _now()
    recent = store.execute("SELECT created_at FROM verification_codes WHERE user_id = ? AND channel = ? ORDER BY created_at DESC LIMIT 1", [user["id"], channel])
    if recent and (wait := RESEND_COOLDOWN_S - (now - recent[0]["created_at"]).total_seconds()) > 0:
        raise HTTPException(429, f"Please wait {int(wait) + 1} seconds before asking for another code.")
    sent = store.execute("SELECT COUNT(*) AS n FROM verification_codes WHERE user_id = ? AND channel = ? AND created_at > ?", [user["id"], channel, now - timedelta(hours=1)])[0]["n"]
    if sent >= MAX_SENDS_PER_HOUR:
        raise HTTPException(429, "Too many codes requested. Try again in an hour.")

    code = f"{secrets.randbelow(10**6):06d}"
    cid = uuid.uuid4().hex[:12]
    store.execute("INSERT INTO verification_codes (id, user_id, channel, target, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [cid, user["id"], channel, target, _hash(user["id"], channel, target, code), now, now + timedelta(seconds=CODE_TTL_S)])
    text = f"Your Dashtor verification code is {code}. It expires in {CODE_TTL_S // 60} minutes. If you didn't ask for it, ignore this message."
    try:
        mode = delivery.send_email(target, "Your Dashtor verification code", text) if channel == "email" else delivery.send_sms(target, text)
    except delivery.DeliveryError as e:
        store.execute("UPDATE verification_codes SET consumed_at = ? WHERE id = ?", [now, cid])  # unusable: nothing was delivered
        raise HTTPException(502, str(e)) from e
    out = {"sent": True, "channel": channel, "to": mask(channel, target), "expires_in_s": CODE_TTL_S, "resend_in_s": RESEND_COOLDOWN_S, "delivery": mode}
    if mode == "console" and settings.verification_dev_echo:
        out["dev_code"] = code
    return out


def confirm_code(user: dict[str, Any], channel: str, code: str) -> dict[str, Any]:
    if channel not in ("email", "phone"):
        raise HTTPException(400, "channel must be email or phone")
    now = _now()
    rows = store.execute("SELECT * FROM verification_codes WHERE user_id = ? AND channel = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1", [user["id"], channel])
    if not rows or rows[0]["expires_at"] < now:
        raise HTTPException(400, "That code has expired. Request a new one.")
    row = rows[0]
    if row["attempts"] >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong attempts. Request a new code.")
    store.execute("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?", [row["id"]])
    if not hmac.compare_digest(row["code_hash"], _hash(user["id"], channel, row["target"], (code or "").strip())):
        left = MAX_ATTEMPTS - row["attempts"] - 1
        raise HTTPException(400, f"That code is not correct. {left} attempt{'s' if left != 1 else ''} left." if left > 0 else "That code is not correct. Request a new code.")
    if channel == "phone" and store.execute("SELECT 1 FROM user_contacts WHERE phone = ? AND phone_verified_at IS NOT NULL AND user_id <> ?", [row["target"], user["id"]]):
        raise HTTPException(409, "That number is already verified on another account.")
    store.execute("UPDATE verification_codes SET consumed_at = ? WHERE id = ?", [now, row["id"]])
    ensure_contact(user)
    if channel == "email":
        store.execute("UPDATE user_contacts SET email_verified_at = ?, updated_at = ? WHERE user_id = ?", [now, now, user["id"]])
    else:
        store.execute("UPDATE user_contacts SET phone = ?, phone_verified_at = ?, updated_at = ? WHERE user_id = ?", [row["target"], now, now, user["id"]])
    return status(user)
