"""A Model Context Protocol server (Streamable HTTP, stateless JSON responses) so the user's own AI can drive Dashtor.

No SDK: MCP over HTTP is JSON-RPC 2.0 posted to one URL; we answer `initialize`, `ping`, `tools/list`, `tools/call`.
Tool calls go through the app's own REST API in-process (`Api`), authenticated with the user's access token, so the
AI can do exactly what the user can do and nothing more.
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from .tools import GUIDE, TOOLS

PROTOCOL = "2025-06-18"
MAX_TEXT = 60_000          # characters per tool result: keeps the user's AI context (and bill) small
BLOCKED = ("/api/admin", "/api/account", "/api/access-tokens", "/api/verify", "/api/auth")
_BY_NAME = {t[0]: t for t in TOOLS}


class ApiError(Exception):
    pass


class Api:
    """Calls the FastAPI app in-process as the token's user."""

    def __init__(self, app: Any, token: str, public_url: str):
        self.app, self.public_url = app, public_url.rstrip("/")
        self._client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://mcp.internal",
                                         headers={"Authorization": f"Bearer {token}"}, timeout=300)

    async def request(self, method: str, path: str, body: Any = None, query: dict | None = None, transform=None) -> Any:
        method = method.upper()
        if not path.startswith("/api/") or path.startswith(BLOCKED) or ".." in path:
            raise ApiError(f"Path not allowed: {path}")
        r = await self._client.request(method, path, json=body if method in ("POST", "PUT", "PATCH") else None, params=query)
        try:
            data = r.json()
        except ValueError:
            data = r.text
        if r.status_code >= 400:
            detail = data.get("detail", data) if isinstance(data, dict) else data
            raise ApiError(f"{r.status_code}: {detail}")
        return transform(data) if transform else data

    def get(self, path: str, query: dict | None = None, transform=None):
        return self.request("GET", path, None, query, transform)

    def post(self, path: str, body: Any = None):
        return self.request("POST", path, body)

    def endpoints(self, words: str = "") -> list[dict]:
        want = [w.lower() for w in words.split()]
        out = []
        for path, ops in self.app.openapi().get("paths", {}).items():
            if not path.startswith("/api/") or path.startswith(BLOCKED):
                continue
            for method, op in ops.items():
                line = f"{method} {path} {op.get('summary', '')}".lower()
                if all(w in line for w in want):
                    out.append({"method": method.upper(), "path": path, "summary": op.get("summary", "")})
        return out[:150]

    async def close(self):
        await self._client.aclose()


def _tool_list(read_only: bool) -> list[dict]:
    return [{"name": n, "description": d, "inputSchema": s, "annotations": {"readOnlyHint": ro}}
            for n, d, s, _, ro in TOOLS if ro or not read_only]


def _text(v: Any) -> str:
    s = v if isinstance(v, str) else json.dumps(v, default=str, ensure_ascii=False)
    return s if len(s) <= MAX_TEXT else s[:MAX_TEXT] + f"\n... [truncated {len(s) - MAX_TEXT} chars; ask for fewer rows]"


async def handle(msg: dict, api: Api, read_only: bool) -> dict | None:
    """One JSON-RPC message -> its response (None for notifications)."""
    mid, method, params = msg.get("id"), msg.get("method", ""), msg.get("params") or {}
    if mid is None:
        return None  # notifications/initialized etc.

    def ok(result: dict) -> dict:
        return {"jsonrpc": "2.0", "id": mid, "result": result}

    if method == "initialize":
        return ok({"protocolVersion": params.get("protocolVersion") or PROTOCOL,
                   "capabilities": {"tools": {"listChanged": False}},
                   "serverInfo": {"name": "dashtor", "title": "Dashtor", "version": "1.0.0"},
                   "instructions": GUIDE})
    if method == "ping":
        return ok({})
    if method == "tools/list":
        return ok({"tools": _tool_list(read_only)})
    if method == "tools/call":
        tool = _BY_NAME.get(params.get("name", ""))
        if not tool or (read_only and not tool[4]):
            return ok({"content": [{"type": "text", "text": f"Unknown or not-allowed tool: {params.get('name')}"}], "isError": True})
        try:
            result = await tool[3](api, params.get("arguments") or {})
            return ok({"content": [{"type": "text", "text": _text(result)}], "isError": False})
        except (ApiError, KeyError, ValueError, TypeError) as e:
            return ok({"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True})
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {method}"}}
