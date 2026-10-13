"""Saved AI chats (mounted inside /api/ai by ai.py): Generate-with-AI sessions, Ask threads, Edit-with-AI chats per dashboard.

The browser autosaves a chat's whole state as JSON; it can be listed, reopened later (on any device), renamed and deleted."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store

router = APIRouter()
KINDS = {"generate", "ask", "edit", "create"}
MAX_STATE = 4_000_000   # characters of JSON per chat


class SessionIn(BaseModel):
    kind: str
    title: str = "Untitled chat"
    ref_id: str | None = None        # e.g. the dashboard an Edit-with-AI chat belongs to
    summary: str = ""
    state: dict = {}


class SessionPatch(BaseModel):
    title: str | None = None
    summary: str | None = None
    state: dict | None = None


def _check(state: dict | None) -> str | None:
    if state is None:
        return None
    raw = json.dumps(state, default=str)
    if len(raw) > MAX_STATE:
        raise HTTPException(413, "This chat is too large to save (remove some images).")
    return raw


@router.get("/sessions")
def list_sessions(kind: str | None = None, ref_id: str | None = None, limit: int = 50):
    where, params = [], []
    if kind:
        where.append("kind = ?"); params.append(kind)
    if ref_id:
        where.append("ref_id = ?"); params.append(ref_id)
    rows = store.list("ai_sessions", where=" AND ".join(where), params=params, order="updated_at DESC")[:max(1, min(limit, 200))]
    return [{k: r.get(k) for k in ("id", "kind", "ref_id", "title", "summary", "created_at", "updated_at")} for r in rows]


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    row = store.get("ai_sessions", session_id)
    if not row:
        raise HTTPException(404, "chat not found")
    row["state"] = json.loads(row["state"]) if isinstance(row.get("state"), str) else (row.get("state") or {})
    return row


@router.post("/sessions")
def create_session(body: SessionIn):
    if body.kind not in KINDS:
        raise HTTPException(400, "unknown chat kind")
    row = store.insert("ai_sessions", {"kind": body.kind, "ref_id": body.ref_id, "title": body.title.strip()[:120] or "Untitled chat",
                                       "summary": body.summary[:300], "state": _check(body.state) or "{}"})
    return {"id": row["id"]}


@router.put("/sessions/{session_id}")
def update_session(session_id: str, body: SessionPatch):
    if not store.get("ai_sessions", session_id):
        raise HTTPException(404, "chat not found")
    patch: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.title is not None:
        patch["title"] = body.title.strip()[:120] or "Untitled chat"
    if body.summary is not None:
        patch["summary"] = body.summary[:300]
    if body.state is not None:
        patch["state"] = _check(body.state)
    store.update("ai_sessions", session_id, patch)
    return {"ok": True}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    store.delete("ai_sessions", session_id)
    return {"ok": True}
