"""Conversational analyst endpoints (mounted inside /api/ai by ai.py)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.security import UnsafeQueryError
from ..services import ai as ai_svc, analyst, audit

router = APIRouter()


class ChatIn(BaseModel):
    question: str
    dataset_id: str | None = None     # None = the analyst may use every table
    provider_id: str | None = None
    history: list[dict] = []          # previous [{question, sql}] turns
    cells: list[dict] = []            # notebook steps the question may refer to by name


@router.get("/suggestions")
def suggestions(dataset_id: str | None = None):
    return {"questions": analyst.starter_questions(dataset_id)}


@router.post("/chat")
def chat(body: ChatIn):
    """One turn of the analyst: SQL, result, suggested chart, plain-language summary and follow-up ideas."""
    if not body.question.strip():
        raise HTTPException(400, "ask a question first")
    try:
        out = analyst.answer(body.question, body.history, body.dataset_id, body.provider_id, body.cells)
    except UnsafeQueryError as e:
        audit.record("ai.chat", detail=f"Q: {body.question} | blocked: {e}", status="blocked")
        raise HTTPException(400, f"AI generated unsafe SQL: {e}")
    except ai_svc.AIError as e:
        return {"status": "no_provider", "detail": str(e)}
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("ai.chat", detail=f"Q: {body.question} | {out.get('sql') or out['status']}", status="ok" if out["status"] == "ok" else out["status"])
    return out
