"""Scheduled reports: CRUD, run now, run history and CSV download."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..core.security import UnsafeQueryError, validate_readonly
from ..core.store import DEFAULT_WS, store
from ..services.reports import reports_dir, run_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportIn(BaseModel):
    name: str
    sql: str
    schedule_minutes: int = 1440
    webhook_url: str = ""
    active: bool = True


def _check(body: ReportIn):
    if not body.name.strip():
        raise HTTPException(400, "a report needs a name")
    if body.schedule_minutes < 1:
        raise HTTPException(400, "schedule must be at least 1 minute")
    if body.webhook_url and not body.webhook_url.startswith(("http://", "https://")):
        raise HTTPException(400, "webhook must be an http(s) URL")
    try:
        validate_readonly(body.sql, 1)
    except UnsafeQueryError as e:
        raise HTTPException(400, f"the report query must be a safe read-only SELECT: {e}")


def _get(report_id: str) -> dict:
    r = store.get("reports", report_id)
    if not r:
        raise HTTPException(404, "report not found")
    return r


@router.get("")
def list_reports():
    return store.list("reports")


@router.post("")
def create_report(body: ReportIn):
    _check(body)
    return store.insert("reports", {"workspace_id": DEFAULT_WS, **body.model_dump()})


@router.patch("/{report_id}")
def update_report(report_id: str, body: ReportIn):
    _get(report_id)
    _check(body)
    store.update("reports", report_id, body.model_dump())
    return store.get("reports", report_id)


@router.delete("/{report_id}")
def delete_report(report_id: str):
    _get(report_id)
    for run in store.list("report_runs", where="report_id = ?", params=[report_id]):
        if run.get("file_name"):
            (reports_dir() / run["file_name"]).unlink(missing_ok=True)
        store.delete("report_runs", run["id"])
    store.delete("reports", report_id)
    return {"ok": True}


@router.post("/{report_id}/run")
def run_now(report_id: str):
    return run_report(_get(report_id))


@router.get("/{report_id}/runs")
def runs(report_id: str):
    _get(report_id)
    return store.list("report_runs", where="report_id = ?", params=[report_id])


@router.get("/runs/{run_id}/download")
def download(run_id: str):
    run = store.get("report_runs", run_id)
    path = reports_dir() / (run or {}).get("file_name", "")
    if not run or not run.get("file_name") or not path.is_file():
        raise HTTPException(404, "that run has no file (it failed or was pruned)")
    return FileResponse(path, media_type="text/csv", filename=run["file_name"])
