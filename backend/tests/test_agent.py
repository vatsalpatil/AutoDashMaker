"""Workbench agent loop with a scripted model: tools run, SQL errors are fed back, add_cell is only proposed, ask mode blocks it.
Run: backend/.venv/Scripts/python.exe tests/test_agent.py"""
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
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")

from app.core.store import store
from app.services import agent, ai as ai_svc, names
from app.services.engine import engine

with engine.writer() as con:
    con.execute("CREATE TABLE ds_sales_ab12 AS SELECT * FROM (VALUES ('W', 10.0), ('W', 5.0), ('E', 7.0)) t(region, amount)")
ds = store.insert("datasets", {"name": "Sales", "physical_name": "ds_sales_ab12", "kind": "file", "row_count": 3})
store.insert("columns_meta", {"dataset_id": ds["id"], "name": "region", "dtype": "VARCHAR"})
store.insert("columns_meta", {"dataset_id": ds["id"], "name": "amount", "dtype": "DOUBLE"})
names.invalidate()


def script(*replies):
    """Replace the model with a scripted one; also record the prompts it saw."""
    seen = []
    it = iter(replies)

    def fake(messages, provider_id=None, max_tokens=2048):
        seen.append(messages)
        return next(it)
    ai_svc.chat = fake
    return seen


def j(thought, tool, **args):
    return "Let me think...\n" + json.dumps({"thought": thought, "tool": tool, "args": args})


ctx = agent.context("", None, [], "agent")
assert "Sales [3 rows]: region VARCHAR, amount DOUBLE" in ctx, ctx   # friendly names, no ds_ id

# 1. explore, hit an SQL error, repair it, answer
seen = script(
    j("see tables", "list_tables"),
    j("try", "run_sql", sql="SELECT regon, SUM(amount) FROM Sales GROUP BY 1"),
    j("fix the column", "run_sql", sql="SELECT region, SUM(amount) AS total FROM Sales GROUP BY 1 ORDER BY 1"),
    j("done", "final", answer="West sells 15, East 7."),
)
ev = list(agent.run("total by region?", [], "ask", ctx))
kinds = [e["type"] for e in ev]
assert kinds == ["step", "observation", "step", "observation", "step", "observation", "step", "final"], kinds
assert ev[1]["text"].startswith("- Sales (3 rows)"), ev[1]
assert ev[3]["ok"] is False and "regon" in ev[3]["text"].lower() or "not found" in ev[3]["text"].lower(), ev[3]
assert ev[5]["ok"] and ev[5]["rows"] == [{"region": "E", "total": 7.0}, {"region": "W", "total": 15.0}], ev[5]
assert ev[-1]["text"] == "West sells 15, East 7." and "SUM(amount)" in ev[-1]["sql"]
assert any("Observation:" in m["content"] and "regon" in m["content"].lower() for m in seen[2] if m["role"] == "user")  # the error reached the model

# 2. writes are never executed here: agent mode proposes, ask mode refuses
script(j("add", "add_cell", sql="SELECT 1", run=True), j("done", "final", answer="Added."))
ev = list(agent.run("add a cell", [], "agent", ctx))
assert ev[1]["type"] == "action" and ev[1]["kind"] == "add_cell" and ev[1]["sql"] == "SELECT 1" and ev[1]["run"] is True, ev
script(j("add", "add_cell", sql="SELECT 1"), j("done", "final", answer="Cannot."))
ev = list(agent.run("add a cell", [], "ask", ctx))
assert ev[1]["type"] == "observation" and ev[1]["ok"] is False and not any(e["type"] == "action" for e in ev), ev

# 3. unsafe SQL is blocked and reported to the model, not executed
script(j("bad", "run_sql", sql="DROP TABLE ds_sales_ab12"), j("done", "final", answer="ok"))
ev = list(agent.run("drop it", [], "agent", ctx))
assert ev[1]["ok"] is False and "blocked" in ev[1]["text"], ev
assert engine.execute("SELECT COUNT(*) AS n FROM Sales")["rows"][0]["n"] == 3

# 4. a prose answer is accepted as the final answer; garbage twice is an error; running out of steps ends cleanly
script("Just plain words, no JSON.")
ev = list(agent.run("hi", [], "ask", ctx))
assert ev[-1]["type"] == "final" and ev[-1]["text"] == "Just plain words, no JSON.", ev
script("{not json", "{still not")
ev = list(agent.run("hi", [], "ask", ctx))
assert ev[-1]["type"] == "error", ev
script(*[j("again", "list_tables")] * agent.MAX_STEPS)
ev = list(agent.run("loop", [], "ask", ctx))
assert ev[-1]["type"] == "final" and "ran out of steps" in ev[-1]["text"], ev[-1]
print("agent tests OK")
