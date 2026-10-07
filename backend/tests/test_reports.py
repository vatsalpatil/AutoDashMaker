"""Scheduled reports: create/validate, run -> CSV + run record + notification, download, prune, delete.
Run: backend/.venv/Scripts/python.exe tests/test_reports.py"""
import os
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()  # never touch the real databases
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")

from fastapi.testclient import TestClient
from main import app
from app.core.store import store
from app.services.reports import KEEP_RUNS

c = TestClient(app)
good = {"name": "Daily numbers", "sql": "SELECT 1 AS a, 'x' AS b UNION ALL SELECT 2, 'y'", "schedule_minutes": 60}
assert c.post("/api/reports", json={**good, "sql": "DROP TABLE x"}).status_code == 400
assert c.post("/api/reports", json={**good, "webhook_url": "ftp://x"}).status_code == 400
rep = c.post("/api/reports", json=good).json()

run = c.post(f"/api/reports/{rep['id']}/run").json()
assert run["status"] == "ok" and run["row_count"] == 2 and run["file_name"].endswith(".csv"), run
csv_text = c.get(f"/api/reports/runs/{run['id']}/download").text
assert csv_text.splitlines()[0] == "a,b" and "2,y" in csv_text, csv_text
assert any("Daily numbers" in n["message"] for n in store.list("notifications"))
assert c.get("/api/reports").json()[0]["last_status"] == "ok"

# a broken query is a failed run, not an exception
store.update("reports", rep["id"], {"sql": "SELECT * FROM missing_table_xyz"})
bad = c.post(f"/api/reports/{rep['id']}/run").json()
assert bad["status"] == "error" and bad["file_name"] == "", bad
assert c.get(f"/api/reports/runs/{bad['id']}/download").status_code == 404

# only the newest KEEP_RUNS runs (and their files) are kept
store.update("reports", rep["id"], {"sql": good["sql"]})
for _ in range(KEEP_RUNS + 2):
    c.post(f"/api/reports/{rep['id']}/run")
assert len(c.get(f"/api/reports/{rep['id']}/runs").json()) == KEEP_RUNS
assert c.delete(f"/api/reports/{rep['id']}").status_code == 200 and c.get("/api/reports").json() == []
print("reports tests OK")
