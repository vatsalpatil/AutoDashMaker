"""Bring-your-own-AI: access tokens + the MCP endpoint.

`router` (signed in): `/api/access-tokens` create / list / revoke (never usable with a token itself).
`mcp_router` (token auth): `POST /api/mcp` with `Authorization: Bearer dtr_...`, or `POST /api/mcp/t/<token>` for AI apps
that only take a URL (ChatGPT / claude.ai custom connectors). Lives under /api so the existing proxies route it.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from ..core import tenant
from ..core.auth import require_verified
from ..core.config import settings
from ..services import access_tokens, audit
from ..services.mcp import server

router = APIRouter(prefix="/api/access-tokens", tags=["access-tokens"])
mcp_router = APIRouter(prefix="/api/mcp", tags=["mcp"])


class TokenIn(BaseModel):
    name: str = "My AI"
    scope: str = "full"   # full | read


def _session_user(user: dict = Depends(require_verified)) -> dict:
    if user.get("token_id"):
        raise HTTPException(403, "Manage access tokens from the app, not with a token")
    return user


@router.get("")
def list_tokens(user: dict = Depends(_session_user)):
    return access_tokens.list_for(user)


@router.post("")
def create_token(body: TokenIn, user: dict = Depends(_session_user)):
    try:
        t = access_tokens.create(user, body.name, body.scope)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    audit.record("token.create", entity_type="access_token", entity_id=t["id"], detail=f"{t['name']} ({t['scope']})")
    return t


@router.delete("/{token_id}")
def revoke_token(token_id: str, user: dict = Depends(_session_user)):
    try:
        access_tokens.revoke(user, token_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    audit.record("token.revoke", entity_type="access_token", entity_id=token_id)
    return {"ok": True}


def _public_url(request: Request) -> str:
    return settings.app_url or (settings.cors_origins[0] if settings.cors_origins else str(request.base_url))


async def _serve(request: Request, token: str):
    user = access_tokens.resolve(token)
    if not user:
        return JSONResponse({"error": "invalid_token", "message": "Invalid or revoked Dashtor access token"}, 401,
                            headers={"WWW-Authenticate": "Bearer"})
    tenant.set_workspace(user["workspace_id"])
    try:
        payload = await request.json()
    except ValueError:
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}, 400)
    api = server.Api(request.app, token, _public_url(request))
    try:
        msgs = payload if isinstance(payload, list) else [payload]
        out = [r for m in msgs if isinstance(m, dict) and (r := await server.handle(m, api, user["scope"] == "read"))]
    finally:
        await api.close()
    if not out:
        return Response(status_code=202)   # notifications only
    return JSONResponse(out if isinstance(payload, list) else out[0])


def _bearer(request: Request) -> str:
    h = request.headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else ""


@mcp_router.post("")
async def mcp(request: Request):
    return await _serve(request, _bearer(request))


@mcp_router.post("/t/{token}")
async def mcp_url_token(token: str, request: Request):
    return await _serve(request, token)


@mcp_router.get("")
@mcp_router.get("/t/{token}")
def mcp_get():
    return Response(status_code=405, headers={"Allow": "POST"})   # stateless server: no server-initiated stream


@mcp_router.delete("")
@mcp_router.delete("/t/{token}")
def mcp_delete():
    return Response(status_code=405, headers={"Allow": "POST"})
