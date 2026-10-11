"""AI dashboard generation: visible steps, clean names, pages, skipped bad queries, grounded insights page (model faked).
Run: backend/.venv/Scripts/python.exe tests/test_dash_gen.py"""
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
from app.services import ai as ai_svc, dash_gen
from app.services.dash_profile import profile
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE sales AS SELECT i AS order_id, CAST(i AS DOUBLE) * 1.37 AS amount, "
                "['N','S','E','W'][1 + i % 4] AS region, DATE '2024-01-01' + CAST(i % 300 AS INTEGER) AS d FROM range(1, 800) t(i)")
ds = store.insert("datasets", {"name": "sales", "physical_name": "sales", "kind": "file"})

# profile decides the roles itself
p = profile(ds)
roles = {c["name"]: c["role"] for c in p["columns"]}
assert roles == {"order_id": "id", "amount": "measure", "region": "dimension", "d": "time"}, roles
assert p["grain"] == "month" and "top: " in p["text"], p["grain"]

PLAN = {
    "understanding": "Each row is an order.", "thinking": ["Main measure: amount"], "name": "sales_overview",
    "pages": [{"id": "overview", "name": "overview"}, {"id": "regions", "name": "regions"}],
    "widgets": [
        {"page": "overview", "title": "total_amount", "type": "kpi", "why": "How much was sold", "formula": "sum", "sql": "SELECT ROUND(SUM(amount), 2) AS total_amount FROM sales"},
        {"page": "overview", "title": "monthly amount trend", "type": "line", "sql": "SELECT DATE_TRUNC('month', d) AS month, SUM(amount) AS total_amount FROM sales GROUP BY 1 ORDER BY 1"},
        {"page": "Regions", "title": "Top Regions", "type": "bar", "sql": "SELECT region, SUM(amount) AS total_amount FROM sales GROUP BY 1 ORDER BY 2 DESC LIMIT 10"},
        {"page": "nowhere", "title": "Top Regions", "type": "pie", "sql": "SELECT region, COUNT(*) AS orders FROM sales GROUP BY 1"},
        {"page": "regions", "title": "Broken", "type": "bar", "sql": "SELECT missing_col FROM sales"},
    ],
}
dash_gen._ask = lambda system, user, provider: (assert_ctx(user), PLAN)[1]


def assert_ctx(user: str) -> None:
    assert "Table `sales`" in user and "[measure]" in user and "Blueprint" in user


ai_svc.chat = lambda messages, provider_id=None, max_tokens=0: "- **Top region:** N leads."

events = list(dash_gen.run(ds["id"], "executive", "", None))
steps = [e["n"] for e in events if e["type"] == "step" and e.get("done")]
assert steps == [1, 2, 3, 4, 5, 6], steps
widgets = [e for e in events if e["type"] == "widget"]
assert [w["status"] for w in widgets].count("skipped") == 1 and sum(w["status"] == "ok" for w in widgets) == 4
done = events[-1]
assert done["type"] == "done" and done["name"] == "Sales Overview", done["name"]
assert done["pages"] == ["Overview", "Regions", "Insights"], done["pages"]
titles = [w["title"] for w in done["widgets"]]
assert "Total Amount" in titles and "Monthly Amount Trend" in titles and "Key Insights" in titles, titles
assert len(set(t.lower() for t in titles)) == len(titles), titles  # duplicate "Top Regions" was made unique
assert done["skipped"][0]["title"] == "Broken"

dash = store.get("dashboards", done["dashboard_id"])
assert [p["id"] for p in dash["pages"]] == ["overview", "regions", "insights"], dash["pages"]
rows = store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash["id"]], order=None)
assert {r["page"] for r in rows} == {"overview", "regions", "insights"}
text = [r for r in rows if r["kind"] == "text"][0]
assert "Top region" in text["settings"]["content"]
for r in rows:
    if r.get("chart_id"):
        ch = store.get("charts", r["chart_id"])
        assert engine.execute(store.get("queries", ch["query_id"])["sql"])["row_count"] >= 1

assert dash_gen.clean_title("revenue_by_region") == "Revenue By Region".replace("By", "by")
print("dash_gen tests OK")
