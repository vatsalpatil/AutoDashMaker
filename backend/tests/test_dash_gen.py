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
from app.services import ai as ai_svc, dash_gen, dash_plan
from app.services.dash_profile import profile
from app.services.dash_ai import _tidy as dash_ai_tidy
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
real_ask_json = dash_plan.ask_json
seen_prompts = {}


def fake_ask_json(system, user, provider, key):
    seen_prompts[key] = user
    if key == "understanding":
        return {"understanding": "Each row is an order.", "thinking": ["Main measure: amount"],
                "questions": [{"id": "q1", "question": "Which measure is the main KPI?", "options": ["amount", "orders"], "multi": False}, {"nope": 1}],
                "ideas": ["Regional performance"]}
    if key == "suggestions":
        return {"suggestions": ["Add average order value by region"]}
    return PLAN


dash_plan.ask_json = fake_ask_json
dash_gen.ask_json = fake_ask_json
ai_svc.chat = lambda messages, provider_id=None, max_tokens=0: "- **Top region:** N leads."

# phase 1: statistics + top rows reach the model, the user gets facts + questions
ev1 = list(dash_plan.understand(ds["id"], "executive", "", None))
types = [e["type"] for e in ev1]
assert types.count("profile") == 1 and types[-1] == "understanding", types
prof_ev = [e for e in ev1 if e["type"] == "profile"][0]
amount = [r for r in prof_ev["describe"] if r["column"] == "amount"][0]
assert amount["median"] and amount["std"] is not None and len(prof_ev["sample"]["rows"]) == 100, amount
assert "median" in seen_prompts["understanding"] and "First 12 of the top 100 rows" in seen_prompts["understanding"]
und = ev1[-1]
assert [q["id"] for q in und["questions"]] == ["q1"] and und["questions"][0]["options"] == ["amount", "orders"], und["questions"]

# phase 2: answers + feedback shape the plan prompt; names are cleaned, titles unique
ev2 = list(dash_plan.plan(ds["id"], "executive", "", und["understanding"], {"Which measure is the main KPI?": "amount"}, "add a table", ["Total Amount"], None))
assert "The user answered" in seen_prompts["widgets"] and "add a table" in seen_prompts["widgets"] and "Each row is an order" in seen_prompts["widgets"]
planned = ev2[-1]
assert planned["type"] == "plan" and planned["name"] == "Sales Overview", planned["name"]
titles = [w["title"] for w in planned["widgets"]]
assert len(set(t.lower() for t in titles)) == len(titles) and "Total Amount" in titles, titles

# phase 3: build the plan (the user may have dropped a widget)
kept = [w for w in planned["widgets"] if w["title"] != "Broken"]
ev3 = list(dash_gen.build(ds["id"], planned["name"], planned["pages"], planned["widgets"], None))
widgets = [e for e in ev3 if e["type"] == "widget"]
assert [w["status"] for w in widgets].count("skipped") == 1 and sum(w["status"] == "ok" for w in widgets) == 4
done = ev3[-1]
assert done["type"] == "done" and done["pages"] == ["Overview", "Regions", "Insights"], done["pages"]
assert done["suggestions"] == ["Add average order value by region"] and done["skipped"][0]["title"] == "Broken"
steps = [e["n"] for e in ev3 if e["type"] == "step" and e.get("done")]
assert steps == [4, 5, 6], steps

dash = store.get("dashboards", done["dashboard_id"])
assert [p["id"] for p in dash["pages"]] == ["overview", "regions", "insights"], dash["pages"]
rows = store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash["id"]], order=None)
assert {r["page"] for r in rows} == {"overview", "regions", "insights"}
assert "Top region" in [r for r in rows if r["kind"] == "text"][0]["settings"]["content"]
for r in rows:
    if r.get("chart_id"):
        ch = store.get("charts", r["chart_id"])
        assert engine.execute(store.get("queries", ch["query_id"])["sql"])["row_count"] >= 1

# the non-interactive shortcut runs all three phases
auto = dash_gen.generate(ds["id"], "auto", "", None)
assert auto["type"] == "done" and auto["pages"][-1] == "Insights"
assert dash_plan.clean_title("revenue_by_region") == "Revenue by Region"
# result summaries given to the insights model: short results in full, long ones as first/last/min/max (rounded)
long_rows = [{"month": f"2024-{i:02d}", "total": 100.123456 + i} for i in range(1, 25)]
summ = dash_gen._summary({"title": "Trend", "chart": {"type": "line"}, "columns": ["month", "total"], "all_rows": dash_ai_tidy(long_rows)})
assert "24 rows" in summ and "first" in summ and "last" in summ and "min 101.12" in summ and "max 124.12" in summ, summ
assert "100.123456" not in summ
short = dash_gen._summary({"title": "Top", "chart": {"type": "bar"}, "columns": ["r"], "all_rows": [{"r": "N"}]})
assert "[{'r': 'N'}]" in short
assert dash_plan.clean_title("Total Total Profit") == "Total Profit"
# ask_json copes with what real (free / reasoning) models do
import time as _time
_time.sleep = lambda *_: None
script = []


def scripted_chat(messages, provider_id=None, max_tokens=0, timeout=0):
    step = script.pop(0)
    scripted_chat.tokens.append(max_tokens)
    if isinstance(step, Exception):
        raise step
    return step


scripted_chat.tokens = []
ai_svc.chat = scripted_chat
script[:] = [ai_svc.AIError("429: provider rate-limited"), ai_svc.AIError("429: again"), '<think>x</think> ```json {"understanding": "ok"} ```']
assert real_ask_json("s", "u", None, "understanding") == {"understanding": "ok"}      # two rate limits, then an answer
script[:] = [ai_svc.AIError("empty content from model (finish_reason=length)"), '{"understanding": "big budget"}']
scripted_chat.tokens.clear()
assert real_ask_json("s", "u", None, "understanding")["understanding"] == "big budget" and scripted_chat.tokens == [6000, 16000]
script[:] = ["Sorry, I cannot.", '{"understanding": "second try"}']
assert real_ask_json("s", "u", None, "understanding")["understanding"] == "second try"   # one insistent retry for non-JSON
script[:] = ["no json", "still no json"]
try:
    real_ask_json("s", "u", None, "understanding")
    raise SystemExit("expected AIError")
except ai_svc.AIError as e:
    assert "usable answer" in str(e)
script[:] = [ai_svc.AIError("429: x")] * 3
try:
    real_ask_json("s", "u", None, "understanding")
    raise SystemExit("expected AIError")
except ai_svc.AIError as e:
    assert "rate-limiting" in str(e), str(e)
print("dash_gen tests OK")
