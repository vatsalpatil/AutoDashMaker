"""Data tests + auto-rollback after a bad refresh, on a temp data dir.
Run: backend/.venv/Scripts/python.exe tests/test_data_tests.py"""
import os
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "data", "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "data", "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.makedirs(os.path.join(tmp, "data"), exist_ok=True)

from fastapi.testclient import TestClient
from Main import app
from app.core.store import store
from app.services import columnar, data_tests
from app.services.engine import engine

T = "ds_tests_demo"


def load(sql: str) -> None:
    with engine.writer() as con:
        con.execute(f"CREATE TABLE {T}__stg AS {sql}")
        columnar.publish(con, f"{T}__stg", T)


load("SELECT range AS id, CASE WHEN range % 2 = 0 THEN 'a' ELSE 'b' END AS kind, range * 1.5 AS amount FROM range(10)")
ds = store.insert("datasets", {"name": "demo", "kind": "csv", "physical_name": T, "row_count": 10, "column_count": 3})
c = TestClient(app)
base = f"/api/datasets/{ds['id']}/tests"
specs = [
    {"kind": "not_null", "column_name": "id"},
    {"kind": "unique", "column_name": "id"},
    {"kind": "accepted_values", "column_name": "kind", "config": {"values": ["a", "b"]}},
    {"kind": "range", "column_name": "amount", "config": {"min": 0, "max": 100}},
    {"kind": "min_rows", "config": {"rows": 5}},
    {"kind": "custom_sql", "config": {"sql": f"SELECT * FROM {T} WHERE amount < 0"}, "severity": "warn"},
]
for s in specs:
    r = c.post(base, json=s)
    assert r.status_code == 200 and r.json()["last_status"] == "pass", (s, r.text)
assert c.post(base, json={"kind": "unique"}).status_code == 400, "column required"
assert c.post(base, json={"kind": "custom_sql", "config": {"sql": f"DELETE FROM {T}"}}).status_code == 400, "writes refused"

# a bad refresh (duplicate ids, unknown kind, only 3 rows) -> rolled back to the 10-row version
load("SELECT 1 AS id, 'zzz' AS kind, 2.0 AS amount UNION ALL SELECT 1, 'a', 3.0 UNION ALL SELECT 2, 'b', 4.0")
msg = data_tests.check_after_refresh(store.get("datasets", ds["id"]))
assert msg and "rolled back" in msg, msg
assert engine.execute(f"SELECT count(*) AS n FROM {T}", fresh=True)["rows"][0]["n"] == 10
assert store.get("datasets", ds["id"])["row_count"] == 10
assert any("rolled back" in n["message"] for n in store.list("notifications"))
results = c.post(f"{base}/run").json()
assert all(r["last_status"] == "pass" for r in results if r["severity"] == "error"), results
tid = c.get(base).json()[0]["id"]
c.delete(f"{base}/{tid}")
assert len(c.get(base).json()) == len(specs) - 1
print("data tests OK")
