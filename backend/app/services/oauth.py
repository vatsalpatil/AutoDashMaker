"""OAuth 2.1 for the MCP server, so claude.ai / ChatGPT / any MCP app can "Connect" with a sign-in instead of a pasted token.

Minimal authorization server (MCP spec 2025-06-18): dynamic client registration, authorization code + PKCE (S256 only),
public clients. Stateless clients: the client_id IS the encrypted registration (secrets_box key), so no table and
restarts lose nothing. Codes live in memory for 10 minutes (one backend process). The access token handed out is an
ordinary personal access token (services/access_tokens.py), so it shows in Settings → Connect your AI and can be revoked.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
from typing import Any
from urllib.parse import urlencode, urlparse

from cryptography.fernet import InvalidToken

from ..core.secrets_box import _fernet
from . import access_tokens

CODE_TTL = 600
_codes: dict[str, dict[str, Any]] = {}


class OAuthError(Exception):
    def __init__(self, error: str, description: str):
        super().__init__(description)
        self.error, self.description = error, description


def _ok_redirect(uri: str) -> bool:
    u = urlparse(uri)
    local = u.hostname in ("localhost", "127.0.0.1", "::1")
    return (u.scheme == "https" or (u.scheme == "http" and local)) and bool(u.netloc) and not u.fragment


def register(body: dict) -> dict:
    uris = body.get("redirect_uris") or []
    if not isinstance(uris, list) or not uris or not all(isinstance(u, str) and _ok_redirect(u) for u in uris):
        raise OAuthError("invalid_redirect_uri", "redirect_uris must be https URLs (http only for localhost)")
    name = str(body.get("client_name") or "AI assistant")[:80]
    client = {"n": name, "r": uris[:10], "t": int(time.time())}
    client_id = _fernet().encrypt(json.dumps(client).encode()).decode()
    return {"client_id": client_id, "client_name": name, "redirect_uris": client["r"], "grant_types": ["authorization_code"],
            "response_types": ["code"], "token_endpoint_auth_method": "none", "client_id_issued_at": client["t"]}


def client(client_id: str) -> dict:
    try:
        c = json.loads(_fernet().decrypt(client_id.encode()))
    except (InvalidToken, ValueError):
        raise OAuthError("invalid_client", "Unknown client; register again") from None
    return {"name": c["n"], "redirect_uris": c["r"]}


def check_request(p: dict) -> dict:
    """Validate an /authorize request; returns the client. Raises before any redirect to an unverified URI."""
    c = client(p.get("client_id", ""))
    if p.get("redirect_uri") not in c["redirect_uris"]:
        raise OAuthError("invalid_request", "redirect_uri is not registered for this client")
    if p.get("response_type") != "code":
        raise OAuthError("unsupported_response_type", "only response_type=code")
    if not p.get("code_challenge") or p.get("code_challenge_method", "S256") != "S256":
        raise OAuthError("invalid_request", "PKCE with S256 is required")
    return c


def approve(user: dict, p: dict, scope: str) -> str:
    """The signed-in user said yes: mint a code and return the client's redirect URL."""
    c = check_request(p)
    code = secrets.token_urlsafe(32)
    _codes[code] = {"user": {"id": user["id"], "email": user.get("email", ""), "workspace_id": user["workspace_id"]},
                    "client_id": p["client_id"], "name": c["name"], "redirect_uri": p["redirect_uri"],
                    "challenge": p["code_challenge"], "scope": scope, "exp": time.time() + CODE_TTL}
    for k in [k for k, v in _codes.items() if v["exp"] < time.time()]:
        _codes.pop(k, None)
    q = {"code": code, **({"state": p["state"]} if p.get("state") else {})}
    return p["redirect_uri"] + ("&" if "?" in p["redirect_uri"] else "?") + urlencode(q)


def deny_url(p: dict) -> str:
    check_request(p)
    q = {"error": "access_denied", **({"state": p["state"]} if p.get("state") else {})}
    return p["redirect_uri"] + ("&" if "?" in p["redirect_uri"] else "?") + urlencode(q)


def exchange(form: dict) -> dict:
    if form.get("grant_type") != "authorization_code":
        raise OAuthError("unsupported_grant_type", "only authorization_code")
    g = _codes.pop(form.get("code", ""), None)   # single use, even when the checks below fail
    if not g or g["exp"] < time.time():
        raise OAuthError("invalid_grant", "code is invalid or expired")
    if form.get("client_id") and form["client_id"] != g["client_id"]:
        raise OAuthError("invalid_grant", "code was issued to another client")
    if form.get("redirect_uri") and form["redirect_uri"] != g["redirect_uri"]:
        raise OAuthError("invalid_grant", "redirect_uri mismatch")
    verifier = form.get("code_verifier", "")
    digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    if not verifier or not secrets.compare_digest(digest, g["challenge"]):
        raise OAuthError("invalid_grant", "PKCE verification failed")
    from ..core import tenant
    with tenant.use(g["user"]["workspace_id"]):
        t = access_tokens.create(g["user"], f"{g['name']} (connected)", g["scope"])
    return {"access_token": t["token"], "token_type": "Bearer", "scope": g["scope"]}
