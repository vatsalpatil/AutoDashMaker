"""Lifecycle: one-call widget creation, chart/dashboard deletion cascades, unused-chart cleanup, workspace isolation.
Run: python tests/test_lifecycle.py"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_life_")
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET="s" * 40, METADATA_DB=f"{TMP}/metadata.duckdb",
                  ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import Main as main  # noqa: E402


def token(uid: str) -> dict:
    t = jwt.encode({"sub": uid, "email": f"{uid}@x.com", "aud": "authenticated", "exp": time.time() + 600}, "s" * 40, algorithm="HS256")
    return {"Authorization": f"Bearer {t}"}


c = TestClient(main.app)
A, B = token("alice"), token("bob")
try:
    assert c.post("/api/datasets/upload", headers=A, files={"file": ("sales.csv", b"region,qty\nNorth,3\nSouth,5\n")}).status_code == 200
    d1 = c.post("/api/dashboards", headers=A, json={"name": "One"}).json()
    d2 = c.post("/api/dashboards", headers=A, json={"name": "Two"}).json()
    new = lambda d, n, sql="SELECT region, SUM(qty) AS qty FROM sales GROUP BY 1": c.post(  # noqa: E731
        f"/api/dashboards/{d}/widgets/new", headers=A, json={"name": n, "sql": sql, "spec": {"type": "bar", "encoding": {"x": "region", "y": "qty"}}})

    # one call creates query + chart + widget, stacked below the existing widgets
    w1, w2 = new(d1["id"], "Qty").json(), new(d1["id"], "Qty 2").json()
    assert w1["row_count"] == 2 and w2["widget"]["position"]["y"] == 4, w2
    assert new(d1["id"], "Bad", "SELECT nope FROM sales").status_code == 400          # broken SQL never saved
    assert all(ch["name"] != "Bad" for ch in c.get("/api/charts", headers=A).json())
    shared = w2["chart"]["id"]
    c.post(f"/api/dashboards/{d2['id']}/widgets", headers=A, json={"chart_id": shared})
    used = {ch["name"]: ch["used_in"] for ch in c.get("/api/charts", headers=A).json()}
    assert used == {"Qty": 1, "Qty 2": 2}, used

    # bob cannot touch alice's dashboard or its widgets (the old raw DELETE was not workspace-scoped)
    c.delete(f"/api/dashboards/{d1['id']}", headers=B)
    assert len(c.get(f"/api/dashboards/{d1['id']}", headers=A).json()["widgets"]) == 2

    # deleting a chart removes the widgets that show it and its now-unused query
    q_before = len(c.get("/api/queries", headers=A).json())
    assert c.delete(f"/api/charts/{w1['chart']['id']}", headers=A).json()["widgets_removed"] == 1
    assert len(c.get(f"/api/dashboards/{d1['id']}", headers=A).json()["widgets"]) == 1
    assert len(c.get("/api/queries", headers=A).json()) == q_before - 1

    # deleting a dashboard with cleanup keeps charts another dashboard still shows
    out = c.delete(f"/api/dashboards/{d1['id']}?cleanup=true", headers=A).json()
    assert out["widgets"] == 1 and out["charts"] == 0, out
    assert [ch["name"] for ch in c.get("/api/charts", headers=A).json()] == ["Qty 2"]

    # unused list + cleanup only deletes charts that really are unused
    c.delete(f"/api/dashboards/{d2['id']}", headers=A)
    unused = c.get("/api/charts/unused/list", headers=A).json()
    assert [u["name"] for u in unused] == ["Qty 2"]
    assert c.post("/api/charts/unused/cleanup", headers=A, json={"ids": [unused[0]["id"], "not-a-chart"]}).json() == {"removed": 1}
    assert c.get("/api/charts", headers=A).json() == []
    print("PASS test_lifecycle")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
