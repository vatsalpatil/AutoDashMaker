"""AI dashboards: create one from a description, or edit an existing one by chatting."""
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core.security import UnsafeQueryError
from ..services import ai as ai_svc, audit, dash_ai, dash_gen
from ..services.dash_templates import template_list

router = APIRouter(prefix="/api/dashboards", tags=["dashboards-ai"])


class CreateIn(BaseModel):
    prompt: str
    dataset_id: str | None = None     # None = the AI may use every table
    provider_id: str | None = None


class EditIn(BaseModel):
    instruction: str
    provider_id: str | None = None


@router.post("/ai/create")
def ai_create(body: CreateIn):
    if not body.prompt.strip():
        raise HTTPException(400, "describe the dashboard you want")
    try:
        out = dash_ai.create_dashboard(body.prompt.strip(), body.dataset_id, body.provider_id)
    except ai_svc.AIError as e:
        return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": str(e)}
    except UnsafeQueryError as e:
        audit.record("dashboard.ai", detail=f"blocked: {e}", status="blocked")
        raise HTTPException(400, f"AI produced unsafe SQL: {e}")
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("dashboard.ai", entity_type="dashboard", entity_id=out["dashboard_id"], detail=f"created from: {body.prompt[:200]}")
    return {"status": "ok", **out}


@router.post("/{dashboard_id}/ai-edit")
def ai_edit(dashboard_id: str, body: EditIn):
    if not body.instruction.strip():
        raise HTTPException(400, "tell me what to change")
    try:
        out = dash_ai.edit_dashboard(dashboard_id, body.instruction.strip(), body.provider_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ai_svc.AIError as e:
        return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": str(e)}
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("dashboard.ai", entity_type="dashboard", entity_id=dashboard_id, detail=f"edit: {body.instruction[:200]} -> {out['applied']}")
    return {"status": "ok", **out}


class GenerateIn(BaseModel):
    dataset_id: str
    template: str = "auto"
    focus: str = ""
    name: str | None = None
    provider_id: str | None = None


@router.get("/ai/templates")
def templates():
    return template_list()


@router.post("/generate")
def generate(body: GenerateIn):
    """Multi-page dashboard from a dataset, written by the AI provider (no AI provider = nothing is generated)."""
    try:
        out = dash_gen.generate(body.dataset_id, body.template, body.focus, body.provider_id, body.name)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ai_svc.AIError as e:
        return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": str(e)}
    except UnsafeQueryError as e:
        raise HTTPException(400, f"AI produced unsafe SQL: {e}")
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("dashboard.ai", entity_type="dashboard", entity_id=out["dashboard_id"], detail=f"generated ({body.template}) from dataset {body.dataset_id}")
    return {"status": "ok", **out}


@router.post("/generate/stream")
def generate_stream(body: GenerateIn):
    """Same as /generate, but the process is streamed as Server-Sent Events: step, widget, done, error."""
    def stream():
        try:
            for ev in dash_gen.run(body.dataset_id, body.template, body.focus, body.provider_id, body.name):
                if ev["type"] == "done":
                    audit.record("dashboard.ai", entity_type="dashboard", entity_id=ev["dashboard_id"], detail=f"generated ({body.template}) from dataset {body.dataset_id}")
                yield f"data: {json.dumps(ev, default=str)}\n\n"
        except Exception as e:  # the UI needs a terminal event, whatever went wrong
            kind = "no_provider" if "No AI provider" in str(e) else "error"
            yield f"data: {json.dumps({'type': 'error', 'kind': kind, 'message': str(e)[:400]})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
