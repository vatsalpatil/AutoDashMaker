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
    "pages": [{"id": "overview", "name": "overview"}, {"id": "breakdown", "name": "breakdown"}],
    "widgets": [
        {"page": "overview", "title": "total_amount", "type": "kpi", "why": "How much was sold", "formula": "sum", "sql": "SELECT ROUND(SUM(amount), 2) AS total_amount FROM sales"},
        {"page": "overview", "title": "monthly amount trend", "type": "line", "sql": "SELECT DATE_TRUNC('month', d) AS month, SUM(amount) AS total_amount FROM sales GROUP BY 1 ORDER BY 1"},
        {"page": "Breakdown", "title": "Top Regions", "type": "bar", "sql": "SELECT region, SUM(amount) AS total_amount FROM sales GROUP BY 1 ORDER BY 2 DESC LIMIT 10"},
        {"page": "nowhere", "title": "Top Regions", "type": "pie", "sql": "SELECT region, COUNT(*) AS orders FROM sales GROUP BY 1"},
        {"page": "breakdown", "title": "Broken", "type": "bar", "sql": "SELECT missing_col FROM sales"},
    ],
}
real_ask_json = dash_plan.ask_json
seen_prompts = {}


def fake_ask_json(system, user, provider, key, step=None, lane=None, label=None):
    seen_prompts[key] = user
    if key == "understanding":
        return {"understanding": "Each row is an order.", "thinking": ["Main measure: amount"],
                "questions": [{"id": "q1", "question": "Which measure is the main KPI?", "options": ["amount", "orders"], "multi": False}, {"nope": 1}],
                "ideas": ["Regional performance"]}
    if key == "suggestions":
        return {"suggestions": ["Add average order value by region"]}
    if key == "widgets" and "Your page:" in user:   # one call per page: only that page's widgets
        page = user.split('Your page: "')[1].split('"')[0].lower()
        return {"widgets": [w for w in PLAN["widgets"] if w["page"].lower() == page]}
    return PLAN


dash_plan.ask_json = fake_ask_json
dash_gen.ask_json = fake_ask_json
from app.services import dash_pages
dash_pages.ask_json = fake_ask_json
ai_svc.chat = lambda messages, provider_id=None, max_tokens=0, timeout=0: "- **Top region:** N leads."

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

# phase 2a: first plan = one model call per page, all at once (the AI chose the pages in a short outline call)
ev2 = list(dash_plan.plan(ds["id"], "auto", "", und["understanding"], {"Which measure is the main KPI?": "amount"}, "", [], None))
assert "Your page:" in seen_prompts["widgets"] and "Other pages (do NOT repeat" in seen_prompts["widgets"]
assert "The user answered" in seen_prompts["widgets"] and "Each row is an order" in seen_prompts["widgets"]
progress = [e for e in ev2 if e["type"] == "step" and not e.get("done")]
assert any("at the same time" in e["detail"] for e in progress), [e["detail"] for e in progress]
planned = ev2[-1]
assert planned["type"] == "plan" and planned["name"] == "Sales Dashboard", planned["name"]
assert [p["name"] for p in planned["pages"]] == ["Overview", "Breakdown"], planned["pages"]
titles = [w["title"] for w in planned["widgets"]]
assert titles == ["Total Amount", "Monthly Amount Trend", "Top Regions", "Broken"], titles   # page order, names cleaned

# phase 2b: a revision with feedback is one call that sees the whole plan
ev2b = list(dash_plan.plan(ds["id"], "executive", "", und["understanding"], {"Which measure is the main KPI?": "amount"}, "add a table", ["Total Amount"], None))
assert "add a table" in seen_prompts["widgets"] and "Your page:" not in seen_prompts["widgets"]
titles_b = [w["title"] for w in ev2b[-1]["widgets"]]
assert len(set(t.lower() for t in titles_b)) == len(titles_b), titles_b   # duplicate "Top Regions" made unique

