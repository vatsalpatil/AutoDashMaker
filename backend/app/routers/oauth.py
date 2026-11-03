"""OAuth endpoints for MCP clients (logic in services/oauth.py).

Public: discovery metadata under /.well-known (Caddy routes it here), `/api/oauth/register|authorize|token|client`.
Signed in: `/api/oauth/approve` (the consent page at /oauth/consent posts the user's answer).
"""
from urllib.parse import parse_qsl, urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from ..core.auth import require_verified
from ..services import audit, oauth
from .mcp import public_url

router = APIRouter(tags=["oauth"])
PARAMS = ("response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource")


def _err(e: oauth.OAuthError, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": e.error, "error_description": e.description}, status, headers={"Cache-Control": "no-store"})


@router.get("/.well-known/oauth-protected-resource")
@router.get("/.well-known/oauth-protected-resource/{rest:path}")
def protected_resource(request: Request, rest: str = ""):
    base = public_url(request)
    return {"resource": f"{base}/api/mcp", "authorization_servers": [base], "bearer_methods_supported": ["header"],
            "scopes_supported": ["full", "read"], "resource_name": "Dashtor"}


@router.get("/.well-known/oauth-authorization-server")
@router.get("/.well-known/oauth-authorization-server/{rest:path}")
@router.get("/.well-known/openid-configuration")
def authorization_server(request: Request, rest: str = ""):
    base = public_url(request)
    return {"issuer": base, "authorization_endpoint": f"{base}/api/oauth/authorize", "token_endpoint": f"{base}/api/oauth/token",
            "registration_endpoint": f"{base}/api/oauth/register", "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code"], "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"], "scopes_supported": ["full", "read"]}


@router.post("/api/oauth/register")
async def register(request: Request):
    try:
        return JSONResponse(oauth.register(await request.json()), 201)
    except ValueError:
        return _err(oauth.OAuthError("invalid_client_metadata", "body must be JSON"))
    except oauth.OAuthError as e:
        return _err(e)


@router.get("/api/oauth/authorize")
def authorize(request: Request):
    p = {k: v for k, v in request.query_params.items() if k in PARAMS}
    try:
        oauth.check_request(p)   # never redirect to an unchecked URI
    except oauth.OAuthError as e:
        return _err(e)
    return RedirectResponse(f"{public_url(request)}/oauth/consent?{urlencode(p)}", 302)


@router.get("/api/oauth/client")
def client_info(client_id: str, redirect_uri: str = ""):
    try:
        c = oauth.client(client_id)
    except oauth.OAuthError as e:
        raise HTTPException(400, e.description) from e
    return {"name": c["name"], "redirect_host": redirect_uri.split("/")[2] if redirect_uri.count("/") >= 2 else ""}


class ApproveIn(BaseModel):
    params: dict[str, str]
    allow: bool
    scope: str = "full"


@router.post("/api/oauth/approve")
def approve(body: ApproveIn, user: dict = Depends(require_verified)):
    if user.get("token_id"):
        raise HTTPException(403, "Approve connections from the app, not with a token")
    p = {k: v for k, v in body.params.items() if k in PARAMS}
    try:
        if not body.allow:
            return {"redirect": oauth.deny_url(p)}
        url = oauth.approve(user, p, "read" if body.scope == "read" else "full")
    except oauth.OAuthError as e:
        raise HTTPException(400, e.description) from e
    audit.record("oauth.approve", entity_type="access_token", detail=oauth.client(p["client_id"])["name"])
    return {"redirect": url}


@router.post("/api/oauth/token")
async def token(request: Request):
    form = dict(parse_qsl((await request.body()).decode(errors="ignore")))
    try:
        return JSONResponse(oauth.exchange(form), headers={"Cache-Control": "no-store"})
    except oauth.OAuthError as e:
        return _err(e)
