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

# 5. delete drops the view
engine.drop_table(ds["physical_name"])
with engine.connect(read_only=True) as con:
    assert ds["physical_name"] not in [r[0] for r in con.execute("SHOW TABLES").fetchall()]
print("remote (linked dataset) tests OK")
