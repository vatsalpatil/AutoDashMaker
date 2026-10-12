"""Linked (live) datasets: schema-only import, queries run against the source, refresh, delete.
A local SQLite file stands in for the remote database. Run: backend/.venv/Scripts/python.exe tests/test_remote.py"""
import os
import sqlite3
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")

from app.core.store import store
from app.services import remote
from app.services.engine import engine
from app.services.ingest import refresh_dataset

# the "remote" database
remote_path = os.path.join(tmp, "remote.sqlite")
db = sqlite3.connect(remote_path)
db.execute("CREATE TABLE sales (id INTEGER, region TEXT, amount REAL)")
db.executemany("INSERT INTO sales VALUES (?,?,?)", [(1, "N", 10.0), (2, "S", 20.0)])
db.commit()

src = store.insert("datasources", {"name": "remote", "type": "sqlite", "config": {"path": remote_path}})

# 1. link: schema + row count only
ds = remote.link_source(src, "sales", "sales_live")
assert ds["remote_table"] == "sales" and ds["row_count"] == 2, ds
assert {c["name"] for c in ds["columns"]} == {"id", "region", "amount"}, ds["columns"]
assert store.get("datasets", ds["id"])["kind"] == "sqlite"

# 2. nothing was copied: the analytics DB holds a VIEW, not a table
with engine.connect(read_only=True) as con:
    kinds = dict(con.execute("SELECT table_name, table_type FROM information_schema.tables").fetchall())
assert kinds.get(ds["physical_name"]) == "VIEW", kinds

# 3. queries run live against the source (attached on demand)
r = engine.execute(f"SELECT region, SUM(amount) AS total FROM {ds['physical_name']} GROUP BY region ORDER BY region")
assert [(x["region"], x["total"]) for x in r["rows"]] == [("N", 10.0), ("S", 20.0)], r["rows"]
assert engine.check_sql(f"SELECT nope FROM {ds['physical_name']}") is not None  # bind check sees the remote schema
assert engine.describe_table(ds["physical_name"])["row_count"] == 2

# 3b. the rewrite keeps aliases, joins and subqueries working; unrelated tables are left alone
v = ds["physical_name"]
r = engine.execute(f"SELECT a.region, b.amount FROM {v} AS a JOIN {v} AS b ON a.id = b.id WHERE a.id IN (SELECT id FROM {v} WHERE amount > 10)")
assert [(x["region"], x["amount"]) for x in r["rows"]] == [("S", 20.0)], r["rows"]
assert remote.rewrite_sql("SELECT 1 AS x FROM some_other_table") == "SELECT 1 AS x FROM some_other_table"
assert 'remote_' in remote.rewrite_sql(f"SELECT * FROM {v}") and v.lower() in remote.rewrite_sql(f"SELECT * FROM {v}").lower()

# 4. the source changes -> the next query sees it (a copy would not); refresh updates the stored row count
db.execute("INSERT INTO sales VALUES (3, 'W', 30.0)")
db.commit()
engine.invalidate()
assert engine.execute(f"SELECT COUNT(*) AS n FROM {ds['physical_name']}")["rows"][0]["n"] == 3
assert refresh_dataset(ds["id"])["row_count"] == 3

# 4. link -> stored copy: same name keeps working, now local (no source needed), with its own Parquet file
import time
from app.services import columnar, copy_jobs

ds2 = remote.link_source(src, "sales", "sales_to_copy")
assert remote.is_linked(ds2["physical_name"])
assert copy_jobs.state(ds2["id"])["state"] == "idle"
copy_jobs.start(store.get("datasets", ds2["id"]))
for _ in range(100):
    if copy_jobs.state(ds2["id"])["state"] != "running":
        break
    time.sleep(0.1)
assert copy_jobs.state(ds2["id"]) == {"state": "done"}, copy_jobs.state(ds2["id"])
after = store.get("datasets", ds2["id"])
assert not after.get("remote_table") and after["row_count"] == 3, after
assert not remote.is_linked(ds2["physical_name"]) and columnar.parquet_path(ds2["physical_name"]).exists()
db.execute("DELETE FROM sales")   # the source loses its rows: a stored copy must not care
db.commit()
assert engine.execute(f"SELECT COUNT(*) AS n FROM {ds2['physical_name']}")["rows"][0]["n"] == 3
engine.drop_table(ds2["physical_name"])

