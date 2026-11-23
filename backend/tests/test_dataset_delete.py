"""Deleting a dataset removes its relationships and its now-unused uploaded file source (and file); DB sources stay.
Run: backend/.venv/Scripts/python.exe tests/test_dataset_delete.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
t = tempfile.mkdtemp()
os.environ.update(METADATA_DB=t + "/m.duckdb", ANALYTICS_DB=t + "/a.duckdb", UPLOAD_DIR=t + "/u", DUCKDB_TEMP_DIR=t + "/s")

from app.core import tenant
from app.core.store import store
from app.routers.datasets import delete_dataset
from app.routers.datasources import sources_health

f = tenant.upload_dir() / "a.csv"
f.write_text("x\n1\n")
src = store.insert("datasources", {"name": "a.csv", "type": "file", "config": {"path": str(f)}})
db = store.insert("datasources", {"name": "shop db", "type": "sqlite", "config": {"path": t + "/x.sqlite"}})
a = store.insert("datasets", {"name": "a", "physical_name": "ds_a", "source_id": src["id"]})
b = store.insert("datasets", {"name": "b", "physical_name": "ds_b", "source_id": db["id"]})
store.insert("relationships", {"left_dataset_id": a["id"], "left_column": "x", "right_dataset_id": b["id"], "right_column": "x"})

delete_dataset(a["id"])
assert not f.exists() and store.get("datasources", src["id"]) is None          # upload gone with its only dataset
assert store.list("relationships", order=None) == []
delete_dataset(b["id"])
assert store.get("datasources", db["id"]) is not None                          # database connection kept

# health check with several sources (threads) no longer crashes
store.insert("datasources", {"name": "c.csv", "type": "file", "config": {"path": t + "/u/c.csv"}})
assert len(sources_health()["sources"]) == 2
print("test_dataset_delete OK")
