"""Analyst pipeline with a stubbed model: clarify, answer + chart + summary, repair, chart suggestion."""
import os, tempfile
_tmp = tempfile.mkdtemp()  # never touch the real databases
os.environ["ANALYTICS_DB"] = os.path.join(_tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(_tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(_tmp, "spill")
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import ai as ai_svc, analyst
from app.services.chart_suggest import suggest_chart
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE OR REPLACE TABLE sales AS SELECT * FROM (VALUES ('N', 10, DATE '2024-01-01'), ('S', 20, DATE '2024-02-01')) t(region, amount, d)")

replies = iter([])
ai_svc.chat = lambda messages, provider_id=None, max_tokens=2048: next(replies)

# 1. clarification
replies = iter(["CLARIFY: by revenue or quantity?"])
r = analyst.answer("best region", [], None, None)
assert r["status"] == "clarify" and "revenue" in r["detail"], r

# 2. answer: SQL, then summary text
replies = iter(["SELECT region, SUM(amount) AS total FROM sales GROUP BY region",
                "SUMMARY: South leads with 20.\nFOLLOW-UPS:\n- By month?\n- Only North?\n- Compare to last year?"])
r = analyst.answer("total by region", [], None, None)
assert r["status"] == "ok" and r["result"]["row_count"] == 2, r
assert r["summary"].startswith("South") and len(r["followups"]) == 3, r
assert r["chart"]["type"] in ("bar", "pie"), r["chart"]

# 3. summary failure still returns an answer
def boom_after_sql(messages, provider_id=None, max_tokens=2048):
    global calls
    calls += 1
    if calls == 1:
        return "SELECT 1 AS n"
    raise RuntimeError("down")
calls = 0
ai_svc.chat = boom_after_sql
r = analyst.answer("count", [], None, None)
assert r["status"] == "ok" and r["summary"] and r["chart"]["type"] == "kpi", r

# 3b. a model that echoes the template gets the factual fallback instead
replies = iter(["SELECT region, SUM(amount) AS total FROM sales GROUP BY region",
                "SUMMARY: <one or two plain sentences>\nFOLLOW-UPS:\n- <short follow-up question 1>"])
ai_svc.chat = lambda messages, provider_id=None, max_tokens=2048: next(replies)
r = analyst.answer("total by region", [], None, None)
assert "<" not in r["summary"] and "highest" in r["summary"] and r["followups"], r

# 4. repair after a failing query
ai_svc.chat = lambda messages, provider_id=None, max_tokens=2048: next(replies)
replies = iter(["SELECT nope FROM sales", "SELECT region FROM sales", "SUMMARY: ok"])
r = analyst.answer("regions", [], None, None)
assert r["status"] == "ok" and r["sql"].lower().startswith("select region"), r

# 5. chart suggestion
t = suggest_chart(["d", "amount"], [{"d": "2024-01-01", "amount": 1}, {"d": "2024-02-01", "amount": 2}])
assert t["type"] == "line" and t["encoding"]["x"] == "d", t
assert suggest_chart(["a"], [])["type"] == "table"
print("analyst tests OK")
