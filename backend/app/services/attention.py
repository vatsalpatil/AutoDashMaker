"""'What needs my attention today?' (spec §99).

Deterministic roll-up of signals the platform already computes: triggered alerts,
stale or failing datasets, poor data quality and dashboard anomalies. Every item
carries evidence and a link target so the user can drill in. No LLM involved.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

from ..core.store import store
from .brief import dashboard_brief
from .refresh import age_minutes, is_overdue

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
MAX_DASHBOARDS = 10      # bound the deep scan (each widget re-runs its query; cached by the engine)
REPORT_TTL_S = 60
_cache: dict[bool, tuple[float, dict[str, Any]]] = {}
_compute_lock = threading.Lock()  # single-flight: one scan at a time


def _item(severity: str, category: str, title: str, detail: str, link: str, **evidence: Any) -> dict[str, Any]:
    return {"severity": severity, "category": category, "title": title,
            "detail": detail, "link": link, "evidence": evidence}


def _alert_items() -> list[dict[str, Any]]:
    items = []
    for a in store.list("alerts", where="active = TRUE", order=None):
        if a.get("last_status") == "triggered":
            items.append(_item("high", "alert", f"Alert triggered: {a['name']}",
                               f"Last value {a.get('last_value')} breached {a['operator']} {a['threshold']}.",
                               "/alerts", alert_id=a["id"], value=a.get("last_value")))
        elif a.get("last_status") == "error":
            items.append(_item("medium", "alert", f"Alert failing: {a['name']}",
                               "The metric query errored on its last run, so it cannot protect you.",
                               "/alerts", alert_id=a["id"]))
    return items


def _dataset_items() -> list[dict[str, Any]]:
    items = []
    for d in store.list("datasets", order=None):
        link = f"/datasets/{d['id']}"
        if d.get("last_refresh_error"):
            items.append(_item("high", "freshness", f"Refresh failing: {d['name']}",
                               str(d["last_refresh_error"])[:200], link, dataset_id=d["id"]))
        if is_overdue(d):
            interval, age = d["expected_interval_minutes"], age_minutes(d)
            sev = "high" if age > 3 * interval else "medium"
            items.append(_item(sev, "freshness", f"Stale data: {d['name']}",
                               f"Last updated {age:,.0f} min ago; expected every {interval} min.",
                               link, dataset_id=d["id"], age_minutes=round(age, 1)))
    return items


def _quality_items() -> list[dict[str, Any]]:
    rows = store.execute("""
        SELECT q.*, d.name AS dataset_name FROM quality_runs q
        JOIN datasets d ON d.id = q.dataset_id
        QUALIFY row_number() OVER (PARTITION BY q.dataset_id ORDER BY q.created_at DESC) = 1
    """)
    items = []
    for q in rows:
        comp, dup = q.get("completeness") or 100, q.get("duplicate_pct") or 0
        if comp < 80 or dup > 5:
            sev = "high" if comp < 60 or dup > 20 else "medium"
            items.append(_item(sev, "quality", f"Data quality concern: {q['dataset_name']}",
                               f"Completeness {comp}%, duplicate rows {dup}%.",
                               "/quality", dataset_id=q["dataset_id"], completeness=comp, duplicate_pct=dup))
    return items


def _dashboard_items() -> list[dict[str, Any]]:
    items = []
    for dash in store.list("dashboards", order="updated_at DESC")[:MAX_DASHBOARDS]:
        try:
            brief = dashboard_brief(dash["id"])
        except Exception:
            continue
        for text in brief.get("attention", []):
            if text.startswith("ALERT"):  # already reported by _alert_items
                continue
            items.append(_item("medium", "anomaly", f"{dash['name']}: unusual movement", text,
                               f"/dashboards/{dash['id']}", dashboard_id=dash["id"]))
    return items


def attention_report(deep: bool = True) -> dict[str, Any]:
    cached = _cache.get(deep)
    if cached and time.monotonic() - cached[0] < REPORT_TTL_S:
        return cached[1]
    with _compute_lock:
        cached = _cache.get(deep)  # another request may have finished while we waited
        if cached and time.monotonic() - cached[0] < REPORT_TTL_S:
            return cached[1]
        return _build_report(deep)


def _build_report(deep: bool) -> dict[str, Any]:
    items = _alert_items() + _dataset_items() + _quality_items()
    if deep:
        items += _dashboard_items()
    items.sort(key=lambda i: (SEVERITY_ORDER[i["severity"]], i["category"]))
    summary = {s: sum(1 for i in items if i["severity"] == s) for s in SEVERITY_ORDER}
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "all_clear": not items,
        "summary": summary,
        "items": items,
        "scope": "deep (incl. dashboard anomalies)" if deep else "fast (alerts, freshness, quality)",
    }
    _cache[deep] = (time.monotonic(), report)
    return report
