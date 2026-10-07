"""Charts: declarative visualization specs + lineage + data endpoint."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from ..core.store import store
from ..services.engine import engine
from ..services.lineage import chart_lineage

router = APIRouter(prefix="/api/charts", tags=["charts"])


class ChartIn(BaseModel):
    name: str
    query_id: str | None = None
    dataset_id: str | None = None
    spec: dict[str, Any]   # {type, encoding:{x,y,color...}, options}


@router.get("")
def list_charts():
    return store.list("charts")


@router.post("")
def create_chart(body: ChartIn):
    return store.insert("charts", body.model_dump())


class ChartPatch(BaseModel):
    name: str | None = None
    query_id: str | None = None
    spec: dict[str, Any] | None = None


@router.patch("/{chart_id}")
def update_chart(chart_id: str, body: ChartPatch):
    """Edit a chart in place (name, backing query, or its whole spec)."""
    if not store.get("charts", chart_id):
        raise HTTPException(404, "chart not found")
    store.update("charts", chart_id, body.model_dump(exclude_none=True))
    return store.get("charts", chart_id)


@router.get("/{chart_id}")
def get_chart(chart_id: str):
    c = store.get("charts", chart_id)
    if not c:
        raise HTTPException(404, "chart not found")
    return c


@router.get("/{chart_id}/data")
def chart_data(chart_id: str):
    """Re-execute the chart's query so widgets always show fresh data."""
    c = store.get("charts", chart_id)
    if not c:
        raise HTTPException(404, "chart not found")
    q = store.get("queries", c.get("query_id") or "") if c.get("query_id") else None
    if not q:
        raise HTTPException(400, "chart has no backing query")
    return engine.execute(q["sql"])


@router.get("/{chart_id}/lineage")
def lineage(chart_id: str):
    out = chart_lineage(chart_id)
    if not out:
        raise HTTPException(404, "chart not found")
    return out


@router.delete("/{chart_id}")
def delete_chart(chart_id: str):
    store.delete("charts", chart_id)
    return {"ok": True}
