"""AI dashboards with a stubbed model: create from a prompt, skip bad widgets, edit by instruction.
Run: backend/.venv/Scripts/python.exe tests/test_dash_ai.py"""
import json
import os
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()  # never touch the real databases
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")

from app.core.store import store
from app.services import ai as ai_svc, dash_ai
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE sales AS SELECT i AS id, CAST(i AS DOUBLE) * 1.5 AS amount, "
                "['N','S','E','W'][1 + i % 4] AS region, DATE '2024-01-01' + CAST(i % 30 AS INTEGER) AS d FROM range(1, 200) t(i)")
store.insert("datasets", {"name": "sales", "physical_name": "sales", "kind": "file", "row_count": 199})

replies = iter([])
ai_svc.chat = lambda messages, provider_id=None, max_tokens=2048: next(replies)

# 1. create: model reply wrapped in prose + fences; one widget has SQL that cannot work and is skipped
plan = {"name": "Sales overview", "widgets": [
    {"title": "Total sales", "type": "kpi", "sql": "SELECT ROUND(SUM(amount), 2) AS total FROM sales"},
    {"title": "Sales by region", "type": "bar", "sql": "SELECT region, SUM(amount) AS amount FROM sales GROUP BY 1 ORDER BY 2 DESC"},
    {"title": "Trend", "type": "line", "sql": "SELECT d, SUM(amount) AS amount FROM sales GROUP BY 1 ORDER BY 1"},
    {"title": "Broken", "type": "bar", "sql": "SELECT nope FROM missing_table"},
    {"title": "Unsafe", "type": "table", "sql": "DROP TABLE sales"},
]}
replies = iter(["Here is the plan:\n```json\n" + json.dumps(plan) + "\n```\nHope that helps!"] + ["SELECT nope FROM missing_table"] * 5)
out = dash_ai.create_dashboard("sales overview by region", None, None)
titles = [w["title"] for w in out["widgets"]]
assert titles == ["Total sales", "Sales by region", "Trend"], out
assert {s["title"] for s in out["skipped"]} == {"Broken", "Unsafe"}, out["skipped"]
rows = store.list("dashboard_widgets", where="dashboard_id = ?", params=[out["dashboard_id"]], order=None)
assert len(rows) == 3
by_type = {store.get("charts", r["chart_id"])["spec"]["type"]: r for r in rows}
assert by_type["kpi"]["position"]["h"] == 2 and by_type["line"]["position"]["w"] == 12, [r["position"] for r in rows]
spec = store.get("charts", by_type["bar"]["chart_id"])["spec"]
assert spec["encoding"]["x"] == "region" and spec["encoding"]["y"] == "amount", spec

# 2. edit: add a widget, change the bar to a pie, remove the KPI
bar_id, kpi_id = by_type["bar"]["id"], by_type["kpi"]["id"]
edit = {"message": "Added orders by region, made the bar a pie and dropped the KPI.", "ops": [
    {"op": "add", "widget": {"title": "Orders by region", "type": "bar", "sql": "SELECT region, COUNT(*) AS orders FROM sales GROUP BY 1"}},
    {"op": "update", "id": bar_id, "type": "pie"},
    {"op": "remove", "id": kpi_id},
    {"op": "remove", "id": "does-not-exist"},
]}
replies = iter([json.dumps(edit)])
res = dash_ai.edit_dashboard(out["dashboard_id"], "add orders by region, make the bar a pie, drop the KPI", None)
assert res["message"].startswith("Added") and len(res["applied"]) == 3 and len(res["skipped"]) == 1, res
now = store.list("dashboard_widgets", where="dashboard_id = ?", params=[out["dashboard_id"]], order=None)
types = sorted(store.get("charts", r["chart_id"])["spec"]["type"] for r in now)
assert types == ["bar", "line", "pie"], types  # KPI removed, bar replaced by a pie, new bar added

# 3. an unusable model reply is a clear error, not a crash
replies = iter(["I cannot do that.", "still no json"])
try:
    dash_ai.create_dashboard("x", None, None)
    raise SystemExit("expected AIError")
except ai_svc.AIError as e:
    assert "usable dashboard plan" in str(e)
print("dash_ai tests OK")

# 4. parser: reasoning that quotes the format first, then the real plan; and loose widget objects
quoted = 'Format: {"title": string, "type": kpi, "sql": SELECT}. Final: {"name":"D","widgets":[{"title":"A","type":"kpi","sql":"SELECT 1 AS a"}]}'
assert dash_ai.widgets_of(dash_ai.parse_json(quoted))[0]["title"] == "A"
loose = dash_ai.parse_json('{"title":"A","type":"kpi","sql":"SELECT 1"} and {"title":"B","type":"bar","sql":"SELECT 2"}')
assert [w["title"] for w in dash_ai.widgets_of(loose)] == ["A", "B"]
print("dash_ai parser OK")
