"""Saved AI chats: create, list by kind / dashboard, reopen with state, rename, size limit, delete.
Run: backend/.venv/Scripts/python.exe tests/test_ai_sessions.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_sess_")
os.environ.update(METADATA_DB=f"{TMP}/m.duckdb", ANALYTICS_DB=f"{TMP}/a.duckdb", UPLOAD_DIR=f"{TMP}/up", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/up", exist_ok=True)

from fastapi.testclient import TestClient  # noqa: E402

from Main import app  # noqa: E402

c = TestClient(app)
a = c.post("/api/ai/sessions", json={"kind": "generate", "title": "Sales", "state": {"phase": "plan", "plan": {"name": "X"}}}).json()["id"]
b = c.post("/api/ai/sessions", json={"kind": "edit", "ref_id": "d1", "title": "Edit", "state": {"turns": []}}).json()["id"]
assert c.post("/api/ai/sessions", json={"kind": "nope", "title": "x"}).status_code == 400
assert [s["id"] for s in c.get("/api/ai/sessions?kind=generate").json()] == [a]
assert [s["id"] for s in c.get("/api/ai/sessions?kind=edit&ref_id=d1").json()] == [b]
assert c.put(f"/api/ai/sessions/{a}", json={"title": "Renamed", "summary": "plan ready", "state": {"phase": "done"}}).status_code == 200
row = c.get(f"/api/ai/sessions/{a}").json()
assert row["title"] == "Renamed" and row["state"] == {"phase": "done"} and row["summary"] == "plan ready", row
assert c.put(f"/api/ai/sessions/{a}", json={"state": {"big": "x" * 4_100_000}}).status_code == 413
c.delete(f"/api/ai/sessions/{a}")
assert c.get(f"/api/ai/sessions/{a}").status_code == 404
print("ai sessions tests OK")
