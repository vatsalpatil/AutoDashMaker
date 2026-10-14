"""Object lifecycle: query -> chart -> dashboard widget, created together and cleaned up together.

Learned from building real dashboards: every widget needed three calls (query, chart, widget), charts made for one dashboard
stayed in the library forever after it was deleted, and deleting a chart left broken widgets behind. These helpers keep the
graph consistent. Every read and write goes through `store`, so it stays inside the caller's workspace.
"""
from __future__ import annotations

from typing import Any

from ..core.store import store
from .engine import engine


def _widgets() -> list[dict[str, Any]]:
    return store.list("dashboard_widgets", order=None)


def usage() -> dict[str, list[str]]:
    """chart id -> ids of the dashboards that show it."""
    out: dict[str, list[str]] = {}
    for w in _widgets():
        if w.get("chart_id") and w["dashboard_id"] not in out.setdefault(w["chart_id"], []):
            out[w["chart_id"]].append(w["dashboard_id"])
    return out


def _drop_query_if_unused(query_id: str | None) -> None:
    if query_id and not store.list("charts", where="query_id = ?", params=[query_id], order=None):
        store.delete("queries", query_id)


def delete_chart(chart_id: str) -> int:
    """Delete a chart, every widget that shows it, and its query when no other chart uses it. Returns widgets removed."""
    chart = store.get("charts", chart_id)
    if not chart:
        return 0
    gone = [w for w in _widgets() if w.get("chart_id") == chart_id]
    for w in gone:
        store.delete("dashboard_widgets", w["id"])
    store.delete("charts", chart_id)
    _drop_query_if_unused(chart.get("query_id"))
    return len(gone)


def delete_dashboard(dashboard_id: str, cleanup: bool = False) -> dict[str, int]:
    """Delete a dashboard and its widgets. With cleanup, charts (and their queries) shown on no other dashboard go too."""
    if not store.get("dashboards", dashboard_id):
        return {"widgets": 0, "charts": 0}
    mine = [w for w in _widgets() if w["dashboard_id"] == dashboard_id]
    for w in mine:
        store.delete("dashboard_widgets", w["id"])
    store.delete("dashboards", dashboard_id)
    removed = 0
    if cleanup:
        used = usage()
        for cid in {w["chart_id"] for w in mine if w.get("chart_id")}:
            if not used.get(cid):
                delete_chart(cid)
                removed += 1
    return {"widgets": len(mine), "charts": removed}


def unused_charts() -> list[dict[str, Any]]:
    used = usage()
    return [{"id": c["id"], "name": c["name"], "type": (c.get("spec") or {}).get("type"), "created_at": c.get("created_at")}
            for c in store.list("charts") if c["id"] not in used]


def create_widget(dashboard_id: str, name: str, sql: str, spec: dict[str, Any], page: str = "main",
                  position: dict[str, float] | None = None) -> dict[str, Any]:
    """Query + chart + widget in one step. The SQL is run first (read-only check, real columns), so a broken widget is never saved."""
    if not store.get("dashboards", dashboard_id):
        raise LookupError("dashboard not found")
    result = engine.execute(sql)
    query = store.insert("queries", {"name": name, "sql": sql.strip().rstrip(";").strip(), "status": "ok",
                                     "row_count": result["row_count"], "duration_ms": result["duration_ms"]})
    chart = store.insert("charts", {"name": name, "query_id": query["id"], "spec": spec})
    if position is None:   # below everything on that page
        y = max((w["position"]["y"] + w["position"]["h"] for w in _widgets()
                 if w["dashboard_id"] == dashboard_id and (w.get("page") or "main") == page and isinstance(w.get("position"), dict)), default=0)
        position = {"x": 0, "y": y, "w": 6, "h": 4}
    widget = store.insert("dashboard_widgets", {"dashboard_id": dashboard_id, "chart_id": chart["id"], "page": page,
                                                "position": position, "kind": "chart"})
    return {"widget": widget, "chart": chart, "query_id": query["id"], "row_count": result["row_count"]}
