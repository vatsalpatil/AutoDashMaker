"""Error contract: every failure is {detail, code, hint?}; validation errors name the field; an account limit is a 409
with code quota.limit (not a 507 "server out of storage"); responses carry a Server-Timing header.
Run: backend/.venv/Scripts/python.exe tests/test_errors.py"""
from helpers import isolated
isolated()

from starlette.testclient import TestClient

import Main
from app.core.config import settings

c = TestClient(Main.app)

r = c.get("/api/queries/nope")
body = r.json()
assert r.status_code == 404 and body["code"] == "not_found" and isinstance(body["detail"], str), body

r = c.post("/api/alerts", json={"name": "x", "metric_sql": "SELECT 1", "operator": "gt", "threshold": "lots"})
assert r.status_code == 422 and r.json()["code"] == "invalid_input" and "threshold" in r.json()["detail"], r.json()

from app.services import quota
quota.enforced = lambda: True   # limits apply in hosted mode only
settings.max_datasets = 1
assert c.post("/api/datasets/upload", files={"file": ("a.csv", b"x\n1\n", "text/csv")}).status_code == 200
r = c.post("/api/datasets/upload", files={"file": ("b.csv", b"x\n1\n", "text/csv")})
assert r.status_code == 409 and r.json()["code"] == "quota.limit" and r.json().get("hint"), (r.status_code, r.json())

# combining tables creates a dataset too, so it respects the same limit
from helpers import make_dataset
x = make_dataset("kx", "SELECT * FROM (VALUES ('a', 1), ('b', 2)) t(k_id, v)")
y = make_dataset("ky", "SELECT * FROM (VALUES ('a', 'z'), ('b', 'q')) t(k_id, w)")
r = c.post("/api/transforms/blend-many", json={"dataset_ids": [x["id"], y["id"]]})
assert r.status_code == 409 and r.json()["code"] == "quota.limit", (r.status_code, r.json())

assert "app;dur=" in c.get("/api/datasets").headers.get("server-timing", ""), "no Server-Timing header"
print("test_errors OK")
