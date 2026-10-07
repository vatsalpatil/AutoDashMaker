"""Run: backend/.venv/Scripts/python.exe tests/test_qb.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # temp stores BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services.engine import engine
from app.services.qb import compile_spec

with engine.writer() as con:
    con.execute("CREATE TABLE ds_sales AS SELECT * FROM (VALUES (1,'N',10.0,DATE '2024-01-05'),(2,'N',20.0,DATE '2024-02-05'),(3,'S',5.0,DATE '2024-02-09'),(1,'S',7.0,DATE '2024-03-01')) t(cid,region,amount,d)")
    con.execute("CREATE TABLE ds_cust AS SELECT * FROM (VALUES (1,'Ann'),(2,'Bob')) t(cid,name)")
store.insert("datasets", {"name": "Sales", "physical_name": "ds_sales", "workspace_id": "default"})
store.insert("datasets", {"name": "Cust", "physical_name": "ds_cust", "workspace_id": "default"})


def run(spec, upto=None):
    return engine.execute(compile_spec(spec, upto))["rows"]

# filter + group + sort
r = run({"table": "Sales", "filters": [{"col": "amount", "op": ">", "value": 6}], "aggregations": [{"fn": "sum", "col": "amount", "as": "total"}],
         "breakouts": [{"col": "region"}], "sort": [{"col": "total", "dir": "desc"}]})
assert [x["region"] for x in r] == ["N", "S"] and r[0]["total"] == 30, r
# monthly bucket + running sum window + conditional aggregate
r = run({"table": "Sales", "breakouts": [{"col": "d", "bucket": "month", "as": "m"}],
         "aggregations": [{"fn": "sum", "col": "amount", "as": "t"}, {"fn": "count", "as": "n_big", "where": [{"col": "amount", "op": ">=", "value": 10}]}],
         "windows": [{"fn": "running_sum", "col": "t", "order": "m", "as": "cum"}], "sort": [{"col": "m"}]})
assert [x["cum"] for x in r] == [10, 35, 42] and r[1]["n_big"] == 1, r
# join + custom column + having
r = run({"table": "Sales", "joins": [{"table": "Cust", "type": "inner", "on": [{"left": {"t": "t0", "c": "cid"}, "right": {"t": "t1", "c": "cid"}}]}],
         "custom": [{"name": "double", "expr": "amount * 2"}],
         "breakouts": [{"col": {"t": "t1", "c": "name"}, "as": "who"}], "aggregations": [{"fn": "sum", "col": "double", "as": "d2"}],
         "having": [{"col": "d2", "op": ">", "value": 36}]})
assert [x["who"] for x in r] == ["Bob"], r
# second stage over the first
r = run({"stages": [{"table": "Sales", "breakouts": [{"col": "region"}], "aggregations": [{"fn": "sum", "col": "amount", "as": "t"}]},
                    {"filters": [{"col": "t", "op": ">", "value": 20}], "columns": ["region", "t"]}]})
assert len(r) == 1 and r[0]["region"] == "N" and r[0]["t"] == 30, r
# text ops, injection-safe literal, error cases
assert len(run({"table": "Sales", "filters": [{"col": "region", "op": "contains", "value": "x' OR 1=1 --"}]})) == 0
for bad in ({"table": "Sales", "custom": [{"name": "x", "expr": "(SELECT 1)"}], "columns": ["x"]}, {"table": "Nope"},
            {"table": "Sales", "aggregations": [{"fn": "bogus"}]}):
    try:
        compile_spec(bad); raise SystemExit(f"should fail: {bad}")
    except ValueError:
        pass
# with a column list only the listed columns come back; a custom column is included only when picked
spec = {"table": "Sales", "custom": [{"name": "double", "expr": "amount * 2"}], "columns": [{"t": "t0", "c": "region"}]}
assert engine.execute(compile_spec(spec))["columns"] == ["region"]
spec["columns"] = ["double", {"t": "t0", "c": "region"}]
assert engine.execute(compile_spec(spec))["columns"] == ["double", "region"]
# hidden custom column: usable in a filter, absent from the output
r = engine.execute(compile_spec({"table": "Sales", "custom": [{"name": "double", "expr": "amount * 2", "hidden": True}], "filters": [{"col": "double", "op": ">", "value": 30}], "columns": [{"t": "t0", "c": "region"}]}))
assert r["columns"] == ["region"] and r["row_count"] == 1, r
# symbols in a custom column name (%, spaces, quotes) work, also when used in a filter
r = engine.execute(compile_spec({"table": "Sales", "custom": [{"name": "Profit %", "expr": "amount / 2 * 100"}, {"name": 'say "hi"', "expr": "amount"}], "filters": [{"col": "Profit %", "op": ">", "value": 400}], "columns": ["Profit %", 'say "hi"']}))
assert r["columns"] == ["Profit %", 'say "hi"'] and r["row_count"] == 2, r["columns"]
print("qb ok")