# 4b. the copy runs in a separate worker process; if that process dies, only the copy fails and the dataset stays a working live link
import time as _time

from app.connectors import ConnectorError
from app.core.config import settings as _settings
from app.services import remote as _r

_real_cmd = _r.WORKER_CMD
ds3 = remote.link_source(src, "sales", "sales_fail")
phys3 = ds3["physical_name"]
for cmd, expect in [
    ([sys.executable, "-c", "import os; os._exit(137)"], "out of memory"),                       # SIGKILL / OOM killer
    ([sys.executable, "-c", "import os; os._exit(139)"], "crashed"),                             # segfault
    ([sys.executable, "-c", "import sys; sys.stderr.write('Boom: no route to host\\n'); sys.exit(1)"], "Boom: no route to host"),
    ([sys.executable, "-c", "print('no json here')"], "without a result"),
]:
    _r.WORKER_CMD = cmd
    try:
        _r.convert_to_copy(store.get("datasets", ds3["id"]))
        raise SystemExit(f"expected a failure for {expect!r}")
    except ConnectorError as e:
        assert expect in str(e), (expect, str(e))
    after = store.get("datasets", ds3["id"])
    assert after["remote_table"] == "sales" and remote.is_linked(phys3), after          # still a live link
    assert not columnar.parquet_path(phys3).exists() and not columnar.parquet_path(phys3).with_name(phys3 + ".parquet.copy.tmp").exists()
    assert engine.execute(f"SELECT COUNT(*) AS n FROM {phys3}")["rows"][0]["n"] == 0    # and it still answers (the source table was emptied above)

# a worker that hangs is stopped
_r.WORKER_CMD = [sys.executable, "-c", "import time; time.sleep(30)"]
_settings.copy_timeout_s = 1
t0 = _time.monotonic()
try:
    _r.convert_to_copy(store.get("datasets", ds3["id"]))
    raise SystemExit("expected a timeout")
except ConnectorError as e:
    assert "seconds" in str(e) and _time.monotonic() - t0 < 10, str(e)
_settings.copy_timeout_s = 3600

# the real worker, but the table does not exist (any source-side error comes back as a message)
_r.WORKER_CMD = _real_cmd
store.update("datasets", ds3["id"], {"remote_table": "no_such_table"})
try:
    _r.convert_to_copy(store.get("datasets", ds3["id"]))
    raise SystemExit("expected an error for a missing table")
except ConnectorError as e:
    assert str(e) and "Traceback" not in str(e), str(e)
store.update("datasets", ds3["id"], {"remote_table": "sales"})
engine.drop_table(phys3)

# a bigger table streams through the worker: 2M rows in, the same 2M rows readable from Parquet, and quickly
db.execute("CREATE TABLE big (id INTEGER, region TEXT, amount REAL)")
db.execute("WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 2000000) INSERT INTO big SELECT x, CASE x % 4 WHEN 0 THEN 'N' WHEN 1 THEN 'S' WHEN 2 THEN 'E' ELSE 'W' END, x * 0.5 FROM c")
db.commit()
dsb = remote.link_source(src, "big", "big_live")
t0 = _time.monotonic()
copy_jobs.start(store.get("datasets", dsb["id"]))
for _ in range(900):
    if copy_jobs.state(dsb["id"])["state"] != "running":
        break
    _time.sleep(0.1)
took = _time.monotonic() - t0
assert copy_jobs.state(dsb["id"]) == {"state": "done"}, copy_jobs.state(dsb["id"])
rowsb = engine.execute(f"SELECT COUNT(*) AS n, SUM(amount) AS s FROM {dsb['physical_name']}")["rows"][0]
assert rowsb["n"] == 2000000 and rowsb["s"] == sum(x * 0.5 for x in range(1, 2000001)), rowsb
assert store.get("datasets", dsb["id"])["row_count"] == 2000000 and not store.get("datasets", dsb["id"]).get("remote_table")
assert took < 60, f"2M-row copy took {took:.1f}s"
assert {c["name"] for c in store.list("columns_meta", where="dataset_id = ?", params=[dsb["id"]], order=None)} == {"id", "region", "amount"}
engine.drop_table(dsb["physical_name"])

# 5. delete drops the view
engine.drop_table(ds["physical_name"])
with engine.connect(read_only=True) as con:
    assert ds["physical_name"] not in [r[0] for r in con.execute("SHOW TABLES").fetchall()]
print("remote (linked dataset) tests OK")
