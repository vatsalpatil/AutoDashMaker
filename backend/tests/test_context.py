"""Workbench assistant context + saved-query editing. Run: backend/.venv/Scripts/python.exe tests/test_context.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # temp stores BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb",
                  UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services.ai_context import workbench_context as _workbench_context

d = store.insert("datasets", {"name": "sales", "physical_name": "ds_sales", "row_count": 10, "kind": "file"})
store.insert("datasets", {"name": "targets", "physical_name": "ds_targets", "row_count": 4, "kind": "file"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "amount", "dtype": "DOUBLE"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "region", "dtype": "VARCHAR"})
same = "SELECT region, SUM(amount) FROM ds_sales GROUP BY 1"
store.insert("queries", {"name": "by region", "sql": same, "status": "ok"})
store.insert("queries", {"name": "by region", "sql": same, "status": "ok"})      # exact duplicate -> shown once
store.insert("queries", {"name": "regional totals", "sql": same, "status": "ok"})  # different name -> kept
store.insert("queries", {"name": "bad", "sql": "SELECT broken", "status": "error"})

ctx = _workbench_context(d["id"])
assert "sales (selected) [10 rows]: amount DOUBLE, region VARCHAR" in ctx, ctx
# the prompt shows datasets by their own name (SQL resolves it); the physical ds_ table is an internal detail
assert "ds_sales" not in ctx.split("saved queries")[0], ctx
assert "- targets [4 rows]" in ctx, "every table must be listed, not just the selected one"
assert ctx.count('"by region"') == 1 and '"regional totals"' in ctx and "SELECT broken" not in ctx, ctx

# editing a saved query in place: validated read-only, persisted, audited
from fastapi import HTTPException
from app.routers.queries import QueryPatch, update_query
q = store.list("queries", where="name = 'regional totals'")[0]
out = update_query(q["id"], QueryPatch(sql="SELECT region FROM ds_sales;"))
assert out["sql"] == "SELECT region FROM ds_sales" and store.get("queries", q["id"])["sql"] == "SELECT region FROM ds_sales"
update_query(q["id"], QueryPatch(name="  renamed  "))
assert store.get("queries", q["id"])["name"] == "renamed"
for bad in ("DROP TABLE ds_sales", "SELECT 1; SELECT 2"):
    try:
        update_query(q["id"], QueryPatch(sql=bad))
        raise SystemExit(f"expected rejection of {bad!r}")
    except HTTPException as e:
        assert e.status_code == 400
assert store.get("queries", q["id"])["sql"] == "SELECT region FROM ds_sales", "rejected edit must not be saved"
try:
    update_query("nope", QueryPatch(name="x"))
    raise SystemExit("expected 404")
except HTTPException as e:
    assert e.status_code == 404
print("context tests OK")