# phase 3: build the plan in parallel (the user may have dropped a widget)
ev3 = list(dash_gen.build(ds["id"], planned["name"], planned["pages"], planned["widgets"], None))
widgets = [e for e in ev3 if e["type"] == "widget"]
assert [w["status"] for w in widgets].count("skipped") == 1 and sum(w["status"] == "ok" for w in widgets) == 3
assert any("at the same time" in e.get("detail", "") for e in ev3 if e["type"] == "step"), "build progress"
done = ev3[-1]
assert done["type"] == "done" and done["pages"] == ["Overview", "Breakdown", "Insights"], done["pages"]
assert done["suggestions"] == ["Add average order value by region"] and done["skipped"][0]["title"] == "Broken"
steps = [e["n"] for e in ev3 if e["type"] == "step" and e.get("done")]
assert steps == [4, 5, 6], steps
# widgets keep the plan's order whatever order they finished in
assert [w["title"] for w in done["widgets"] if w["page"] == "Overview"] == ["Total Amount", "Monthly Amount Trend"], done["widgets"]

dash = store.get("dashboards", done["dashboard_id"])
assert [p["id"] for p in dash["pages"]] == ["overview", "breakdown", "insights"], dash["pages"]
rows = store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash["id"]], order=None)
assert {r["page"] for r in rows} == {"overview", "breakdown", "insights"}
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
# the whole dashboard's data in one request (parallel, identical queries run once), and fresh=true bypasses the cache
from app.routers.dashboards import dashboard_data

bundle = dashboard_data(done["dashboard_id"])
chart_ids = [r["chart_id"] for r in store.list("dashboard_widgets", where="dashboard_id = ?", params=[done["dashboard_id"]], order=None) if r.get("chart_id")]
assert set(bundle) == set(chart_ids) and len(chart_ids) == 3, (set(bundle), chart_ids)
assert all("chart" in v and v["data"]["row_count"] >= 1 for v in bundle.values()), bundle
again = dashboard_data(done["dashboard_id"])
assert all(v["data"]["cached"] is True for v in again.values())
assert all(v["data"]["cached"] is False for v in dashboard_data(done["dashboard_id"], fresh=True).values())

# SSE routes must bypass the gzip middleware (it buffers streams: the live site sat on "Reading the data" until this was listed)
from app.core.compression import STREAM_PATHS
for path in ("/api/dashboards/generate/understand", "/api/dashboards/generate/plan", "/api/dashboards/generate/build", "/api/ai/agent"):
    assert path.startswith(STREAM_PATHS), path
# automatic repair of a widget query: several rounds with the real error, a targeted hint, then a different simpler query
from app.services import assist as _assist
from app.services import dash_repair

ctx = "Table `sales` (sales): 799 rows.\n- order_id BIGINT [id]; 0% empty\n- amount DOUBLE [measure]; 0% empty\n- region VARCHAR [dimension]; 0% empty"
spec = {"title": "Revenue Growth vs Prior Month", "type": "kpi", "why": "growth", "formula": "last vs previous"}
BAD = "WITH m AS (SELECT SUM(amount) AS rev FROM sales) SELECT ROUND(rev, 2) AS revenue_growth_pct FROM r"   # 'r' was never defined: the failure from the live run
GOOD = "SELECT ROUND(SUM(amount), 2) AS revenue_growth_pct FROM sales"

# the hint points at the real table and columns
hint = dash_repair._hint('Catalog Error: Table with name r does not exist!', ctx)
assert "`r` is not a table or a CTE" in hint and "`sales`" in hint, hint
assert "amount" in dash_repair._hint("Binder Error: Referenced column nope not found in FROM clause", ctx)

seen_errors = []
real_fix, real_gen = _assist.fix_sql, ai_svc.generate_sql


def fix_once_wrong(sql, error, context, provider, check):
    seen_errors.append(error)
    return BAD if len(seen_errors) == 1 else GOOD          # first repair is still wrong, the second works


_assist.fix_sql = fix_once_wrong
sql, res, fixes = dash_repair.run_with_repairs(spec, BAD, ctx, None)
assert fixes == 2 and res["row_count"] == 1 and sql.startswith(GOOD), (fixes, sql)
assert "Hint:" in seen_errors[0] and "Earlier fixes also failed" in seen_errors[1], seen_errors   # round 2 knows what round 1 got wrong

