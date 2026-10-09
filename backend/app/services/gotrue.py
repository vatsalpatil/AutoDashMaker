"""The few Supabase Auth (GoTrue) calls the backend makes itself: the password login proxy and the admin email change."""
from __future__ import annotations

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
