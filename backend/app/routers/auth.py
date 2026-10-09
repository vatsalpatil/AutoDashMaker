"""Public auth bootstrap: tells the browser whether to show login and how to reach Supabase."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core.auth import require_user
from app.core.config import settings
from app.services import gotrue, throttle

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/config")
def auth_config():
    return {
        "enabled": settings.auth_enabled,
        "supabase_url": settings.supabase_url if settings.auth_enabled else "",
        "supabase_anon_key": settings.supabase_anon_key if settings.auth_enabled else "",
    }


@router.get("/me")
def me(user: dict = Depends(require_user)):
    return user


class LoginIn(BaseModel):
    email: str
    password: str


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "?")


@router.post("/login")
async def login(body: LoginIn, request: Request):
    """Password sign-in through the backend so wrong passwords can be counted: 20 wrong attempts in 10 minutes
    (per email and per address) block further tries for 10 minutes. Returns the Supabase session tokens."""
    if not settings.auth_enabled:
        raise HTTPException(404, "Sign-in is off on this server.")
    email = body.email.strip().lower()
    keys = (f"login:email:{email}", f"login:ip:{_client_ip(request)}")
    throttle.check(*keys)
    r = await run_in_threadpool(gotrue.password_login, email, body.password)
    if r.status_code == 200:
        throttle.clear(keys[0])
        return r.json()
    err = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if err.get("error_code") == "invalid_credentials":
        throttle.fail(*keys)
        throttle.check(*keys)
        raise HTTPException(401, "Wrong email or password.")
    if err.get("error_code") == "email_not_confirmed":
        raise HTTPException(403, "Please confirm your email first: open the link we sent you.")
    raise HTTPException(r.status_code if r.status_code < 500 else 502, err.get("msg") or "Sign-in failed. Please try again.")
