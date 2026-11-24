"""Run: backend/.venv/Scripts/python.exe tests/test_security.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # point every store at a temp dir BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb",
                  UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/spill")
os.makedirs(tmp + "/up")

from app.core.security import quote_ident, redact_secrets

# secrets in connector error text are masked
msg = "Client error '401' for url 'https://api.x.com/v1/data?api_key=SECRET123&page=2' via postgres://bob:hunter2@db:5432/x"
red = redact_secrets(msg)
assert "SECRET123" not in red and "hunter2" not in red and "page=2" in red and "bob" not in red, red

# identifiers with embedded quotes are escaped, not injected
assert quote_ident('a"b') == '"a""b"'
from app.services.engine import QueryEngine
e = QueryEngine(tmp + "/e.duckdb")
with e.writer() as c:
    c.execute('CREATE TABLE t ("a""b" INTEGER, x INTEGER)')
    c.execute("INSERT INTO t VALUES (1, 2), (3, 4)")
d = e.describe_table("t")
assert [c["name"] for c in d["columns"]] == ['a"b', "x"] and d["row_count"] == 2, d

# uploads cannot escape the upload directory
from starlette.testclient import TestClient
import Main as main
client = TestClient(main.app)
r = client.post("/api/datasets/upload", files={"file": ("../../evil.csv", b"a,b\n1,2\n", "text/csv")})
assert r.status_code == 200, r.text
assert os.path.exists(tmp + "/up/evil.csv") and not os.path.exists(tmp + "/evil.csv")
# parsed as DuckDB, so what runs is what the user wrote (the generic dialect shifted list indexes and dropped
# regexp_extract's group argument)
from app.core.security import UnsafeQueryError, validate_readonly as _v
assert "[1, 2][1]" in _v("SELECT [1,2][1] AS x", 10), _v("SELECT [1,2][1] AS x", 10)
assert "', 1)" in _v("""SELECT regexp_extract(n, '"(\\d+)"', 1) FROM t""", 10)
# DuckDB's PIVOT statement (with ORDER BY / LIMIT) runs as a plain SELECT; a smuggled second statement still fails
assert _v("PIVOT (SELECT d, s FROM t) ON s USING count(*) GROUP BY d ORDER BY d", 10).startswith("SELECT * FROM (PIVOT")
for bad in ("PIVOT t ON s USING count(*); DROP TABLE t", "DROP TABLE t"):
    try:
        _v(bad, 10)
        raise AssertionError(f"allowed: {bad}")
    except UnsafeQueryError:
        pass
print("security tests OK")
