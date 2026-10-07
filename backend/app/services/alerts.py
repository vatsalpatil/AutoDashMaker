"""Alert rule engine + in-process scheduler (§25).

Saved metric query → scheduled execution → rule evaluation → notification.
The engine is deterministic; the metric SQL passes the same read-only guard
as every other query in the platform.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from ..core.store import store, DEFAULT_WS
from .engine import engine
from ..core import tenant

log = logging.getLogger("alerts")

OPERATORS = {
    "lt": lambda v, t: v < t,
    "lte": lambda v, t: v <= t,
    "gt": lambda v, t: v > t,
    "gte": lambda v, t: v >= t,
    "eq": lambda v, t: v == t,
    # change-based: compares against the previous run's value
    "pct_up_gt": lambda v, t, prev=None: prev not in (None, 0) and (v - prev) / abs(prev) * 100 > t,
    "pct_down_gt": lambda v, t, prev=None: prev not in (None, 0) and (prev - v) / abs(prev) * 100 > t,
}


def evaluate_alert(alert: dict[str, Any]) -> dict[str, Any]:
    """Run the metric query once and evaluate the rule."""
    result = engine.execute(alert["metric_sql"], row_limit=1)
    if result["row_count"] == 0:
        return {"status": "error", "message": "metric query returned no rows", "value": None}
    try:
        value = float(result["rows"][0][result["columns"][0]])
    except (TypeError, ValueError):
        return {"status": "error", "message": "metric query must return a single numeric value", "value": None}

    op = OPERATORS.get(alert["operator"])
    if not op:
        return {"status": "error", "message": f"unknown operator {alert['operator']}", "value": value}

    prev = alert.get("last_value")
    triggered = op(value, alert["threshold"], prev) if alert["operator"].startswith("pct_") else op(value, alert["threshold"])
    status = "triggered" if triggered else "ok"

    if triggered:
        if alert["operator"].startswith("pct_"):
            msg = (f"{alert['name']}: value moved from {prev:,.2f} to {value:,.2f} "
                   f"(threshold {alert['threshold']}%)")
        else:
            msg = (f"{alert['name']}: value {value:,.2f} breached "
                   f"{alert['operator']} {alert['threshold']:,.2f}")
    else:
        msg = f"{alert['name']}: {value:,.2f} within bounds"

    run = store.insert("alert_runs", {
        "alert_id": alert["id"], "value": value, "previous_value": prev,
        "status": status, "message": msg,
    })
    store.update("alerts", alert["id"], {
        "last_run_at": datetime.now(timezone.utc),
        "last_value": value, "last_status": status,
    })
    if triggered:
        store.insert("notifications", {
            "workspace_id": DEFAULT_WS, "alert_id": alert["id"], "message": msg,
        })
    return run


async def scheduler_loop(poll_seconds: int = 60) -> None:
    """Check active alerts every minute; run those that are due."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            with tenant.all_workspaces():  # every user's alerts; each is then evaluated inside its owner's workspace
                alerts = store.list("alerts", where="active = TRUE", order=None)
            for alert in alerts:
                last = alert.get("last_run_at")
                due = last is None
                if last is not None:
                    if isinstance(last, str):
                        last = datetime.fromisoformat(last)
                    if last.tzinfo is None:
                        last = last.replace(tzinfo=timezone.utc)
                    due = (now - last).total_seconds() >= alert["schedule_minutes"] * 60
                if due:
                    try:
                        await asyncio.to_thread(tenant.run_as, alert["workspace_id"], evaluate_alert, alert)
                    except Exception as e:
                        log.warning("alert %s failed: %s", alert["id"], e)
        except Exception as e:
            log.warning("scheduler iteration failed: %s", e)
        await asyncio.sleep(poll_seconds)
