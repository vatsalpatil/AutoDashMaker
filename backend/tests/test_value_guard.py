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
print("test_value_guard OK")
