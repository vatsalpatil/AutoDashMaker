"""Supabase Auth JWT verification (FastAPI dependency).

AUTH_ENABLED=false (default) -> every request is the local single user, so dev is unchanged.
AUTH_ENABLED=true -> requests need `Authorization: Bearer <supabase access token>`.
Verification: HS256 with SUPABASE_JWT_SECRET (legacy projects) or, when the secret is empty,
the project's public JWKS at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256/RS256).
"""
from functools import lru_cache

import jwt
from fastapi import Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from jwt import PyJWKClient

from app.core import tenant
from app.core.config import settings

LOCAL_USER = {"id": "local", "email": "local@localhost", "role": "owner"}


@lru_cache(maxsize=1)
def _jwks() -> PyJWKClient:
    return PyJWKClient(f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_keys=True)


def verify_token(token: str) -> dict:
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
    return {"id": claims["sub"], "email": claims.get("email", ""), "role": claims.get("role", "authenticated")}


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
