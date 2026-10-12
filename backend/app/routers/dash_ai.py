"""AI dashboards: create one from a description, or edit an existing one by chatting."""
import contextvars
import json
import queue
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core.security import UnsafeQueryError
from ..services import ai as ai_svc, ai_vision, audit, dash_ai, dash_create, dash_edit, dash_gen, dash_plan, live
from ..services.ai_errors import friendly
from ..services.dash_templates import template_list

PING_SECONDS = 8

router = APIRouter(prefix="/api/dashboards", tags=["dashboards-ai"])


class CreateIn(BaseModel):
    prompt: str
    dataset_id: str | None = None     # None = the AI may use every table
    provider_id: str | None = None
    images: list[str] = []            # attached pictures (data URLs) the model should read


class EditIn(BaseModel):
    instruction: str
    provider_id: str | None = None
    history: list[dict] = []        # earlier turns [{role: user|assistant, text}] so 'it' / 'that chart' make sense
    page: str | None = None         # the page the user is looking at: new widgets go there
    images: list[str] = []            # attached pictures (data URLs) the model should read


@router.post("/ai/create")
def ai_create(body: CreateIn):
    _images(body)
    if not body.prompt.strip():
        raise HTTPException(400, "describe the dashboard you want")
    try:
        out = dash_ai.create_dashboard(body.prompt.strip(), body.dataset_id, body.provider_id)
    except ai_svc.AIError as e:
        return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": friendly(e)}
    except UnsafeQueryError as e:
        audit.record("dashboard.ai", detail=f"blocked: {e}", status="blocked")
        raise HTTPException(400, f"AI produced unsafe SQL: {e}")
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("dashboard.ai", entity_type="dashboard", entity_id=out["dashboard_id"], detail=f"created from: {body.prompt[:200]}")
    return {"status": "ok", **out}


@router.post("/{dashboard_id}/ai-edit")
def ai_edit(dashboard_id: str, body: EditIn):
    _images(body)
    if not body.instruction.strip():
        raise HTTPException(400, "tell me what to change")
    try:
        out = dash_ai.edit_dashboard(dashboard_id, body.instruction.strip(), body.provider_id, body.history, body.page)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ai_svc.AIError as e:
        return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": friendly(e)}
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
        return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": friendly(e)}
    except UnsafeQueryError as e:
        raise HTTPException(400, f"AI produced unsafe SQL: {e}")
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("dashboard.ai", entity_type="dashboard", entity_id=out["dashboard_id"], detail=f"generated ({body.template}) from dataset {body.dataset_id}")
    return {"status": "ok", **out}


def _images(body) -> None:
    try:
        ai_vision.use(getattr(body, "images", None))
    except ValueError as e:
        raise HTTPException(400, str(e))


def _sse(events, on_done=None):
    """Server-Sent Events over a phase generator.

    The generator runs in a worker thread (with this request's context, so the per-user workspace holds) and the response
    sends a `: ping` comment every few seconds while the model is thinking, so proxies do not drop a silent connection.
    Always ends with a done/error event so the UI never hangs."""
    ctx = contextvars.copy_context()
    q: queue.Queue = queue.Queue()

    def work():
        live.sink.set(q.put)   # the model's thinking / answer stream into this response while the phase runs
        try:
            for ev in events():
                if ev["type"] == "done" and on_done:
                    on_done(ev)
                q.put(ev)
        except Exception as e:
            kind = "no_provider" if "No AI provider" in str(e) else "error"
            q.put({"type": "error", "kind": kind, "message": friendly(e)[:400]})
        q.put(None)

    threading.Thread(target=lambda: ctx.run(work), daemon=True).start()

    def stream():
        while True:
            try:
                ev = q.get(timeout=PING_SECONDS)
            except queue.Empty:
                yield ": ping\n\n"
                continue
            if ev is None:
                return
            yield f"data: {json.dumps(ev, default=str)}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class UnderstandIn(BaseModel):
    dataset_id: str
    template: str = "auto"
    focus: str = ""
    provider_id: str | None = None
    images: list[str] = []            # attached pictures (data URLs) the model should read


class PlanIn(UnderstandIn):
    understanding: str = ""
    answers: dict[str, str] = {}      # question text -> the user's answer
    feedback: str = ""                # revise the previous plan
    previous: list[str] = []          # titles of the previous plan
    name: str | None = None


class BuildIn(BaseModel):
    dataset_id: str
    name: str
    pages: list[dict[str, str]]
    widgets: list[dict]               # the plan's widgets the user kept
    provider_id: str | None = None


@router.post("/generate/understand")
def generate_understand(body: UnderstandIn):
    """Phase 1 (SSE): profile + statistics + top rows -> what the AI understood and the questions it wants answered."""
    _images(body)
    return _sse(lambda: dash_plan.understand(body.dataset_id, body.template, body.focus, body.provider_id))


@router.post("/generate/plan")
def generate_plan(body: PlanIn):
    """Phase 2 (SSE): the widget plan from the understanding, the user's answers and optional feedback."""
    _images(body)
    return _sse(lambda: dash_plan.plan(body.dataset_id, body.template, body.focus, body.understanding, body.answers, body.feedback, body.previous, body.provider_id, body.name))


@router.post("/generate/build")
def generate_build(body: BuildIn):
    """Phase 3 (SSE): validate, run and save the plan; ends with `done` (dashboard id, insights, suggested improvements)."""
    return _sse(lambda: dash_gen.build(body.dataset_id, body.name, body.pages, body.widgets, body.provider_id),
                lambda ev: audit.record("dashboard.ai", entity_type="dashboard", entity_id=ev["dashboard_id"], detail=f"generated from dataset {body.dataset_id}"))


@router.post("/ai/create/stream")
def ai_create_stream(body: CreateIn):
    """Create with AI (SSE): read → design → build & check → self-review → insights → save, each phase reported live."""
    _images(body)
    if not body.prompt.strip():
        raise HTTPException(400, "describe the dashboard you want")
    return _sse(lambda: dash_create.create_stream(body.prompt.strip(), body.dataset_id, body.provider_id),
                lambda ev: audit.record("dashboard.ai", entity_type="dashboard", entity_id=ev["dashboard_id"], detail=f"created from: {body.prompt[:200]}"))


@router.post("/{dashboard_id}/ai-edit/stream")
def ai_edit_stream(dashboard_id: str, body: EditIn):
    """Edit with AI (SSE): read → plan → apply & check (self-correcting) → verify layout; ends with `done` (applied, next ideas, can_undo)."""
    _images(body)
    if not body.instruction.strip():
        raise HTTPException(400, "tell me what to change")
    return _sse(lambda: dash_edit.edit_stream(dashboard_id, body.instruction.strip(), body.provider_id, body.history, body.page),
                lambda ev: audit.record("dashboard.ai", entity_type="dashboard", entity_id=dashboard_id, detail=f"edit: {body.instruction[:200]} -> {ev['applied']}"))


@router.post("/{dashboard_id}/ai-edit/undo")
def ai_edit_undo(dashboard_id: str):
    """Restore the dashboard to how it was before the last AI edit."""
    try:
        out = dash_edit.undo(dashboard_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    audit.record("dashboard.ai", entity_type="dashboard", entity_id=dashboard_id, detail="undo AI edit")
    return out
