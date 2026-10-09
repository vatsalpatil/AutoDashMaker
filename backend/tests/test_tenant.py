"""Per-user isolation: two signed-in users must never see or reach each other's data. Run: python tests/test_tenant.py"""
import glob
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TMP = tempfile.mkdtemp(prefix="adm_tenant_")
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET="s" * 40, METADATA_DB=f"{TMP}/metadata.duckdb",
                  ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from app.core import tenant  # noqa: E402
from app.core.store import store  # noqa: E402


def token(uid: str) -> dict:
    t = jwt.encode({"sub": uid, "email": f"{uid}@x.com", "aud": "authenticated", "exp": time.time() + 600}, "s" * 40, algorithm="HS256")
    return {"Authorization": f"Bearer {t}"}


c = TestClient(main.app)
A, B = token("alice"), token("bob")
CSV = b"id,region,qty\n1,North,3\n2,South,5\n3,North,2\n"

try:
    # --- sign-in required; each user gets their own workspace
    assert c.get("/api/datasets").status_code == 401
    assert c.get("/api/auth/me", headers=A).json()["workspace_id"] == "ws_alice"

    # --- Alice uploads a dataset, Bob sees nothing
    up = c.post("/api/datasets/upload", headers=A, files={"file": ("sales.csv", CSV)})
    assert up.status_code == 200, up.text
    ds = up.json()
    assert [d["id"] for d in c.get("/api/datasets", headers=A).json()] == [ds["id"]]
    assert c.get("/api/datasets", headers=B).json() == []
    assert c.get(f"/api/datasets/{ds['id']}", headers=B).status_code == 404
    assert c.get(f"/api/datasets/{ds['id']}/preview", headers=B).status_code in (404, 400)
    assert c.delete(f"/api/datasets/{ds['id']}", headers=B).status_code in (404, 200)
    assert len(c.get("/api/datasets", headers=A).json()) == 1, "Bob must not be able to delete Alice's dataset"

    # --- SQL: Alice can query; Bob cannot reach her table (physical or friendly name), nor read files
    run = lambda h, sql: c.post("/api/queries/run", headers=h, json={"sql": sql})  # noqa: E731
    assert run(A, "SELECT SUM(qty) AS q FROM sales").json()["rows"][0]["q"] == 10
    assert run(B, "SELECT * FROM sales").status_code >= 400
    assert run(B, f"SELECT * FROM {ds['physical_name']}").status_code >= 400
    for evil in ("SELECT * FROM read_csv('/etc/passwd')", "SELECT * FROM read_text('/etc/hostname')",
                 "SELECT * FROM 'sales.csv'", "SELECT getenv('SUPABASE_JWT_SECRET')", "SELECT * FROM duckdb_settings()",
                 f"SELECT * FROM read_csv('{TMP}/uploads/ws/ws_alice/sales.csv')"):
        r = run(B, evil)
        assert r.status_code >= 400, f"allowed: {evil}"

    # --- separate files on disk
    # hosted mode keeps only the compressed Parquet copy of an upload, in the owner's own folder
    assert os.path.exists(f"{TMP}/ws/ws_alice/analytics.duckdb") and glob.glob(f"{TMP}/ws/ws_alice/parquet/*.parquet")
    assert not os.path.exists(f"{TMP}/uploads/ws/ws_alice/sales.csv")
    assert not glob.glob(f"{TMP}/ws/ws_bob/parquet/*.parquet")

    # --- a file source pointing at someone else's file / server files is refused
    for path in (f"{TMP}/uploads/ws/ws_alice/sales.csv", "/etc/passwd"):
        src = c.post("/api/sources", headers=B, json={"name": "evil", "type": "file", "config": {"path": path}}).json()
        r = c.post("/api/datasets/ingest", headers=B, json={"source_id": src["id"], "name": "evil"})
        assert r.status_code >= 400, f"ingest of {path} was allowed"
    assert c.get("/api/datasets", headers=B).json() == []

    # --- same-named uploads don't collide
    c.post("/api/datasets/upload", headers=B, files={"file": ("sales.csv", b"id,region,qty\n9,East,100\n")})
    assert run(B, "SELECT SUM(qty) AS q FROM sales").json()["rows"][0]["q"] == 100
    assert run(A, "SELECT SUM(qty) AS q FROM sales").json()["rows"][0]["q"] == 10

    # --- charts / dashboards / notifications / AI providers are per user
    c.post("/api/dashboards/generate", headers=A, json={"dataset_id": ds["id"]})
    assert len(c.get("/api/dashboards", headers=A).json()) == 1 and c.get("/api/dashboards", headers=B).json() == []
    assert c.get("/api/charts", headers=B).json() == [] and len(c.get("/api/charts", headers=A).json()) >= 1
    c.post("/api/ai/providers", headers=A, json={"provider": "openai", "label": "mine", "api_key": "sk-secret-alice", "model": "m", "is_default": True})
    assert "sk-secret-alice" not in c.get("/api/ai/providers", headers=B).text
    assert len(c.get("/api/ai/providers", headers=B).json()) == 0

    # --- the attention report cache is per user
    ra = c.get("/api/attention", headers=A).json()
    assert "items" in ra and c.get("/api/attention", headers=B).status_code == 200

    # --- Python transforms are off on a multi-user server
    r = c.post("/api/transforms/preview", headers=A, json={"dataset_id": ds["id"], "kind": "python", "payload": {"code": "result = df"}})
    assert r.status_code >= 400

    # --- background jobs run inside the owner's workspace
    with tenant.all_workspaces():
        assert {d["workspace_id"] for d in store.list("datasets")} == {"ws_alice", "ws_bob"}
    from app.services.engine import engine
    seen = tenant.run_as("ws_bob", lambda: engine.execute("SELECT SUM(qty) AS q FROM sales")["rows"][0]["q"])
    assert seen == 100
    with tenant.all_workspaces():
        try:
            engine.list_tables()
            raise AssertionError("engine must refuse to run outside a workspace")
        except RuntimeError:
            pass

    # --- a scheduled report runs as its owner: CSV lands in the owner's folder, Bob sees nothing of it
    rep = c.post("/api/reports", headers=A, json={"name": "totals", "sql": "SELECT region, SUM(qty) AS q FROM sales GROUP BY 1",
                                                  "schedule_minutes": 60}).json()
    assert c.get("/api/reports", headers=B).json() == []
    from app.services.reports import run_report
    with tenant.all_workspaces():  # what reports_loop does: list everyone's reports, run each as its owner
        due = store.list("reports", where="active = TRUE", order=None)
    assert [r["workspace_id"] for r in due] == ["ws_alice"]
    saved = tenant.run_as(due[0]["workspace_id"], run_report, due[0])
    assert saved["status"] == "ok" and saved["workspace_id"] == "ws_alice"
    assert os.listdir(f"{TMP}/uploads/ws/ws_alice/reports") and not os.path.exists(f"{TMP}/uploads/ws/ws_bob/reports")
    assert c.get(f"/api/reports/runs/{saved['id']}/download", headers=B).status_code in (404, 400)
    assert c.get(f"/api/reports/runs/{saved['id']}/download", headers=A).status_code == 200

    # --- audit rows belong to the user who acted
    from app.services import audit
    audit.flush()
    body = c.get("/api/audit", headers=A).json()
    rows = body["items"] if isinstance(body, dict) else body
    assert rows and {r["workspace_id"] for r in rows} == {"ws_alice"}, "audit rows must belong to the user who acted"
    assert {r["workspace_id"] for r in (lambda b: b["items"] if isinstance(b, dict) else b)(c.get("/api/audit", headers=B).json())} <= {"ws_bob"}
    print("tenant isolation tests OK")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
