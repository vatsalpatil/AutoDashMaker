"""Change the verified email or mobile number of an existing account.

Two proofs are required, so a stolen session alone can't take over the account:
  1. a code sent to the NEW value (proves the user owns it), and
  2. a code sent to the account's OTHER verified contact (changing the number needs the email; changing the email needs the number).
The old email is told about every change. Email changes also need SUPABASE_SERVICE_KEY (GoTrue admin API).
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException

from ..core.config import settings
from ..core.store import store
from . import delivery, email_templates, gotrue, verification as v

EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")


def _normalise(channel: str, value: str) -> str:
    if channel == "phone":
        out = re.sub(r"[\s\-()]", "", value or "")
        if not v.E164.match(out):
            raise HTTPException(400, "Enter the number with its country code, like +919876543210.")
        return out
    out = (value or "").strip().lower()
    if not EMAIL.match(out):
        raise HTTPException(400, "Enter a valid email address.")
    return out


def _proof_channel(channel: str) -> str:
    """The second code goes to the account's OTHER contact; with mobile verification off, an email change is
    proven with a code to the current email instead (stored as channel `email_old` so it can't clash with the new-address code)."""
    if channel == "phone":
        return "email"
    return "phone" if settings.verification_phone else "email_old"


def _proof_contact(c: dict[str, Any], proof: str) -> tuple[str | None, bool]:
    """(address or number the proof code goes to, whether it is verified)."""
    if proof == "phone":
        return c["phone"], bool(c["phone_verified_at"])
    return c["email"], bool(c["email_verified_at"])


def start(user: dict[str, Any], channel: str, new_value: str) -> dict[str, Any]:
    if channel not in ("email", "phone"):
        raise HTTPException(400, "channel must be email or phone")
    if channel == "phone" and not settings.verification_phone:
        raise HTTPException(400, "Mobile number verification is switched off on this server.")
    c = v.ensure_contact(user)
    proof = _proof_channel(channel)
    proof_target, proof_ok = _proof_contact(c, proof)
    if not proof_ok:
        raise HTTPException(400, f"Verify your {'mobile number' if proof == 'phone' else 'email'} first, so we can confirm it's you.")
    if channel == "email" and not gotrue.email_change_enabled():
        raise HTTPException(501, "Changing the email address isn't enabled on this server.")
    target = _normalise(channel, new_value)
    if target == c[channel]:
        raise HTTPException(400, "That is already your current " + ("number." if channel == "phone" else "email."))
    if channel == "phone" and v.phone_taken(target, user["id"]):
        raise HTTPException(409, "That number is already verified on another account.")
    if channel == "email" and store.execute("SELECT 1 FROM user_contacts WHERE lower(email) = ? AND user_id <> ?", [target, user["id"]]):
        raise HTTPException(409, "That email address is already in use.")
    sent_new = v.issue(user, channel, target, purpose="change")
    sent_proof = v.issue(user, proof, proof_target, purpose="change")
    return {"new": sent_new, "proof": sent_proof}


def finish(user: dict[str, Any], channel: str, proof_code: str, new_code: str) -> dict[str, Any]:
    if channel not in ("email", "phone"):
        raise HTTPException(400, "channel must be email or phone")
    proof = _proof_channel(channel)
    c = v.ensure_contact(user)
    new_row = v.check_code(user, channel, new_code)
    proof_row = v.check_code(user, proof, proof_code)
    if new_row["target"] == c[channel] or proof_row["target"] != _proof_contact(c, proof)[0]:
        raise HTTPException(400, "Those codes don't belong to a pending change. Start again.")
    if channel == "phone" and v.phone_taken(new_row["target"], user["id"]):
        raise HTTPException(409, "That number is already verified on another account.")
    now, old_email, target = v._now(), c["email"], new_row["target"]
    if channel == "email":
        gotrue.set_email(user["id"], target)  # first: if the sign-in service refuses, nothing local has changed
        store.execute("UPDATE user_contacts SET prev_email = ?, email = ?, email_verified_at = ?, updated_at = ? WHERE user_id = ?",
                      [old_email, target, now, now, user["id"]])
    else:
        store.execute("UPDATE user_contacts SET phone = ?, phone_verified_at = ?, updated_at = ? WHERE user_id = ?", [target, now, now, user["id"]])
    v.consume(new_row)
    v.consume(proof_row)
    what = "email address" if channel == "email" else "mobile number"
    try:  # best effort: the change is already done
        subject, text, html = email_templates.notice_email(
            f"Your {what} was changed",
            f"The {what} on your Dashtor account was changed to {v.mask(channel, target)}. If this wasn't you, contact support now.")
        delivery.send_email(old_email, subject, text, html)
    except delivery.DeliveryError:
        pass
    return v.status({**user, "email": target if channel == "email" else user.get("email", "")})
