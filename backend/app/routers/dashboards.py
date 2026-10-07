"""Dashboards: collections of chart widgets with positions + lineage."""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store
from ..services.lineage import dashboard_lineage
from ..services.generate import generate_dashboard
from ..services.brief import dashboard_brief


class GenerateIn(BaseModel):
    dataset_id: str
    name: str | None = None


router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


@router.post("/generate")
def generate(body: GenerateIn):
    """One-click dashboard from a dataset's schema profile (§22)."""
    ds = store.get("datasets", body.dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    return generate_dashboard(ds, body.name)


class DashboardIn(BaseModel):
    name: str
    description: str = ""
    pages: list[dict[str, str]] | None = None  # [{"id": "main", "name": "Overview"}]


class LayoutIn(BaseModel):
    layout: list[dict[str, Any]]


class WidgetIn(BaseModel):
    chart_id: str | None = None
    kind: str = "chart"           # chart | section | text | link | iframe
    title: str | None = None      # for section / content widgets
    settings: dict[str, Any] | None = None   # content widgets: {content} (markdown), {url, description}
    page: str = "main"
    position: dict[str, int] = {"x": 0, "y": 0, "w": 6, "h": 4}


class PagesIn(BaseModel):
    pages: list[dict[str, str]]   # [{id, name}]


@router.get("")
def list_dashboards():
    return store.list("dashboards")


@router.post("")
def create_dashboard(body: DashboardIn):
    return store.insert("dashboards", body.model_dump())


@router.get("/{dashboard_id}")
def get_dashboard(dashboard_id: str):
    d = store.get("dashboards", dashboard_id)
    if not d:
        raise HTTPException(404, "dashboard not found")
    d["widgets"] = store.list("dashboard_widgets",
                              where="dashboard_id = ?", params=[dashboard_id],
                              order="created_at ASC")
    return d


@router.patch("/{dashboard_id}")
def update_dashboard(dashboard_id: str, body: DashboardIn):
    store.update("dashboards", dashboard_id,
                 {k: v for k, v in body.model_dump().items() if v is not None})
    return store.get("dashboards", dashboard_id)


@router.put("/{dashboard_id}/layout")
def save_layout(dashboard_id: str, body: LayoutIn):
    """Persist grid edits: update each widget's position (and page) by id."""
    if not store.get("dashboards", dashboard_id):
        raise HTTPException(404, "dashboard not found")
    updated = 0
    for item in body.layout:
        wid = item.get("id")
        if not wid:
            continue
        fields: dict[str, Any] = {}
        pos = {k: item[k] for k in ("x", "y", "w", "h") if k in item}
        if pos:
            fields["position"] = pos
        if item.get("page"):
            fields["page"] = item["page"]
        if fields:
            try:
                store.update("dashboard_widgets", wid, fields)
                updated += 1
            except Exception:
                pass
    return {"ok": True, "updated": updated}


@router.put("/{dashboard_id}/pages")
def save_pages(dashboard_id: str, body: PagesIn):
    """Multi-page dashboards: [{id, name}]. Widgets carry a page id."""
    if not store.get("dashboards", dashboard_id):
        raise HTTPException(404, "dashboard not found")
    store.update("dashboards", dashboard_id, {"pages": body.pages})
    return {"ok": True, "pages": body.pages}


@router.post("/{dashboard_id}/widgets")
def add_widget(dashboard_id: str, body: WidgetIn):
    if not store.get("dashboards", dashboard_id):
        raise HTTPException(404, "dashboard not found")
    return store.insert("dashboard_widgets",
                        {"dashboard_id": dashboard_id, **body.model_dump()})


class WidgetPatch(BaseModel):
    settings: dict[str, Any] | None = None
    title: str | None = None
    position: dict[str, int] | None = None
    page: str | None = None


@router.patch("/{dashboard_id}/widgets/{widget_id}")
def patch_widget(dashboard_id: str, widget_id: str, body: WidgetPatch):
    """Per-widget display settings (fonts, colors, legend, formats…)."""
    w = store.get("dashboard_widgets", widget_id)
    if not w or w.get("dashboard_id") != dashboard_id:
        raise HTTPException(404, "widget not found")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.settings is not None:
        # merge with existing settings so partial updates work
        fields["settings"] = {**(w.get("settings") or {}), **body.settings}
    if fields:
        store.update("dashboard_widgets", widget_id, fields)
    return store.get("dashboard_widgets", widget_id)


@router.delete("/{dashboard_id}/widgets/{widget_id}")
def remove_widget(dashboard_id: str, widget_id: str):
    store.delete("dashboard_widgets", widget_id)
    return {"ok": True}


@router.get("/{dashboard_id}/lineage")
def lineage(dashboard_id: str):
    return dashboard_lineage(dashboard_id)


@router.get("/{dashboard_id}/brief")
def brief(dashboard_id: str):
    """Decision brief: findings + attention items from live re-execution (§68)."""
    out = dashboard_brief(dashboard_id)
    if not out:
        raise HTTPException(404, "dashboard not found")
    return out


@router.post("/{dashboard_id}/duplicate")
def duplicate_dashboard(dashboard_id: str):
    """Copy a dashboard with all its widgets and pages (the charts themselves are shared, not copied)."""
    src = store.get("dashboards", dashboard_id)
    if not src:
        raise HTTPException(404, "dashboard not found")
    copy = store.insert("dashboards", {"name": f"{src['name']} (copy)", "description": src.get("description") or "", "pages": src.get("pages")})
    for w in store.list("dashboard_widgets", where="dashboard_id = ?", params=[dashboard_id], order="created_at ASC"):
        store.insert("dashboard_widgets", {k: w.get(k) for k in ("chart_id", "kind", "title", "page", "position", "settings", "refresh_policy") if w.get(k) is not None} | {"dashboard_id": copy["id"]})
    return copy


@router.delete("/{dashboard_id}")
def delete_dashboard(dashboard_id: str):
    store.delete("dashboards", dashboard_id)
    store.execute("DELETE FROM dashboard_widgets WHERE dashboard_id = ?", [dashboard_id])
    return {"ok": True}
