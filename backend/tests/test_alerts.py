"""Alerts: a broken query is an error run (never a crash), each unusable result says why, the query is test-run when
saved, and wrong-case text is matched to the data. Run: backend/.venv/Scripts/python.exe tests/test_alerts.py"""
from helpers import isolated, make_dataset
isolated()

from fastapi import HTTPException

from app.core.store import store
from app.routers.alerts import AlertIn, create_alert
from app.services.alerts import evaluate_alert, measure

make_dataset("att", "SELECT * FROM (VALUES ('E1','Present',8.0),('E2','Present',7.0),('E3','Leave',0.0)) t(emp, status, hours)")

assert measure("SELECT count(*) FROM ds_att") == (3.0, None)
assert "several rows" in measure("SELECT emp FROM ds_att")[1]
assert "NULL" in measure("SELECT sum(hours) FROM ds_att WHERE 1=0")[1]
assert "text" in measure("SELECT max(emp) FROM ds_att")[1]
assert "does not exist" in measure("SELECT sum(nope) FROM ds_att")[1]

# saving: a broken query is refused with the reason; wrong-case text is fixed (no false alarm from 'present' = 0)
try:
    create_alert(AlertIn(name="bad", metric_sql="SELECT sum(nope) FROM att", operator="gt", threshold=1))
    raise AssertionError("saved a broken alert")
except HTTPException as e:
    assert e.status_code == 400 and "nope" in e.detail, e.detail
a = create_alert(AlertIn(name="present", metric_sql="SELECT count(*) FROM att WHERE status = 'present'", operator="lt", threshold=1))
assert "'Present'" in a["metric_sql"] and a.get("note"), a
run = evaluate_alert(store.get("alerts", a["id"]))
assert run["status"] == "ok" and run["value"] == 2, run

# a query that breaks later (column dropped) is recorded as an error run with the alert marked, not a 500
store.update("alerts", a["id"], {"metric_sql": "SELECT sum(gone) FROM att"})
run = evaluate_alert(store.get("alerts", a["id"]))
assert run["status"] == "error" and "gone" in run["message"], run
assert store.get("alerts", a["id"])["last_status"] == "error"
print("test_alerts OK")
