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

# --- one shared instance, many cursors: queries run concurrently and correctly
from concurrent.futures import ThreadPoolExecutor

with e.writer() as c:
    c.execute("CREATE TABLE big AS SELECT i AS id, i % 10 AS g FROM range(2000000) r(i)")
queries = [f"SELECT SUM(id) AS s FROM big WHERE g = {k}" for k in range(8)]
with ThreadPoolExecutor(8) as pool:
    got = list(pool.map(lambda sql: e.execute(sql)["rows"][0]["s"], queries))
expected = [sum(i for i in range(2000000) if i % 10 == k) for k in range(8)]
assert got == expected, (got, expected)

# --- single flight: the same slow query asked 6 times at once runs once, the rest share its result
slow = "SELECT COUNT(*) AS n FROM range(120000000) t(i) WHERE i % 7 = 0"
with ThreadPoolExecutor(6) as pool:
    outs = list(pool.map(lambda _: e.execute(slow), range(6)))
assert all(o["rows"][0]["n"] == 17142858 for o in outs), [o["rows"] for o in outs]
assert sum(1 for o in outs if o["cached"] is False) == 1, [o["cached"] for o in outs]

# --- a write is visible to the next read (shared instance) and clears the cache
before = e.execute("SELECT COUNT(*) AS n FROM big")["rows"][0]["n"]
with e.writer() as c:
    c.execute("INSERT INTO big VALUES (-1, 0)")
assert e.execute("SELECT COUNT(*) AS n FROM big")["rows"][0]["n"] == before + 1

# --- the result cache is bounded by total rows, not only by entry count
from app.core.config import settings as _s
_s.result_cache_total_rows = 50
for k in range(10):
    e.execute(f"SELECT i FROM range({k + 20}) t(i)")
assert e._cache_rows <= 50 and len(e._cache) < 10, (e._cache_rows, len(e._cache))

# --- close() releases the file; the next use reopens it
e.close()
assert e._base is None
assert e.execute("SELECT COUNT(*) AS n FROM t")["rows"][0]["n"] == 1001

# --- the result sanity warnings are cheap and still right
assert QueryEngine._profile_result([], ["a"]) == ["empty_result: query returned zero rows"]
assert QueryEngine._profile_result([{"a": 1}] * 5, ["a"]) == ["duplicate_rows: every row is identical"]
assert QueryEngine._profile_result([{"a": i, "b": None} for i in range(30)], ["a", "b"]) == ["null_explosion: column 'b' is 100% null"]
t1 = time.perf_counter()
QueryEngine._profile_result([{"a": i, "b": i % 3, "c": str(i)} for i in range(10000)], ["a", "b", "c"])
assert time.perf_counter() - t1 < 0.15, "profiling a 10k-row result must stay cheap"

print("engine tests OK")
