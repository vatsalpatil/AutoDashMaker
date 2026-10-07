"""Rule-based query checks. Run: backend/.venv/Scripts/python.exe tests/test_lint.py"""
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
from app.services.sql_lint import lint

store.insert("datasets", {"name": "big", "physical_name": "ds_big_1", "kind": "file", "row_count": 1_000_000})
store.insert("datasets", {"name": "tiny", "physical_name": "ds_tiny_1", "kind": "file", "row_count": 5})


def titles(sql):
    return [c["title"] for c in lint(sql)]


assert titles("SELECT * FROM big") == ["SELECT * reads every column", "No LIMIT"], titles("SELECT * FROM big")
assert titles("SELECT * FROM tiny") == []                                        # small tables: no noise
assert titles("SELECT region, SUM(x) FROM big GROUP BY 1") == []                 # aggregates return few rows
assert titles("SELECT a FROM big ORDER BY a LIMIT 10") == []
assert "Sorting without a LIMIT" in titles("SELECT a FROM big ORDER BY a")
assert "NOT IN (subquery)" in titles("SELECT a FROM tiny WHERE a NOT IN (SELECT a FROM big)")
assert "Function on a filtered column" in titles("SELECT a FROM big WHERE year(d) = 2024 LIMIT 5")
assert "Function on a filtered column" not in titles("SELECT a FROM big WHERE d >= DATE '2024-01-01' LIMIT 5")
assert "LIKE starting with %" in titles("SELECT a FROM tiny WHERE n LIKE '%x'")
assert "DISTINCT together with GROUP BY" in titles("SELECT DISTINCT a FROM tiny GROUP BY a")
assert "Join without a condition" in titles("SELECT * FROM tiny CROSS JOIN tiny t2")
assert "Join without a condition" not in titles("SELECT * FROM tiny JOIN big ON tiny.a = big.a")
assert lint("this is not sql") == [] and lint("") == []
print("lint tests OK")
