"""Lineage: dashboard -> widget -> chart -> query -> dataset -> source."""
from __future__ import annotations

from typing import Any

from ..core.store import store


def chart_lineage(chart_id: str) -> dict[str, Any]:
    chart = store.get("charts", chart_id)
    if not chart:
        return {}
    query = store.get("queries", chart.get("query_id") or "") if chart.get("query_id") else None
    dataset = store.get("datasets", chart.get("dataset_id") or "") if chart.get("dataset_id") else None
    source = store.get("datasources", dataset["source_id"]) if dataset and dataset.get("source_id") else None
    quality = store.list("quality_runs", where="dataset_id = ?",
                         params=[dataset["id"]], order="created_at DESC")[:1] if dataset else []
    return {
        "chart": {"id": chart["id"], "name": chart["name"], "spec": chart["spec"]},
        "query": query and {"id": query["id"], "sql": query["sql"], "duration_ms": query["duration_ms"]},
        "dataset": dataset and {"id": dataset["id"], "name": dataset["name"], "row_count": dataset["row_count"]},
        "source": source and {"id": source["id"], "name": source["name"], "type": source["type"]},
        "data_quality": quality[0] if quality else None,
    }


def dashboard_lineage(dashboard_id: str) -> dict[str, Any]:
    widgets = store.list("dashboard_widgets", where="dashboard_id = ?",
                         params=[dashboard_id], order="created_at ASC")
    return {
        "dashboard_id": dashboard_id,
        "widgets": [chart_lineage(w["chart_id"]) for w in widgets if w.get("chart_id")],
    }
