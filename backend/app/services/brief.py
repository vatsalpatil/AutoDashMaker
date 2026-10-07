"""Decision brief generation (§68): turn a dashboard into readable findings.

Deterministic: re-runs each widget's query, summarizes KPI values, trends,
and active alerts. Optionally polished by the configured LLM — but the
numbers always come from execution, never from the model.
"""
from __future__ import annotations

from typing import Any

from ..core.store import store
from .engine import engine
from .insights import detect_insights


def _first_numeric_col(columns: list[str], rows: list[dict]) -> str | None:
    for c in columns:
        if rows and isinstance(rows[0].get(c), (int, float)):
            return c
    return None


def dashboard_brief(dashboard_id: str) -> dict[str, Any]:
    dash = store.get("dashboards", dashboard_id)
    if not dash:
        return {}
    widgets = store.list("dashboard_widgets", where="dashboard_id = ?",
                         params=[dashboard_id], order="created_at ASC")

    findings: list[str] = []
    attention: list[str] = []
    widget_summaries = []

    for w in widgets:
        chart = store.get("charts", w.get("chart_id") or "")
        if not chart:
            continue
        query = store.get("queries", chart.get("query_id") or "") if chart.get("query_id") else None
        if not query:
            continue
        try:
            result = engine.execute(query["sql"])
        except Exception as e:
            findings.append(f"'{chart['name']}' could not be refreshed: {str(e)[:120]}")
            continue

        rows, cols = result["rows"], result["columns"]
        insights = detect_insights(rows, cols)
        num_col = _first_numeric_col(cols, rows)
        summary: dict[str, Any] = {"chart": chart["name"], "rows": len(rows), "insights": insights}

        if chart["spec"].get("type") == "kpi" and rows and num_col:
            val = rows[0][num_col]
            findings.append(f"{chart['name']}: {val:,.2f}")
            summary["value"] = val
        elif insights:
            for ins in insights[:2]:
                findings.append(f"{chart['name']}: {ins['text']}")
                if ins["kind"] == "anomaly":
                    attention.append(f"{chart['name']}: {ins['text']}")
        elif rows:
            summary["preview"] = rows[:3]

        widget_summaries.append(summary)

    # active alert state feeds the Attention section
    for a in store.list("alerts", where="last_status = 'triggered'", order=None):
        attention.append(f"ALERT — {a['name']}: last value {a.get('last_value')}")

    return {
        "dashboard": dash["name"],
        "findings": findings,
        "attention": attention,
        "widgets": widget_summaries,
        "generated_from": "live query re-execution (deterministic)",
    }
