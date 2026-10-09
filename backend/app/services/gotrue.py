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


def find_user_id(email: str) -> str | None:
    """Account id for an email (admin API has no email filter, so scan the user list; fine at this size)."""
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
                return u["id"]
        if len(users) < 200:
            return None
    return None


def set_password(user_id: str, password: str) -> None:
    try:
        r = httpx.put(f"{_base()}/admin/users/{user_id}", json={"password": password}, headers=_admin_headers(), timeout=15)
    except httpx.HTTPError as e:
        raise HTTPException(502, "Could not reach the sign-in service. Please try again.") from e
    if r.status_code in (400, 422):
        raise HTTPException(400, "That password was not accepted. Try a longer or less common one.")
    if r.status_code >= 300:
        raise HTTPException(502, "The password could not be changed. Please try again.")
