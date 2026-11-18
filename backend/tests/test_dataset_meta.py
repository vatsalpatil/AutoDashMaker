"""Dataset rename + folders: name on upload, PATCH rename/move, uniqueness, SQL by the new name, folder list."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "data", "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "data", "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")
os.environ.setdefault("DISK_USAGE_LIMIT_PCT", "0")
os.makedirs(os.path.join(tmp, "data"), exist_ok=True)

from fastapi.testclient import TestClient  # noqa: E402
from Main import app  # noqa: E402

c = TestClient(app)
csv = b"region,revenue\nWest,300\nEast,175\n"
a = c.post("/api/datasets/upload", files={"file": ("raw_export_v2.csv", csv)}, data={"name": "Sales 2026", "folder": " Finance / Q1 "}).json()
assert a["name"] == "Sales 2026" and a["folder"] == "Finance/Q1", a
b = c.post("/api/datasets/upload", files={"file": ("other.csv", csv)}).json()
assert b["name"] == "other" and not b.get("folder")
# duplicate name refused before importing
r = c.post("/api/datasets/upload", files={"file": ("x.csv", csv)}, data={"name": "sales 2026"})
assert r.status_code == 400 and "already called" in r.text, r.text
# rename + move, then query by the new name
r = c.patch(f"/api/datasets/{b['id']}", json={"name": "Costs", "folder": "Finance"})
assert r.status_code == 200 and r.json()["name"] == "Costs" and r.json()["folder"] == "Finance", r.text
assert c.patch(f"/api/datasets/{b['id']}", json={"name": "Sales 2026"}).status_code == 400
assert c.patch(f"/api/datasets/{b['id']}", json={"name": "  "}).status_code == 400
q = c.post("/api/queries/run", json={"sql": "SELECT SUM(revenue) AS s FROM Costs"})
assert q.status_code == 200 and q.json()["rows"][0]["s"] == 475, q.text
# clear folder only when the key is sent
assert c.patch(f"/api/datasets/{b['id']}", json={"description": "x"}).json()["folder"] == "Finance"
assert c.patch(f"/api/datasets/{b['id']}", json={"folder": ""}).json()["folder"] is None
assert c.get("/api/datasets/folders").json() == [{"name": "Finance/Q1", "count": 1}]
assert c.patch("/api/datasets/nope", json={"name": "z"}).status_code == 404
print("PASS test_dataset_meta")
