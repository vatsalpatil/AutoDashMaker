"""Personal access tokens: let the user's OWN AI (Claude, ChatGPT, Cursor, Kimi, DeepSeek, Grok...) drive their workspace.

A token is `dtr_<random>`; only its SHA-256 is stored, so a database leak does not leak working tokens. A token acts as the
user who made it, in that user's workspace, through the normal API (core/auth.py accepts it as a Bearer token) and the
MCP server (/mcp). Scope `read` blocks every non-GET call.
"""
from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from ..core import tenant
from ..core.store import store

PREFIX = "dtr_"
MAX_PER_USER = 20
SCOPES = ("full", "read")
_cache: dict[str, tuple[float, dict | None]] = {}   # hash -> (expires, row): resolve() runs on every MCP call
_TTL = 30.0


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def looks_like(token: str | None) -> bool:
    return bool(token) and token.startswith(PREFIX) and len(token) < 128


def create(user: dict, name: str, scope: str = "full") -> dict[str, Any]:
    if scope not in SCOPES:
        raise ValueError(f"scope must be one of {SCOPES}")
    if len(list_for(user)) >= MAX_PER_USER:
        raise ValueError(f"At most {MAX_PER_USER} tokens; revoke an old one first.")
    token = PREFIX + secrets.token_urlsafe(32)
    row = store.insert("access_tokens", {"user_id": user["id"], "email": user.get("email", ""), "name": (name or "My AI")[:80],
                                         "token_hash": _hash(token), "prefix": token[:10], "scope": scope, "revoked": False})
    return {**_public(row), "token": token}   # the only time the plain token is ever returned


def list_for(user: dict) -> list[dict[str, Any]]:
    rows = store.list("access_tokens", where="user_id = ? AND NOT revoked", params=[user["id"]])
    return [_public(r) for r in rows]


def revoke(user: dict, token_id: str) -> None:
    row = store.get("access_tokens", token_id)
    if not row or row["user_id"] != user["id"]:
        raise LookupError("token not found")
    store.update("access_tokens", token_id, {"revoked": True, "updated_at": datetime.now(timezone.utc)})
    _cache.clear()


def resolve(token: str) -> dict | None:
    """The user a token acts as ({id, email, workspace_id, scope, token_id}), or None. Any workspace."""
    if not looks_like(token):
        return None
    h = _hash(token)
    hit = _cache.get(h)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    with tenant.all_workspaces():
        rows = store.execute("SELECT * FROM access_tokens WHERE token_hash = ? AND NOT revoked", [h])
        if rows:
            store.execute("UPDATE access_tokens SET last_used_at = ? WHERE id = ?", [datetime.now(timezone.utc), rows[0]["id"]])
    r = rows[0] if rows else None
    user = {"id": r["user_id"], "email": r["email"], "workspace_id": r["workspace_id"], "role": "authenticated",
            "email_verified": True, "scope": r["scope"], "token_id": r["id"]} if r else None
    _cache[h] = (time.monotonic() + _TTL, user)
    return user


def _public(r: dict) -> dict[str, Any]:
    return {k: r.get(k) for k in ("id", "name", "prefix", "scope", "last_used_at", "created_at")}
