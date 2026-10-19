"""Dataset versions (time travel) tests on a temp data dir.
Run: backend/.venv/Scripts/python.exe tests/test_versions.py"""
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
from app.services import columnar, versions
from app.services.engine import engine

T = "ds_versions_test"


def load(n: int) -> None:
    with engine.writer() as con:
        con.execute(f"CREATE TABLE {T}__stg AS SELECT range AS id FROM range({n})")
        columnar.publish(con, f"{T}__stg", T)


load(10)
assert versions.list_versions(T) == [], "first load has no history"
load(20)
load(30)
vs = versions.list_versions(T)
assert len(vs) == 2, vs
for n in range(5):
    load(40 + n)
assert len(versions.list_versions(T)) == versions.KEEP, "history is capped"

ds = store.insert("datasets", {"name": "vtest", "kind": "csv", "physical_name": T, "row_count": 44, "column_count": 1})
c = TestClient(app)
body = c.get(f"/api/datasets/{ds['id']}/versions").json()
oldest = body["versions"][-1]["version"]
prev = c.get(f"/api/datasets/{ds['id']}/versions/{oldest}/preview").json()
assert prev["row_count"] == 41, prev["row_count"]
assert c.get(f"/api/datasets/{ds['id']}/versions/../../x/preview").status_code == 404
assert c.get(f"/api/datasets/{ds['id']}/versions/20990101T000000000000Z/preview").status_code == 404
r = c.post(f"/api/datasets/{ds['id']}/versions/{oldest}/restore").json()
assert r["row_count"] == 41, r
assert engine.execute(f"SELECT count(*) AS n FROM {T}")["rows"][0]["n"] == 41
assert len(versions.list_versions(T)) == versions.KEEP, "restore saved the replaced file as a version"
columnar.remove(T)
assert versions.list_versions(T) == []
print("versions OK")
