"""Workbench agent endpoint (mounted inside /api/ai by ai.py): streams the agent's steps as Server-Sent Events."""
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services import agent, audit

router = APIRouter()


class AgentIn(BaseModel):
    task: str
    mode: str = "agent"                 # agent: may add / edit notebook cells · ask: read-only answers
    history: list[dict] = []            # earlier [{role, content}] turns of this chat
    active_sql: str = ""
    error: str | None = None
    cells: list[dict] = []              # earlier notebook steps, by name
    provider_id: str | None = None


@router.post("/agent")
def run_agent(body: AgentIn):
    """One agent run. Events (one JSON per `data:` line): step, observation, action, final, error."""
    if not body.task.strip():
        raise HTTPException(400, "tell the agent what to do")
    mode = "agent" if body.mode == "agent" else "ask"
    ctx = agent.context(body.active_sql, body.error, body.cells, mode)

    def stream():
        steps = 0
        try:
            for ev in agent.run(body.task.strip(), body.history, mode, ctx, body.provider_id):
                steps += ev["type"] == "step"
                yield f"data: {json.dumps(ev, default=str)}\n\n"
        except Exception as e:  # never leave the stream hanging: the UI needs a terminal event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)[:300]})}\n\n"
        audit.record("ai.agent", detail=f"{body.task[:160]} | {steps} steps", status="ok")

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
