"""Supabase Auth JWT verification (FastAPI dependency).

AUTH_ENABLED=false (default) -> every request is the local single user, so dev is unchanged.
AUTH_ENABLED=true -> requests need `Authorization: Bearer <supabase access token>`.
PyJWT is imported only when auth is on, so local mode runs without it installed.
Verification: HS256 with SUPABASE_JWT_SECRET (legacy projects) or, when the secret is empty,
the project's public JWKS at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256/RS256).
"""
from functools import lru_cache

from fastapi import Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.core import tenant
from app.core.config import settings

LOCAL_USER = {"id": "local", "email": "local@localhost", "role": "owner"}


@lru_cache(maxsize=1)
def _jwks():
    from jwt import PyJWKClient
    return PyJWKClient(f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_keys=True)


def _auth_confirms_email() -> bool:
    """AUTH_CONFIRMS_EMAIL only counts while Supabase really makes users click the emailed link (autoconfirm off);
    otherwise anyone could sign up with someone else's address and be treated as verified."""
    if not settings.auth_confirms_email:
        return False
    from app.services import gotrue  # lazy: keeps local mode import-light
    return not gotrue.autoconfirm_on()


def verify_token(token: str) -> dict:
    try:
        import jwt
    except ImportError as e:  # AUTH_ENABLED=true needs: pip install -r requirements.txt
        raise HTTPException(500, "Server is missing PyJWT (pip install -r backend/requirements.txt)") from e
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(401, "Server has no SUPABASE_JWT_SECRET for HS256 tokens")
            key = settings.supabase_jwt_secret
        else:
            key = _jwks().get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except HTTPException:
        raise
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Invalid or expired token: {e}") from e
    meta, app_meta = claims.get("user_metadata") or {}, claims.get("app_metadata") or {}
    # an identity provider (Google…) has already proven the address; for password sign-ups we prove it with a code
    email_verified = (_auth_confirms_email() or bool(meta.get("email_verified"))
                      or app_meta.get("provider") in ("google", "github", "azure", "apple"))
    return {"id": claims["sub"], "email": claims.get("email", ""), "role": claims.get("role", "authenticated"), "email_verified": email_verified}


async def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Authenticate the request and pin it to the user's own workspace.

    Must be `async`: a sync dependency runs in a worker thread, and its ContextVar change would be lost
    before the endpoint runs.
    """
    if not settings.auth_enabled:
        user = dict(LOCAL_USER, workspace_id=tenant.DEFAULT_WS)  # local mode: the legacy single workspace
    else:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Not signed in")
        user = await run_in_threadpool(verify_token, authorization[7:].strip())  # JWKS fetch may block
        user["workspace_id"] = tenant.workspace_for_user(user["id"])
    tenant.set_workspace(user["workspace_id"])
    return user


async def require_verified(user: dict = Depends(require_user)) -> dict:
    """require_user, plus: once VERIFICATION_REQUIRED is on and the grace period is over, unverified users get 403
    {code: verification_required} everywhere except /api/verify and /api/auth (so they can still verify)."""
    if settings.auth_enabled and settings.verification_required:
        from app.services import verification  # lazy: keeps local mode import-light
        if await run_in_threadpool(verification.is_blocked, user):
            raise HTTPException(403, {"code": "verification_required", "message": "Verify your email and mobile number to continue."})
    return user
