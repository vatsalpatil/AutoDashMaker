"""Imports store full column stats; older datasets with names+types only are back-filled once.
Run: backend/.venv/Scripts/python.exe tests/test_column_stats.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
t = tempfile.mkdtemp()
os.environ.update(METADATA_DB=t + "/m.duckdb", ANALYTICS_DB=t + "/a.duckdb", UPLOAD_DIR=t + "/u", DUCKDB_TEMP_DIR=t + "/s")

from app.core.store import store
from app.services import column_stats
from app.services.ai_context import workbench_context
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE ds_orders AS SELECT * FROM (VALUES ('O1','Completed'), ('O2','Returned'), ('O3','Completed')) t(order_id, status)")
d = store.insert("datasets", {"name": "orders", "physical_name": "ds_orders", "row_count": 3})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "order_id", "dtype": "VARCHAR"})   # what connectors store
store.insert("columns_meta", {"dataset_id": d["id"], "name": "status", "dtype": "VARCHAR"})

ctx = workbench_context(None)   # back-fills on first use
assert "status VARCHAR = 'Completed'|'Returned'" in ctx or "status VARCHAR = 'Returned'|'Completed'" in ctx, ctx
meta = {c["name"]: c for c in store.list("columns_meta", where="dataset_id = ?", params=[d["id"]], order=None)}
assert meta["status"]["distinct_count"] == 2 and meta["order_id"]["distinct_count"] == 3, meta

# tried once: a dataset whose stats cannot be read is not retried on every request
bad = store.insert("datasets", {"name": "gone", "physical_name": "ds_missing", "row_count": 1})
column_stats.ensure(); column_stats.ensure()
assert sum(1 for k in column_stats._tried if k[1] == bad["id"]) == 1
print("test_column_stats OK")
