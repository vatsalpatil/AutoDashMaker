"""Dashboard share links: public read-only view by token, owner-only management, expiry + revoke. Run: python tests/test_shares.py"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TMP = tempfile.mkdtemp(prefix="adm_shares_")
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET="s" * 40, METADATA_DB=f"{TMP}/metadata.duckdb",
                  ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import Main as main  # noqa: E402
from app.core import tenant  # noqa: E402
from app.core.store import store  # noqa: E402


def token(uid: str) -> dict:
    t = jwt.encode({"sub": uid, "email": f"{uid}@x.com", "aud": "authenticated", "exp": time.time() + 600}, "s" * 40, algorithm="HS256")
    return {"Authorization": f"Bearer {t}"}


c = TestClient(main.app)
A, B = token("alice"), token("bob")

try:
    assert c.post("/api/datasets/upload", headers=A, files={"file": ("sales.csv", b"region,qty\nNorth,3\nSouth,5\n")}).status_code == 200
    with tenant.use("ws_alice"):
        q = store.insert("queries", {"name": "q", "sql": "SELECT region, SUM(qty) AS qty FROM sales GROUP BY 1"})
    ch = c.post("/api/charts", headers=A, json={"name": "Qty", "query_id": q["id"], "spec": {"type": "bar"}}).json()
    d = c.post("/api/dashboards", headers=A, json={"name": "Sales"}).json()
    c.post(f"/api/dashboards/{d['id']}/widgets", headers=A, json={"chart_id": ch["id"]})

    # owner creates a link; Bob cannot share or list Alice's dashboard
    assert c.post(f"/api/dashboards/{d['id']}/shares", headers=B, json={"days": 7}).status_code == 404
    s = c.post(f"/api/dashboards/{d['id']}/shares", headers=A, json={"days": 7}).json()
    assert s["active"] and len(s["token"]) >= 30
    assert c.get(f"/api/dashboards/{d['id']}/shares", headers=B).json() == []

    # anyone with the link sees the dashboard + data, without login, and no SQL leaks
    pub = c.get(f"/api/public/shares/{s['token']}")
    assert pub.status_code == 200 and pub.json()["name"] == "Sales" and len(pub.json()["widgets"]) == 1
    data = c.post(f"/api/public/shares/{s['token']}/data").json()
    entry = data[ch["id"]]
    assert sorted(r["qty"] for r in entry["data"]["rows"]) == [3, 5], entry
    blob = str(data) + str(pub.json())
    assert "query_id" not in blob and "sql" not in blob.lower() and "workspace_id" not in blob, blob[:300]
    assert c.get(f"/api/dashboards/{d['id']}/shares", headers=A).json()[0]["views"] == 1

    # wrong token, revoked, expired
    assert c.get("/api/public/shares/nope").status_code == 404
    c.delete(f"/api/dashboards/{d['id']}/shares/{s['id']}", headers=A)
    assert c.get(f"/api/public/shares/{s['token']}").status_code == 404
    s2 = c.post(f"/api/dashboards/{d['id']}/shares", headers=A, json={"days": 1}).json()
    with tenant.use("ws_alice"):
        store.update("dashboard_shares", s2["id"], {"expires_at": "2000-01-01 00:00:00"})
    assert c.get(f"/api/public/shares/{s2['token']}").status_code == 404
    # dashboard parameters: a threshold placeholder becomes a number control and filters every widget's data
    # saved through the same /run endpoint the studio uses: the placeholder must survive saving
    q2 = c.post("/api/queries/run", headers=A, json={"sql": "SELECT region, SUM(qty) AS qty FROM sales WHERE qty >= {{min_qty|0}} GROUP BY 1", "name": "q2", "save": True}).json()
    q2["id"] = q2["query_id"]
    assert "{{min_qty|0}}" in c.get(f"/api/queries/{q2['id']}", headers=A).json()["sql"]
    ch2 = c.post("/api/charts", headers=A, json={"name": "Qty2", "query_id": q2["id"], "spec": {"type": "bar"}}).json()
    c.post(f"/api/dashboards/{d['id']}/widgets", headers=A, json={"chart_id": ch2["id"]})
    ctl = c.get(f"/api/dashboards/{d['id']}/params", headers=A).json()
    assert ctl == [{"name": "min_qty", "default": "0", "kind": "number", "label": "Min qty"}], ctl
    rows = lambda body: c.post(f"/api/dashboards/{d['id']}/data", headers=A, json=body).json()[ch2["id"]]["data"]["rows"]  # noqa: E731
    assert len(rows({})) == 2 and [r["region"] for r in rows({"params": {"min_qty": 4}})] == ["South"]
    bad = c.post(f"/api/dashboards/{d['id']}/data", headers=A, json={"params": {"min_qty": "0; DROP TABLE x"}}).json()[ch2["id"]]
    assert "error" in bad and "unsafe" in bad["error"], bad
    print("PASS test_shares")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
