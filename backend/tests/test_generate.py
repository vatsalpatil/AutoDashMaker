"""Dashboard generation never produces an empty dashboard.
Run: backend/.venv/Scripts/python.exe tests/test_generate.py"""
import os
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")

from app.core.store import store
from app.services.engine import engine
from app.services.generate import generate_dashboard

with engine.writer() as con:
    # every amount is unique (a continuous measure) — this used to be mistaken for an id, leaving no KPIs
    con.execute("CREATE TABLE sales AS SELECT i AS order_id, CAST(i AS DOUBLE) * 1.37 AS amount, "
                "['N','S','E','W'][1 + i % 4] AS region, DATE '2024-01-01' + CAST(i % 30 AS INTEGER) AS d FROM range(1, 400) t(i)")
    con.execute("CREATE TABLE labels AS SELECT ['a','b','c'][1 + i % 3] AS tag FROM range(1, 50) t(i)")

ds = store.insert("datasets", {"name": "sales", "physical_name": "sales", "kind": "file"})
out = generate_dashboard(ds)
names = [w["chart"] for w in out["widgets"]]
assert "Records" in names and "Total amount" in names, names
assert "Total order_id" not in names, names  # ids are still not measures
assert any(n.startswith("amount over time") for n in names) and any(n.startswith("amount by region") for n in names), names

# no measure at all: the dashboard still has a Records KPI and counts per category
ds2 = store.insert("datasets", {"name": "labels", "physical_name": "labels", "kind": "file"})
out2 = generate_dashboard(ds2)
names2 = [w["chart"] for w in out2["widgets"]]
assert names2[0] == "Records" and any("records by tag" in n for n in names2), names2

# every generated chart's query runs and returns a row
for dash_out in (out, out2):
    widgets = store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash_out["dashboard_id"]], order=None)
    assert widgets
    for w in widgets:
        ch = store.get("charts", w["chart_id"])
        q = store.get("queries", ch["query_id"])
        assert engine.execute(q["sql"])["row_count"] >= 1, q["sql"]
print("generate tests OK")
