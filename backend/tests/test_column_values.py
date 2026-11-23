"""AI prompt lists the exact values of low-cardinality text columns (so filters use the data's spelling/case).
Run: backend/.venv/Scripts/python.exe tests/test_column_values.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services import column_values as cv
from app.services.ai_context import workbench_context
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE ds_orders AS SELECT * FROM (VALUES (1,'Completed','Online','North'), (2,'Returned','Store','South'),"
                " (3,'Cancelled','Partner','East'), (4,'Completed','Online','West'), (5,'Completed','Store','Mid'), (6,'Completed','Store','Far'),"
                " (7,'Completed','Store','Isle')) t(order_id, status, channel, region)")
d = store.insert("datasets", {"name": "orders", "physical_name": "ds_orders", "row_count": 7, "kind": "file"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "order_id", "dtype": "INTEGER", "distinct_count": 7, "sample_values": "[\"1\"]"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "status", "dtype": "VARCHAR", "distinct_count": 3,
                              "sample_values": "[\"Completed\", \"Returned\", \"Cancelled\"]"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "region", "dtype": "VARCHAR", "distinct_count": 7,
                              "sample_values": "[\"North\", \"South\", \"East\", \"West\", \"Mid\"]"})   # 7 > 5 samples → read once

ctx = workbench_context(d["id"])
assert "status VARCHAR = 'Completed'|'Returned'|'Cancelled'" in ctx, ctx      # from the stored samples, no query
assert "region VARCHAR = 'East'|'Far'|'Isle'|'Mid'|'North'|'South'|'West'" in ctx, ctx   # DISTINCT query, sorted
assert "order_id INTEGER" in ctx and "order_id INTEGER =" not in ctx           # numbers are not listed
assert "case-sensitive" in ctx

# many distinct values → not listed; quotes inside values are escaped
assert cv.values_for(d, {"name": "x", "dtype": "VARCHAR", "distinct_count": 500}) is None
assert cv.describe(d, {"name": "n", "dtype": "VARCHAR", "distinct_count": 1, "sample_values": "[\"O'Brien\"]"}) == "n VARCHAR = 'O''Brien'"
print("test_column_values OK")
