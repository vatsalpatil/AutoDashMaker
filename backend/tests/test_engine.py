"""Plain-assert tests (no pytest needed): backend/.venv/Scripts/python.exe tests/test_engine.py"""
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings

tmp = tempfile.mkdtemp()
settings.duckdb_temp_dir = os.path.join(tmp, "spill")
from app.services.engine import QueryEngine, QueryTimeout

e = QueryEngine(os.path.join(tmp, "a.duckdb"))
with e.writer() as c:
    c.execute("CREATE TABLE t AS SELECT i AS id, i % 5 AS g, NULL AS n FROM range(1000) r(i)")

q = "SELECT g, COUNT(*) c FROM t GROUP BY g ORDER BY g"
r1 = e.execute(q)
assert r1["cached"] is False and r1["row_count"] == 5
r2 = e.execute(q)
assert r2["cached"] is True and r2["rows"] == r1["rows"], "cache hit expected"
with e.writer() as c:
    c.execute("INSERT INTO t VALUES (9999, 0, NULL)")
r3 = e.execute(q)
assert r3["cached"] is False and r3["rows"][0]["c"] == 201, "write must invalidate cache"
with e.connect(read_only=True):
    pass
assert len(e._cache) == 1, "read-only connect must not invalidate"

try:
    r3["rows"].append({})
    raise SystemExit("cached rows must be immutable")
except AttributeError:
    pass

# caller mutation of a returned result must not leak into later cache hits
r4 = e.execute("SELECT g FROM t GROUP BY g ORDER BY g")
r4["query_id"] = "STALE"
assert "query_id" not in e.execute("SELECT g FROM t GROUP BY g ORDER BY g")

# clock/random-dependent SQL is never cached
a = e.execute("SELECT CAST(now() AS VARCHAR) AS ts")
assert e.execute("SELECT CAST(now() AS VARCHAR) AS ts")["cached"] is False
assert e.execute("SELECT random() AS r")["cached"] is False

d = e.describe_table("t")
assert d["row_count"] == 1001 and [c["name"] for c in d["columns"]] == ["id", "g", "n"]
assert d["columns"][2]["null_pct"] == 100 and d["columns"][1]["distinct_count"] == 5

settings.query_timeout_s = 1
t0 = time.time()
try:
    e.execute("SELECT COUNT(*) FROM range(100000000000) a, range(1000000) b")
    raise SystemExit("expected timeout")
except QueryTimeout:
    assert time.time() - t0 < 5
print("engine tests OK")
