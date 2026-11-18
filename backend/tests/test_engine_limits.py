"""Row cap + crash recovery regressions: backend/.venv/Scripts/python.exe tests/test_engine_limits.py"""
import os
import shutil
import sys
import tempfile

tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=os.path.join(tmp, "m.duckdb"), ANALYTICS_DB=os.path.join(tmp, "a.duckdb"),
                  DUCKDB_TEMP_DIR=os.path.join(tmp, "spill"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.services.engine import QueryEngine  # noqa: E402

path = os.path.join(tmp, "a.duckdb")
e = QueryEngine(path)
with e.writer() as c:
    c.execute("CREATE TABLE t AS SELECT i FROM range(50000) r(i)")

# 1. an explicit LIMIT above the row cap must not materialise everything (was 1M dicts / 25 s)
r = e.execute("SELECT i FROM t ORDER BY i LIMIT 40000", row_limit=100)
assert r["row_count"] == 100 and r["rows"][-1]["i"] == 99, r["row_count"]
assert any(w.startswith("truncated") for w in r["warnings"]), r["warnings"]
r = e.execute("SELECT i FROM t ORDER BY i LIMIT 40000")  # default cap 10k
assert r["row_count"] == 10_000
# exactly at the cap is not "truncated"
r = e.execute("SELECT i FROM t LIMIT 100", row_limit=100)
assert r["row_count"] == 100 and not any(w.startswith("truncated") for w in r["warnings"])

# 2. the cap is part of the cache key: a small-cap result is never served to a bigger-cap caller
q = "SELECT i FROM t ORDER BY i LIMIT 500"
assert e.execute(q, row_limit=10)["row_count"] == 10
r = e.execute(q, row_limit=1000)
assert r["row_count"] == 500 and r["cached"] is False
assert e.execute(q, row_limit=1000)["cached"] is True

# 3. leftovers of an ingest killed mid-way are cleaned when the instance is (re)opened
pq = os.path.join(tmp, "parquet")
os.makedirs(pq, exist_ok=True)
open(os.path.join(pq, "ds_x.parquet.tmp"), "wb").write(b"half written")
open(os.path.join(pq, "ds_keep.parquet"), "wb").write(b"real")
with e.writer() as c:
    c.execute("CREATE TABLE ds_x__stg AS SELECT 1 AS a")
e.close()
e2 = QueryEngine(path)
tables = e2.list_tables()
assert "ds_x__stg" not in tables and "t" in tables, tables
assert not os.path.exists(os.path.join(pq, "ds_x.parquet.tmp"))
assert os.path.exists(os.path.join(pq, "ds_keep.parquet"))
e2.close()

shutil.rmtree(tmp, ignore_errors=True)
print("test_engine_limits OK")
