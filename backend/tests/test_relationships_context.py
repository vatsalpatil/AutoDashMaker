"""Saved relationships reach the AI prompts (Ask / SQL assistant / notebook agent) with each side's cardinality.
Run: backend/.venv/Scripts/python.exe tests/test_relationships_context.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
t = tempfile.mkdtemp()
os.environ.update(METADATA_DB=t + "/m.duckdb", ANALYTICS_DB=t + "/a.duckdb", UPLOAD_DIR=t + "/u", DUCKDB_TEMP_DIR=t + "/s")

from app.core.store import store
from app.services import agent
from app.services.ai_context import relationships_text, workbench_context

assert relationships_text() == ""                       # nothing saved → nothing added
o = store.insert("datasets", {"name": "orders", "physical_name": "ds_o", "row_count": 100})
i = store.insert("datasets", {"name": "order_items", "physical_name": "ds_i", "row_count": 300})
store.insert("columns_meta", {"dataset_id": o["id"], "name": "order_id", "dtype": "VARCHAR", "distinct_count": 100})
store.insert("columns_meta", {"dataset_id": i["id"], "name": "order_id", "dtype": "VARCHAR", "distinct_count": 100})
store.insert("relationships", {"left_dataset_id": o["id"], "left_column": "order_id", "right_dataset_id": i["id"], "right_column": "order_id"})

c = workbench_context(None)
assert "orders.order_id = order_items.order_id (one orders row ↔ many order_items rows)" in c, c[-500:]
assert "aggregate the 'many' side" in c
a = agent.context("", None, [], "ask")
assert "How the tables join" in a and "one orders row" in a, a
print("test_relationships_context OK")
