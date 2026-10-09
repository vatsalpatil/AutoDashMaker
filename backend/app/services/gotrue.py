"""The few Supabase Auth (GoTrue) calls the backend makes itself: the password login proxy and the admin email change."""
from __future__ import annotations

import time

import httpx
from fastapi import HTTPException

from ..core.config import settings


def _base() -> str:
    return settings.supabase_url.rstrip("/") + "/auth/v1"


def password_login(email: str, password: str) -> httpx.Response:
    try:
        return httpx.post(f"{_base()}/token", params={"grant_type": "password"}, json={"email": email, "password": password},
                          headers={"apikey": settings.supabase_anon_key}, timeout=15)
    except httpx.HTTPError as e:
        raise HTTPException(502, "Sign-in service is unreachable. Please try again.") from e


def email_change_enabled() -> bool:
    return bool(settings.supabase_service_key)


def set_email(user_id: str, new_email: str) -> None:
    """Change the account's sign-in email (already proven by a code) without GoTrue's own confirmation mail."""
    try:
        r = httpx.put(f"{_base()}/admin/users/{user_id}", json={"email": new_email, "email_confirm": True}, timeout=15,
                      headers={"apikey": settings.supabase_service_key, "Authorization": f"Bearer {settings.supabase_service_key}"})
    except httpx.HTTPError as e:
        raise HTTPException(502, "Could not reach the sign-in service. Please try again.") from e
    if r.status_code in (409, 422):
        raise HTTPException(409, "That email address is already in use.")
    if r.status_code >= 300:
        raise HTTPException(502, "The email address could not be changed. Please try again.")


def delete_user(user_id: str) -> None:
    """Remove the sign-in account itself (after the user proved they want it). A missing user counts as done."""
    try:
        r = httpx.delete(f"{_base()}/admin/users/{user_id}", timeout=15,
                         headers={"apikey": settings.supabase_service_key, "Authorization": f"Bearer {settings.supabase_service_key}"})
    except httpx.HTTPError as e:
        raise HTTPException(502, "Could not reach the sign-in service. Nothing was deleted; please try again.") from e
    if r.status_code >= 300 and r.status_code != 404:
        raise HTTPException(502, "The account could not be deleted. Nothing was deleted; please try again.")


def _admin_headers() -> dict[str, str]:
    return {"apikey": settings.supabase_service_key, "Authorization": f"Bearer {settings.supabase_service_key}"}


def find_user(email: str) -> dict | None:
    """The account for an email (admin API has no email filter, so scan the user list; fine at this size)."""
    for page in range(1, 11):
        try:
            r = httpx.get(f"{_base()}/admin/users", params={"page": page, "per_page": 200}, headers=_admin_headers(), timeout=15)
        except httpx.HTTPError:
            return None
        if r.status_code >= 300:
            return None
        users = r.json().get("users", [])
        for u in users:
            if (u.get("email") or "").lower() == email:
                return u
        if len(users) < 200:
            return None
    return None


def find_user_id(email: str) -> str | None:
    u = find_user(email)
    return u["id"] if u else None


def set_password(user_id: str, password: str) -> None:
    try:
        r = httpx.put(f"{_base()}/admin/users/{user_id}", json={"password": password}, headers=_admin_headers(), timeout=15)
    except httpx.HTTPError as e:
        raise HTTPException(502, "Could not reach the sign-in service. Please try again.") from e
    if r.status_code in (400, 422):
        raise HTTPException(400, "That password was not accepted. Try a longer or less common one.")
    if r.status_code >= 300:
        raise HTTPException(502, "The password could not be changed. Please try again.")


_autoconfirm = {"at": -1e9, "on": True}


def autoconfirm_on() -> bool:
    """Does Supabase sign people in WITHOUT making them confirm their email? Read from its public settings (cached 5 min).
    If it can't be read we assume yes, the safe answer: nobody is then trusted as email-verified."""
    now = time.monotonic()
    if now - _autoconfirm["at"] < 300:
        return _autoconfirm["on"]
    try:
        r = httpx.get(f"{_base()}/settings", headers={"apikey": settings.supabase_anon_key}, timeout=5)
        on = bool(r.json().get("mailer_autoconfirm", True)) if r.status_code < 300 else True
        _autoconfirm.update(at=now, on=on)
    except (httpx.HTTPError, ValueError):
        _autoconfirm.update(at=now - 270, on=True)  # retry in 30 s
    return _autoconfirm["on"]


def create_user(email: str, password: str) -> str | None:
    """Create a password account that is NOT yet confirmed (so it can't sign in until the emailed link is used).
    Returns the new id, or None when the email already has an account."""
    try:
        r = httpx.post(f"{_base()}/admin/users", json={"email": email, "password": password, "email_confirm": False},
                       headers=_admin_headers(), timeout=15)
    except httpx.HTTPError as e:
        raise HTTPException(502, "Could not reach the sign-in service. Please try again.") from e
    if r.status_code < 300:
        return r.json()["id"]
    code = (r.json() if r.headers.get("content-type", "").startswith("application/json") else {}).get("error_code", "")
    if code in ("email_exists", "user_already_exists"):
        return None
    if code == "weak_password" or r.status_code == 422:
        raise HTTPException(400, "That password was not accepted. Try a longer or less common one.")
    raise HTTPException(502, "The account could not be created. Please try again.")


def confirm_email(user_id: str) -> None:
    try:
        r = httpx.put(f"{_base()}/admin/users/{user_id}", json={"email_confirm": True}, headers=_admin_headers(), timeout=15)
    except httpx.HTTPError as e:
        raise HTTPException(502, "Could not reach the sign-in service. Please try again.") from e
    if r.status_code >= 300:
        raise HTTPException(502, "The email could not be confirmed. Please try again.")
