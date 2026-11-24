"""Alerts CRUD + manual evaluation + notifications (§25)."""
from ...core import tenant
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...core.store import store, DEFAULT_WS
from ...core.security import validate_readonly, UnsafeQueryError
from .alerts import evaluate_alert, OPERATORS

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class AlertIn(BaseModel):
    name: str
    dataset_id: str | None = None
    metric_sql: str
    operator: str           # lt | lte | gt | gte | eq | pct_up_gt | pct_down_gt
    threshold: float
    schedule_minutes: int = 60
    channel: str = "in_app"
    active: bool = True


def _check(body: AlertIn):
    if body.operator not in OPERATORS:
        raise HTTPException(400, f"operator must be one of {list(OPERATORS)}")
    if body.schedule_minutes < 1:
        raise HTTPException(400, "schedule must be at least 1 minute")
    try:
        validate_readonly(body.metric_sql, 1)
    except UnsafeQueryError as e:
        raise HTTPException(400, f"metric_sql must be a safe read-only SELECT: {e}")
    from ...services import value_guard
    from .alerts import measure
    # 'present' when the data says 'Present' would silently measure 0 and raise false alarms: use the data's spelling
    fixed = value_guard.fix_literal_case(body.metric_sql)
    note = "Matched your text values to the data's exact spelling (upper/lower case)." if fixed else None
    if fixed:
        body.metric_sql = fixed
    _, error = measure(body.metric_sql)   # test-run once, so a broken query is caught when saving, not at 3 am
    if error:
        raise HTTPException(400, error)
    return note


@router.get("")
def list_alerts():
    return store.list("alerts")


@router.post("")
def create_alert(body: AlertIn):
    note = _check(body)
    a = store.insert("alerts", {"workspace_id": DEFAULT_WS, **body.model_dump()})
    return {**a, "note": note} if note else a


@router.patch("/{alert_id}")
def update_alert(alert_id: str, body: AlertIn):
    if not store.get("alerts", alert_id):
        raise HTTPException(404, "alert not found")
    _check(body)
    store.update("alerts", alert_id, body.model_dump())
    return store.get("alerts", alert_id)


@router.post("/{alert_id}/toggle")
def toggle(alert_id: str):
    a = store.get("alerts", alert_id)
    if not a:
        raise HTTPException(404, "alert not found")
    store.update("alerts", alert_id, {"active": not a["active"]})
    return store.get("alerts", alert_id)


@router.post("/{alert_id}/run")
def run_now(alert_id: str):
    a = store.get("alerts", alert_id)
    if not a:
        raise HTTPException(404, "alert not found")
    return evaluate_alert(a)


@router.get("/{alert_id}/runs")
def runs(alert_id: str):
    return store.list("alert_runs", where="alert_id = ?", params=[alert_id])


@router.delete("/{alert_id}")
def delete_alert(alert_id: str):
    if store.get("alerts", alert_id):   # only the caller's own alert: alert_runs has no workspace column
        store.delete("alerts", alert_id)
        store.execute("DELETE FROM alert_runs WHERE alert_id = ?", [alert_id])
    return {"ok": True}


# -- notifications ---------------------------------------------------------

@router.get("/notifications/list")
def notifications(unread_only: bool = False):
    where = "read = FALSE" if unread_only else ""
    return store.list("notifications", where=where)


@router.post("/notifications/{notif_id}/read")
def mark_read(notif_id: str):
    store.update("notifications", notif_id, {"read": True})
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read():
    store.execute("UPDATE notifications SET read = TRUE WHERE workspace_id = ?", [tenant.current()])
    return {"ok": True}
