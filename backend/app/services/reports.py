"""Scheduled reports: a saved read-only query run on an interval; each run is kept as a CSV (last 10) and announced
as an in-app notification, and optionally POSTed as a summary to a webhook (Slack/Teams/n8n style)."""
from __future__ import annotations

import asyncio
import csv
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from ..core.config import settings
from ..core.store import DEFAULT_WS, store
from .engine import engine
from ..core import tenant

log = logging.getLogger("reports")
KEEP_RUNS = 10
MAX_ROWS = 100_000


def reports_dir() -> Path:
    d = tenant.upload_dir() / "reports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_csv(report: dict[str, Any], result: dict[str, Any]) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    name = f"{re.sub(r'[^A-Za-z0-9_-]+', '_', report['name']).strip('_') or 'report'}_{stamp}.csv"
    with open(reports_dir() / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=result["columns"])
        w.writeheader()
        w.writerows(result["rows"])
    return name


def run_report(report: dict[str, Any]) -> dict[str, Any]:
    """Execute once: store the CSV + a run record, update the report, notify. Never raises (errors become a failed run)."""
    try:
        result = engine.execute(report["sql"], row_limit=MAX_ROWS)
        file_name = _write_csv(report, result)
        run = {"report_id": report["id"], "status": "ok", "row_count": result["row_count"], "file_name": file_name,
               "message": f"{report['name']}: {result['row_count']:,} rows"}
    except Exception as e:  # report SQL can break when a dataset changes: record it instead of killing the scheduler
        run = {"report_id": report["id"], "status": "error", "row_count": 0, "file_name": "", "message": f"{report['name']} failed: {e}"}
    saved = store.insert("report_runs", run)
    store.update("reports", report["id"], {"last_run_at": datetime.now(timezone.utc), "last_status": run["status"], "last_rows": run["row_count"]})
    store.insert("notifications", {"workspace_id": DEFAULT_WS, "alert_id": None, "message": f"Report ready — {run['message']}" if run["status"] == "ok" else run["message"]})
    _prune(report["id"])
    if report.get("webhook_url"):
        try:
            httpx.post(report["webhook_url"], json={"report": report["name"], "status": run["status"], "rows": run["row_count"], "text": run["message"]}, timeout=10)
        except httpx.HTTPError as e:
            log.warning("report webhook failed: %s", e)
    return saved


def _prune(report_id: str) -> None:
    runs = store.list("report_runs", where="report_id = ?", params=[report_id])  # newest first
    for old in runs[KEEP_RUNS:]:
        if old.get("file_name"):
            (reports_dir() / old["file_name"]).unlink(missing_ok=True)
        store.delete("report_runs", old["id"])


async def reports_loop(poll_seconds: int = 60) -> None:
    while True:
        try:
            now = datetime.now(timezone.utc)
            with tenant.all_workspaces():
                reports = store.list("reports", where="active = TRUE", order=None)
            for rep in reports:
                last = rep.get("last_run_at")
                if isinstance(last, str):
                    last = datetime.fromisoformat(last)
                if last is not None and last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                if last is None or (now - last).total_seconds() >= rep["schedule_minutes"] * 60:
                    await asyncio.to_thread(tenant.run_as, rep["workspace_id"], run_report, rep)
        except Exception as e:
            log.warning("reports iteration failed: %s", e)
        await asyncio.sleep(poll_seconds)
