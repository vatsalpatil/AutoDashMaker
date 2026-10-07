"""Friendly dataset names in SQL resolve to physical tables; CTEs, ambiguous and physical names are left alone.
Run: backend/.venv/Scripts/python.exe tests/test_names.py"""
import os
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()  # never touch the real databases
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")

from app.core.store import store
from app.services import names
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE ds_sales_ab12 AS SELECT 1 AS id, 10.5 AS amount UNION ALL SELECT 2, 4.5")
    con.execute("CREATE TABLE ds_dup_1 AS SELECT 1 AS x")
    con.execute("CREATE TABLE ds_dup_2 AS SELECT 2 AS x")
store.insert("datasets", {"name": "Sales", "physical_name": "ds_sales_ab12", "kind": "file"})
store.insert("datasets", {"name": "dup", "physical_name": "ds_dup_1", "kind": "file"})
store.insert("datasets", {"name": "DUP", "physical_name": "ds_dup_2", "kind": "file"})
names.invalidate()

# friendly name, any case, with alias / join / subquery
assert engine.execute("SELECT SUM(amount) AS s FROM sales")["rows"][0]["s"] == 15.0
assert engine.execute("SELECT SUM(s.amount) AS s FROM Sales s")["rows"][0]["s"] == 15.0
assert engine.execute("SELECT COUNT(*) AS n FROM (SELECT * FROM SALES) t")["rows"][0]["n"] == 2
# the physical name still works
assert engine.execute("SELECT COUNT(*) AS n FROM ds_sales_ab12")["rows"][0]["n"] == 2
# a CTE / notebook step with the same name wins over the dataset
assert engine.execute("WITH sales AS (SELECT 99 AS amount) SELECT amount FROM sales")["rows"][0]["amount"] == 99
# ambiguous names are not guessed
try:
    engine.execute("SELECT * FROM dup")
    raise SystemExit("ambiguous name should not resolve")
except Exception as e:
    assert "SystemExit" not in type(e).__name__
assert engine.check_sql("SELECT amount FROM sales") is None
assert "amout" in engine.check_sql("SELECT amout FROM sales").lower()
print("names tests OK")
