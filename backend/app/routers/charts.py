"""Charts: declarative visualization specs + lineage + data endpoint."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from ..core.store import store
from ..services import lifecycle
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
    used = lifecycle.usage()   # how many dashboards show each chart (0 = a leftover you can clean up)
    return [{**c, "used_in": len(used.get(c["id"], []))} for c in store.list("charts")]


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
def chart_data(chart_id: str, fresh: bool = False):
    """Run the chart's query (cached for a few minutes; `fresh=true` bypasses the cache)."""
    c = store.get("charts", chart_id)
    if not c:
        raise HTTPException(404, "chart not found")
    q = store.get("queries", c.get("query_id") or "") if c.get("query_id") else None
    if not q:
        raise HTTPException(400, "chart has no backing query")
    return engine.execute(q["sql"], fresh=fresh)


@router.get("/{chart_id}/lineage")
def lineage(chart_id: str):
    out = chart_lineage(chart_id)
    if not out:
        raise HTTPException(404, "chart not found")
    return out


@router.delete("/{chart_id}")
def delete_chart(chart_id: str):
    """Delete a chart, the widgets that show it (no broken widgets left behind) and its query if nothing else uses it."""
    return {"ok": True, "widgets_removed": lifecycle.delete_chart(chart_id)}


@router.get("/unused/list")
def unused_charts():
    """Charts that are on no dashboard (left over from generations, experiments, deleted dashboards)."""
    return lifecycle.unused_charts()


class CleanupIn(BaseModel):
    ids: list[str]


@router.post("/unused/cleanup")
def cleanup_unused(body: CleanupIn):
    unused = {c["id"] for c in lifecycle.unused_charts()}
    removed = [cid for cid in body.ids if cid in unused]   # only charts that really are unused
    for cid in removed:
        lifecycle.delete_chart(cid)
    return {"removed": len(removed)}
