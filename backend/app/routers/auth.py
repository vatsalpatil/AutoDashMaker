"""Public auth bootstrap: tells the browser whether to show login and how to reach Supabase."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core.auth import require_user
from app.core.config import settings
from app.services import gotrue, password_reset, signup, throttle

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
        raise HTTPException(401, await run_in_threadpool(_why_failed, email))
    if err.get("error_code") == "email_not_confirmed":
        raise HTTPException(403, "Please confirm your email first: open the link we sent you.")
    raise HTTPException(r.status_code if r.status_code < 500 else 502, err.get("msg") or "Sign-in failed. Please try again.")


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    email: str
    code: str
    password: str


@router.post("/password/forgot")
async def password_forgot(body: ForgotIn, request: Request):
    """Email a 6-digit reset code. Always answers the same, so it can't be used to find out who has an account."""
    return await run_in_threadpool(password_reset.request, body.email, _client_ip(request))


@router.post("/password/reset")
async def password_reset_confirm(body: ResetIn, request: Request):
    return await run_in_threadpool(password_reset.confirm, body.email, body.code, body.password, _client_ip(request))


def _why_failed(email: str) -> str:
    """Say what is actually wrong (no account / Google-only account / wrong password). Every failed try still counts
    towards the lockout, so this can't be used to scan for accounts quickly. Without the service key we can only say 'wrong'."""
    if not gotrue.email_change_enabled():
        return "Wrong email or password."
    user = gotrue.find_user(email)
    if user is None:
        return "No account found for this email. Create an account first."
    providers = (user.get("app_metadata") or {}).get("providers") or []
    if providers and "email" not in providers:
        return "This account signs in with Google. Use Continue with Google."
    return "Wrong email or password."


class SignupIn(BaseModel):
    email: str
    password: str


class ResendIn(BaseModel):
    email: str


@router.post("/signup")
async def sign_up(body: SignupIn, request: Request):
    """Create an unconfirmed account and email the branded confirmation link. Same answer for new and existing addresses."""
    return await run_in_threadpool(signup.sign_up, body.email, body.password, _client_ip(request))


@router.post("/signup/resend")
async def sign_up_resend(body: ResendIn, request: Request):
    return await run_in_threadpool(signup.resend, body.email, _client_ip(request))


@router.get("/confirm")
async def confirm_email(t: str = ""):
    """The link in the confirmation email: confirm, then send the browser to the login page."""
    ok = await run_in_threadpool(signup.confirm, t)
    return RedirectResponse(f"{signup.app_url()}/?confirmed=1" + ("" if ok else "#error=invalid_link"), status_code=303)
