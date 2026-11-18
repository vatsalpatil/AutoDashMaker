"""Security regressions (2026-11 audit): SQL guard bypasses, SSRF address checks, JWT alg/exp, admin vs access tokens,
AI-provider base URL SSRF, cross-workspace reads. Run: backend/.venv/Scripts/python.exe backend/tests/test_isolation_security.py"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TMP = tempfile.mkdtemp(prefix="adm_isosec_")
SECRET = "k" * 40
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET=SECRET, SUPABASE_SERVICE_KEY="", ADMIN_EMAILS='["boss@x.com"]',
                  METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads",
                  DUCKDB_TEMP_DIR=f"{TMP}/spill", DISK_USAGE_LIMIT_PCT="0")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import Main as main  # noqa: E402
from app.core import netguard  # noqa: E402
from app.core.security import UnsafeQueryError, validate_readonly  # noqa: E402


def tok(uid, email, **extra):
    claims = {"sub": uid, "email": email, "aud": "authenticated", "exp": time.time() + 600, **extra}
    return {"Authorization": f"Bearer {jwt.encode(claims, SECRET, algorithm='HS256')}"}


def blocked_sql(q):
    try:
        validate_readonly(q, 10)
    except UnsafeQueryError:
        return True
    return False


def blocked_host(h):
    try:
        netguard.ensure_public_host(h)
    except netguard.NetworkBlocked:
        return True
    return False


c = TestClient(main.app)
A, B = tok("alice", "alice@x.com"), tok("bob", "bob@x.com")
try:
    # --- SQL guard: files, network, settings, multi-statement, DDL --------------------------------------------------
    for q in ["SELECT * FROM 'x.parquet'", "FROM 'x.csv'", "SELECT * FROM read_csv('/etc/passwd')", "ATTACH 'a.db'",
              "SELECT 1; DROP TABLE t", "COPY t TO 'o.csv'", "PRAGMA version", "SET enable_external_access=true",
              "SELECT * FROM glob('*')", "SELECT getenv('HOME')", "SELECT current_setting('threads')", "INSTALL httpfs",
              "LOAD httpfs", "SELECT * FROM 's3://b/k'", "SELECT * FROM duckdb_secrets()", "SELECT set_variable('a', 1)",
              "SELECT http_get('http://x')", "SELECT * FROM query_table('t')", "UPDATE t SET a = 1 RETURNING *",
              "WITH a AS (SELECT * FROM 'f.csv') SELECT * FROM a", "SELECT * FROM t WHERE x IN (SELECT * FROM 'a.csv')",
              "SELECT * FROM '../ws/ws_bob/parquet/x.parquet'", "CALL pragma_version()", "SELECT read_blob('a')"]:
        assert blocked_sql(q), f"SQL guard let through: {q}"
    assert not blocked_sql("SELECT a, count(*) FROM t GROUP BY a") and not blocked_sql("SELECT * FROM range(5)")

    # --- SSRF: private / mapped / CGNAT / metadata addresses -------------------------------------------------------
    for h in ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe",
              "64:ff9b::7f00:1", "fd00::1", "0.0.0.0", "localhost"]:
        assert blocked_host(h), f"SSRF guard let through {h}"
    assert not blocked_host("8.8.8.8")

    # --- JWT: signature, aud, exp required, alg allow-list --------------------------------------------------------
    assert c.get("/api/datasets", headers=A).status_code == 200
    bad = [
        {"Authorization": "Bearer " + jwt.encode({"sub": "x", "aud": "authenticated", "exp": time.time() + 60}, "w" * 40, algorithm="HS256")},
        {"Authorization": "Bearer " + jwt.encode({"sub": "x", "aud": "other", "exp": time.time() + 60}, SECRET, algorithm="HS256")},
        {"Authorization": "Bearer " + jwt.encode({"sub": "x", "aud": "authenticated", "exp": time.time() - 60}, SECRET, algorithm="HS256")},
        {"Authorization": "Bearer " + jwt.encode({"sub": "x", "aud": "authenticated"}, SECRET, algorithm="HS256")},  # no exp
        {"Authorization": "Bearer " + jwt.encode({"sub": "x", "aud": "authenticated", "exp": time.time() + 60}, SECRET, algorithm="HS512")},
        {"Authorization": "Bearer " + jwt.encode({"sub": "x", "aud": "authenticated", "exp": time.time() + 60}, None, algorithm="none")},
        {},
    ]
    for h in bad:
        assert c.get("/api/datasets", headers=h).status_code == 401, h

    # --- admin: normal users and access tokens are refused -------------------------------------------------------
    assert c.get("/api/admin/overview", headers=A).status_code == 403
    BOSS = tok("boss", "boss@x.com")
    assert c.get("/api/admin/overview", headers=BOSS).status_code == 200
    pat = c.post("/api/access-tokens", headers=BOSS, json={"name": "t", "scope": "full"})
    assert pat.status_code == 200, pat.text
    assert c.get("/api/admin/overview", headers={"Authorization": f"Bearer {pat.json()['token']}"}).status_code == 403

    # --- AI provider custom base URL cannot target internal hosts -----------------------------------------------
    r = c.post("/api/ai/providers", headers=A, json={"label": "x", "provider": "openai_compatible", "model": "m",
                                                    "api_key": "k", "base_url": "http://169.254.169.254/latest"})
    assert r.status_code == 400 and "not allowed" in r.text, r.text

    # --- cross-workspace: bob cannot see / fetch / delete alice's dataset ----------------------------------------
    up = c.post("/api/datasets/upload", headers=A, files={"file": ("s.csv", b"region,qty\nNorth,3\n")})
    assert up.status_code == 200, up.text
    ds = up.json().get("dataset", up.json())
    assert all(d["id"] != ds["id"] for d in c.get("/api/datasets", headers=B).json())
    assert c.get(f"/api/datasets/{ds['id']}", headers=B).status_code == 404
    c.delete(f"/api/datasets/{ds['id']}", headers=B)
    assert c.get(f"/api/datasets/{ds['id']}", headers=A).status_code == 200
    q = c.post("/api/queries/run", headers=B, json={"sql": f"SELECT * FROM {ds['physical_name']}"})
    assert q.status_code >= 400 or not q.json().get("rows"), q.text
    print("isolation/security regression tests OK")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
