"""Ask safety nets for text values: wrong-case literals fixed after a 0-row result; values the question names but the
SQL ignores trigger one retry. Run: backend/.venv/Scripts/python.exe tests/test_value_guard.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", UPLOAD_DIR=tmp + "/up", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services import ai, analyst, value_guard as vg
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE ds_orders AS SELECT * FROM (VALUES ('O1','Completed',100.0), ('O2','Completed',50.0), ('O3','Returned',70.0)) t(order_id, status, amount)")
d = store.insert("datasets", {"name": "orders", "physical_name": "ds_orders", "row_count": 3, "kind": "file"})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "order_id", "dtype": "VARCHAR", "distinct_count": 3, "sample_values": '["O1","O2","O3"]'})
store.insert("columns_meta", {"dataset_id": d["id"], "name": "status", "dtype": "VARCHAR", "distinct_count": 2, "sample_values": '["Completed","Returned"]'})

# ---- literal case ----
fixed = vg.fix_literal_case("SELECT SUM(amount) FROM ds_orders AS o WHERE o.status = 'completed'")
assert fixed and "'Completed'" in fixed, fixed
assert "'Returned'" in vg.fix_literal_case("SELECT * FROM ds_orders WHERE status IN ('returned')")
assert vg.fix_literal_case("SELECT * FROM ds_orders WHERE status = 'Completed'") is None          # already right
assert vg.fix_literal_case("SELECT * FROM ds_orders WHERE status = 'shipped'") is None            # no such value: leave it

# the AI writes the dataset's own name (resolved to the physical table later): still fixed
fixed = vg.fix_literal_case("SELECT SUM(amount) FROM orders AS o WHERE o.status = 'completed'")
assert fixed and "'Completed'" in fixed, fixed

# ---- dropped filter ----
assert vg.missing_values("revenue for completed orders", "SELECT SUM(amount) FROM ds_orders") == ["orders.status = 'Completed'"]
assert vg.missing_values("revenue for completed orders", "SELECT SUM(amount) FROM ds_orders WHERE status = 'Completed'") == []
assert vg.missing_values("total revenue", "SELECT SUM(amount) FROM ds_orders") == []
assert vg.missing_values("uncompleted?", "SELECT 1") == []                                       # whole words only

# ---- Ask end to end: model drops the filter, then writes the wrong case → right answer anyway ----
replies = iter(["SELECT SUM(amount) AS revenue FROM ds_orders",                                    # ignores "completed"
                "SELECT SUM(amount) AS revenue FROM ds_orders WHERE status = 'completed'"])       # retry: wrong case
ai.chat = lambda msgs, *a, **k: next(replies) if "Summarize" not in str(msgs[0].get("content", "")) else '{"summary":"ok","followups":[]}'
out = analyst.answer("total revenue for completed orders", [], None, None)
assert out["status"] == "ok", out
assert "'Completed'" in out["sql"] and out["result"]["rows"][0]["revenue"] == 150.0, (out["sql"], out["result"]["rows"])
# Query Builder: a typed filter value with the wrong case still matches, with a note
from app.routers.qb import SpecIn, run as qb_run
spec = {"stages": [{"table": "orders", "filters": [{"col": "status", "op": "=", "value": "completed"}],
                    "aggregations": [{"fn": "sum", "col": "amount", "as": "total"}]}]}
r = qb_run(SpecIn(spec=spec))
assert r["rows"][0]["total"] == 150.0 and any("spelling" in w for w in r["warnings"]), r
# Workbench: never rewrites hand-written SQL, but an empty result names the matching spelling
from app.routers.queries import QueryIn, run_query
r = run_query(QueryIn(sql="SELECT * FROM orders WHERE status = 'completed'", save=False))
assert r["row_count"] == 0 and any("did you mean 'Completed'" in w for w in r["warnings"]), r["warnings"]
assert not any(w.startswith("empty_result") for w in r["warnings"])
r = run_query(QueryIn(sql="SELECT count(*) AS n FROM orders WHERE status = 'completed'", save=False))   # a total of 0
assert r["rows"][0]["n"] == 0 and any("did you mean 'Completed'" in w for w in r["warnings"]), r["warnings"]
# a PIVOT statement can use dataset names like any query
r = run_query(QueryIn(sql="PIVOT orders ON status USING sum(amount) ORDER BY 1", save=False))
assert sum(float(x["Completed"] or 0) for x in r["rows"]) == 150.0, r["rows"]
# Ask shows dataset names as sources, not ds_ tables
assert analyst._shown_tables(["ds_orders"]) == ["orders"]
# a key number defined on one dataset applies to another with the same columns (e.g. a fresh combine)
from app.services import semantic
store.insert("columns_meta", {"dataset_id": d["id"], "name": "amount", "dtype": "DOUBLE"})
store.insert("metrics", {"dataset_id": d["id"], "name": "net", "label": "Net revenue", "expression": "SUM(amount)", "filters": ["status = 'Completed'"]})
d2 = store.insert("datasets", {"name": "orders_combined", "physical_name": "ds_orders_combined", "row_count": 3, "kind": "blend"})
for c in ("order_id", "status", "amount"):
    store.insert("columns_meta", {"dataset_id": d2["id"], "name": c, "dtype": "VARCHAR"})
lines = semantic.applicable_metric_lines(d2["id"], "ds_orders_combined")
assert lines and "Net revenue" in lines[0] and "ds_orders_combined" in lines[0] and "Completed" in lines[0], lines
d3 = store.insert("datasets", {"name": "other", "physical_name": "ds_other", "row_count": 1})
store.insert("columns_meta", {"dataset_id": d3["id"], "name": "status", "dtype": "VARCHAR"})
assert semantic.applicable_metric_lines(d3["id"], "ds_other") == []      # no amount column: does not apply
# blends are never suggested as join partners of their own source tables
from app.routers.transforms import _free_name, suggest_relationships
assert all("orders_combined" not in (s["left_dataset"], s["right_dataset"]) for s in suggest_relationships())
assert _free_name("orders_combined") == "orders_combined_2" and _free_name("fresh_combined") == "fresh_combined"
print("test_value_guard OK")
