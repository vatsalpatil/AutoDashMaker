"""Plain-language SQL errors: GROUP BY hint, no internal ds_ table names or caret blocks, friendly guard messages.
Run: backend/.venv/Scripts/python.exe tests/test_sql_errors.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
t = tempfile.mkdtemp()
os.environ.update(METADATA_DB=t + "/m.duckdb", ANALYTICS_DB=t + "/a.duckdb", UPLOAD_DIR=t + "/u", DUCKDB_TEMP_DIR=t + "/s")

from app.core.store import store
from app.services import sql_errors as se

d = store.insert("datasets", {"name": "orders", "physical_name": "ds_orders_a0d720"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "region", "dtype": "VARCHAR"})
assert "GROUP BY ALL" in se.friendly('Binder Error: column "region" must appear in the GROUP BY clause or must be part of an aggregate function.')
out = se.friendly('Conversion Error: date field value out of range: "2025-13-45"\n\nLINE 1: ...SELECT * FROM ds_orders_a0d720 AS orders')
assert out == 'date field value out of range: "2025-13-45"', out
assert "ds_orders_a0d720" not in se.friendly("Catalog Error: problem in ds_orders_a0d720") and "orders" in se.friendly("Catalog Error: problem in ds_orders_a0d720")
assert "Did you mean 'region'" in se.friendly('Binder Error: Referenced column "regoin" not found')
assert "DELETE is not allowed" in se.unsafe(Exception("Statement type not allowed: Delete"))
assert se.unsafe(Exception("SQL does not parse: Expecting ). Line 1, Col: 27.")).startswith("SQL syntax error")
print("test_sql_errors OK")
