"""Loading a dashboard and all its chart data: shared by the signed-in dashboard page and public share links."""
from __future__ import annotations

import contextvars
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from ..core.store import store
from .engine import engine


def adopt_orphans(d: dict[str, Any]) -> None:
    """Self-healing: a widget on a page the dashboard does not have is invisible (no tab shows it) and leaves a hole where it used to be.
    An older "Edit with AI" saved its new / updated widgets on a page called `main` even when the dashboard's pages were overview,
    breakdown, ... Such widgets move to the first real page; they keep their position, so they fill the gap they were meant for."""
    pages = [p["id"] for p in (d.get("pages") or []) if isinstance(p, dict) and p.get("id")]
    if not pages:
        return
    for w in d["widgets"]:
        if (w.get("page") or "main") not in pages:
            store.update("dashboard_widgets", w["id"], {"page": pages[0]})
            w["page"] = pages[0]


def load(dashboard_id: str) -> dict[str, Any] | None:
    """The dashboard with its widgets, or None."""
    d = store.get("dashboards", dashboard_id)
    if not d:
        return None
    d["widgets"] = store.list("dashboard_widgets", where="dashboard_id = ?", params=[dashboard_id], order="created_at ASC")
    adopt_orphans(d)
    return d


def bundle(dashboard_id: str, fresh: bool = False) -> dict[str, Any]:
    """Every chart widget's chart (spec) and data in ONE call. Queries run concurrently, identical queries run once,
    and one broken widget never blanks the dashboard."""
    ids = list(dict.fromkeys(w["chart_id"] for w in store.list("dashboard_widgets", where="dashboard_id = ?", params=[dashboard_id], order=None) if w.get("chart_id")))

    def one(chart_id: str) -> dict[str, Any]:
        try:
            chart = store.get("charts", chart_id)
            query = store.get("queries", chart["query_id"]) if chart and chart.get("query_id") else None
            if not chart or not query:
                return {"error": "chart or its query no longer exists"}
            return {"chart": chart, "data": engine.execute(query["sql"], fresh=fresh)}
        except Exception as e:
            return {"error": str(e)[:300]}

    with ThreadPoolExecutor(max_workers=min(6, max(len(ids), 1))) as pool:
        futures = {cid: pool.submit(contextvars.copy_context().run, one, cid) for cid in ids}
        return {cid: f.result() for cid, f in futures.items()}
