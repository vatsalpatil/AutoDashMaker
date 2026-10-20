"""Backoffice API: admins only, sees every workspace, activity log, suspension blocks the user. Run: python tests/test_admin.py"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TMP = tempfile.mkdtemp(prefix="adm_admin_")
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET="s" * 40, SUPABASE_SERVICE_KEY="", ADMIN_EMAILS='["boss@x.com"]',
                  METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads",
                  DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import Main as main  # noqa: E402
from app.services.admin import activity  # noqa: E402


def token(uid: str, email: str) -> dict:
    t = jwt.encode({"sub": uid, "email": email, "aud": "authenticated", "exp": time.time() + 600}, "s" * 40, algorithm="HS256")
    return {"Authorization": f"Bearer {t}"}


c = TestClient(main.app)
BOSS, ALICE = token("boss", "boss@x.com"), token("alice", "alice@x.com")

try:
    up = c.post("/api/datasets/upload", headers=ALICE, files={"file": ("sales.csv", b"region,qty\nNorth,3\n")})
    assert up.status_code == 200, up.text
    # a normal user is refused; the admin is let in
    assert c.get("/api/admin/overview", headers=ALICE).status_code == 403
    assert c.get("/api/admin/me", headers=BOSS).json()["admin"] is True
    activity.flush()
    ov = c.get("/api/admin/overview", headers=BOSS).json()
    assert ov["totals"]["datasets"] == 1 and ov["activity"]["requests_24h"] >= 2, ov
    # activity log knows who did what
    rows = c.get("/api/admin/activity?q=upload", headers=BOSS).json()
    assert rows and rows[0]["email"] == "alice@x.com" and rows[0]["status"] == 200, rows
    # suspend -> Alice is refused everywhere; unsuspend -> back
    assert c.post("/api/admin/users/alice/suspend", headers=BOSS, json={"suspended": True, "reason": "test"}).status_code == 200
    r = c.get("/api/datasets", headers=ALICE)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "suspended", r.text
    c.post("/api/admin/users/alice/suspend", headers=BOSS, json={"suspended": False})
    assert c.get("/api/datasets", headers=ALICE).status_code == 200
    # the admin's own data view stays separate: as a normal user the admin sees only their own workspace
    assert c.get("/api/datasets", headers=BOSS).json() == []
    print("test_admin: OK")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
