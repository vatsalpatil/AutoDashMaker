"""Plain-assert tests: backend/.venv/Scripts/python.exe tests/test_names_restale.py"""
import os
import sys
import tempfile

tmp = tempfile.mkdtemp()  # never touch the real databases
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.store import store
from app.services import names

store.insert("datasets", {"name": "Choc", "physical_name": "ds_test_chocolate_sales_bda92d", "kind": "file", "row_count": 1})
store.insert("datasets", {"name": "A", "physical_name": "ds_dup_aaaaaa", "kind": "file", "row_count": 1})
store.insert("datasets", {"name": "B", "physical_name": "ds_dup_bbbbbb", "kind": "file", "row_count": 1})

# re-uploaded dataset: the old id points at the current table
assert names.restale("SELECT * FROM ds_test_chocolate_sales_75c35d") == "SELECT * FROM ds_test_chocolate_sales_bda92d"
# current names, ambiguous bases and unknown tables stay as written
assert names.restale("SELECT * FROM ds_test_chocolate_sales_bda92d") == "SELECT * FROM ds_test_chocolate_sales_bda92d"
assert names.restale("SELECT * FROM ds_dup_cccccc") == "SELECT * FROM ds_dup_cccccc"
assert names.restale("SELECT * FROM ds_other_123456") == "SELECT * FROM ds_other_123456"
print("ok")