# every patch fails -> the last round writes a different simpler query
_assist.fix_sql = lambda *a, **k: BAD
ai_svc.generate_sql = lambda messages, provider_id=None, check=None: GOOD
sql, res, fixes = dash_repair.run_with_repairs(spec, BAD, ctx, None)
assert fixes == 3 and sql.startswith(GOOD)

# a runtime failure (binds fine, fails when run) is repaired too
sql, res, fixes = dash_repair.run_with_repairs(spec, "SELECT CAST('abc' AS INTEGER) AS x FROM sales", ctx, None)
assert fixes == 3 and res["row_count"] == 1

# nothing works -> a clear reason that says how many automatic fixes were tried
ai_svc.generate_sql = lambda messages, provider_id=None, check=None: BAD
try:
    dash_repair.run_with_repairs(spec, BAD, ctx, None)
    raise SystemExit("expected ValueError")
except ValueError as e:
    assert "3 automatic fixes" in str(e) and "Table with name r" in str(e), str(e)

# a model that fails during repair (rate limit) does not crash the build: the round is counted and the next one runs
_assist.fix_sql = lambda *a, **k: (_ for _ in ()).throw(ai_svc.AIError("429: rate limited"))
ai_svc.generate_sql = lambda messages, provider_id=None, check=None: GOOD
sql, res, fixes = dash_repair.run_with_repairs(spec, BAD, ctx, None)
assert sql.startswith(GOOD) and res["row_count"] == 1

# a query that already works costs no fixes
_assist.fix_sql, ai_svc.generate_sql = real_fix, real_gen
sql, res, fixes = dash_repair.run_with_repairs(spec, GOOD, ctx, None)
assert fixes == 0

# the page calls really overlap: three 0.4 s model calls take about 0.4 s, not 1.2 s
import time as _t0


def slow_ask(system, user, provider, key, step=None, lane=None, label=None):
    _t0.sleep(0.4)
    return {"widgets": [{"title": f"W {lane}", "type": "kpi", "sql": "SELECT 1 AS n"}]}


_saved_ask = dash_pages.ask_json
dash_pages.ask_json = slow_ask
started = _t0.monotonic()
res = list(dash_pages.plan_in_parallel("executive", "ctx", None))
elapsed = _t0.monotonic() - started
dash_pages.ask_json = _saved_ask
assert res[-1]["type"] == "specs" and len(res[-1]["specs"]) == 3, res[-1]
assert elapsed < 0.9, f"pages ran one after another ({elapsed:.2f}s)"

# live streaming: reasoning + answer chunks reach the sink while the full text is still returned
import json as _json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from app.services import ai_stream, live


class _Stream(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = _json.loads(self.rfile.read(n))
        assert body["stream"] is True
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        chunks = [{"choices": [{"delta": {"reasoning": "Let me think. "}}]}, {"choices": [{"delta": {"reasoning": "Revenue matters."}}]},
                  {"choices": [{"delta": {"content": '{"understanding": '}}]}, {"choices": [{"delta": {"content": '"ok"}'}, "finish_reason": "stop"}]}]
        self.wfile.write(b": PROCESSING\n\n")
        for c in chunks:
            self.wfile.write(("data: " + _json.dumps(c) + "\n\n").encode())
        self.wfile.write(b"data: [DONE]\n\n")


srv = HTTPServer(("127.0.0.1", 0), _Stream)
threading.Thread(target=srv.serve_forever, daemon=True).start()
store.insert("ai_providers", {"label": "local", "provider": "openai", "model": "m", "api_key": "x", "base_url": f"http://127.0.0.1:{srv.server_port}/v1", "is_default": True})
ai_svc.chat = lambda *a, **k: (_ for _ in ()).throw(AssertionError("must stream, not call chat"))
got = []
live.sink.set(got.append)
text = ai_stream.chat_live([{"role": "user", "content": "x"}], max_tokens=100, step=2)
live.sink.set(None)
assert text == '{"understanding": "ok"}', text
assert got[0] == {"type": "think", "n": 2, "kind": "reset", "text": "", "lane": "main", "label": ""}
assert "".join(e["text"] for e in got if e["kind"] == "reasoning") == "Let me think. Revenue matters."
assert "".join(e["text"] for e in got if e["kind"] == "answer") == text
srv.shutdown()

print("dash_gen tests OK")
