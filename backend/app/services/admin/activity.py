"""Activity log: one row per API request (who, what, status, time, IP), for the backoffice.

`ActivityMiddleware` is pure ASGI (SSE streams pass through untouched). The user is read from the bearer token
WITHOUT verifying it: logging only, the route's own auth dependency still decides access. Writes go to one
background thread like services/audit.py, and the table is pruned to MAX_ROWS.
"""
from __future__ import annotations

import base64
import itertools
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor

from ...core import tenant
from ...core.store import store

log = logging.getLogger("activity")
MAX_ROWS = 200_000
_SKIP = ("/api/health", "/api/auth/config")
_counter = itertools.count(1)
_writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="activity")


def _claims(headers: dict[bytes, bytes]) -> dict:
    auth = headers.get(b"authorization", b"").decode(errors="ignore")
    if not auth.lower().startswith("bearer "):
        return {}
    try:
        part = auth[7:].split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    except Exception:
        return {}


def _ip(scope: dict, headers: dict[bytes, bytes]) -> str:
    fwd = headers.get(b"x-forwarded-for", b"").decode(errors="ignore").split(",")[0].strip()
    return fwd or (scope.get("client") or ("", 0))[0]


class ActivityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith("/api/") or path in _SKIP:
            return await self.app(scope, receive, send)
        t0, status = time.perf_counter(), [500]

        async def _send(msg):
            if msg["type"] == "http.response.start":
                status[0] = msg["status"]
            await send(msg)

        try:
            await self.app(scope, receive, _send)
        finally:
            headers = dict(scope.get("headers") or [])
            c = _claims(headers)
            row = {"user_id": c.get("sub") or ("local" if not headers.get(b"authorization") else None), "email": c.get("email"),
                   "method": scope.get("method"), "path": path[:300], "status": status[0],
                   "ms": round((time.perf_counter() - t0) * 1000, 1), "ip": _ip(scope, headers),
                   "user_agent": headers.get(b"user-agent", b"").decode(errors="ignore")[:200]}
            try:
                _writer.submit(_write, row)
            except Exception:
                pass


def _write(row: dict) -> None:
    try:
        with tenant.all_workspaces():
            store.insert("activity_log", row)
            if next(_counter) % 500 == 0:
                store.execute("DELETE FROM activity_log WHERE id IN (SELECT id FROM activity_log ORDER BY created_at DESC OFFSET ?)", [MAX_ROWS])
    except Exception as e:
        log.warning("activity write failed: %s", e)


def flush() -> None:
    _writer.submit(lambda: None).result()


def query(user_id: str | None = None, q: str | None = None, status: str | None = None, limit: int = 200) -> list[dict]:
    clauses, params = [], []
    if user_id:
        clauses.append("user_id = ?")
        params.append(user_id)
    if q:
        clauses.append("(path ILIKE ? OR email ILIKE ? OR ip ILIKE ?)")
        params += [f"%{q}%"] * 3
    if status == "error":
        clauses.append("status >= 400")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return store.execute(f"SELECT * FROM activity_log {where} ORDER BY created_at DESC LIMIT ?", [*params, max(1, min(limit, 2000))])
