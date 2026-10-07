"""SQL extraction from messy model replies. Run: backend/.venv/Scripts/python.exe tests/test_ai_sql.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # temp stores BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.services import ai

ex = ai.extract_sql
assert ex("SELECT 1 AS x") == "SELECT 1 AS x"
assert ex("```sql\nSELECT a FROM t;\n```") == "SELECT a FROM t"
assert ex("Sure!\n```\nWITH c AS (SELECT 1) SELECT * FROM c\n```\nHope that helps") == "WITH c AS (SELECT 1) SELECT * FROM c"
assert ex("<think>maybe SELECT 2 FROM nowhere</think>SELECT region, SUM(amount) FROM ds_x GROUP BY region") == \
    "SELECT region, SUM(amount) FROM ds_x GROUP BY region"
assert ex("\x1b[4mHere\x1b[0m:\nSELECT 5 AS five") == "SELECT 5 AS five"

# the reported failure: a thinking transcript quoting the editor's SQL, with the real answer last
thought = (
    "Here's a thinking process:\n1. **Analyze User Input:**\n- Current SQL in editor: SELECT 1 AS hello;\n"
    "2. **Interpret the Request:** user wants sales\n3. **Draft:**\nSELECT SUM(amount) AS total_sales FROM ds_sales_west_only"
)
assert ex(thought) == "SELECT SUM(amount) AS total_sales FROM ds_sales_west_only", ex(thought)

# truncated transcript: the only SQL is quoted context followed by prose -> must NOT return it
cut = "Here's a thinking process:\n1. **Analyze User Input:**\n- Current SQL in editor: SELECT 1 AS hello;\n2. **Interpret the Request:** user asks"
assert not ai._parses(ex(cut)), ex(cut)

# generate_sql: first reply is reasoning, retry returns SQL
replies = iter([cut, "SELECT 42 AS answer"])
ai.chat = lambda *a, **k: next(replies)
assert ai.generate_sql([{"role": "user", "content": "q"}]) == "SELECT 42 AS answer"

# both replies unusable -> friendly AIError, not a parser dump
replies = iter([cut, cut])
try:
    ai.generate_sql([{"role": "user", "content": "q"}])
    raise SystemExit("expected AIError")
except ai.AIError as e:
    assert "reasoning" in str(e)
# a greeting: the model says NOT_A_QUERY -> NotAQuery, no retry and no invented SQL
calls = []
def greeting(*a, **k):
    calls.append(1)
    return "NOT_A_QUERY"
ai.chat = greeting
try:
    ai.generate_sql([{"role": "user", "content": "hi"}])
    raise SystemExit("expected NotAQuery")
except ai.NotAQuery:
    assert len(calls) == 1, "must not retry"
# ...but a transcript that merely mentions it while still producing SQL is fine
ai.chat = lambda *a, **k: "Rule says NOT_A_QUERY only for chit-chat.\n```sql\nSELECT 7 AS n\n```"
assert ai.generate_sql([{"role": "user", "content": "q"}]) == "SELECT 7 AS n"
# execution feedback: first query references a missing table, the DB error is fed back, 2nd reply is used
seen = []
replies = iter(["SELECT * FROM region_sales", "SELECT * FROM sales"])
def chat_fb(msgs, *a, **k):
    seen.append(msgs[-1]["content"])
    return next(replies)
ai.chat = chat_fb
fixed = ai.generate_sql([{"role": "user", "content": "q"}], check=lambda q: "Table region_sales does not exist" if "region_sales" in q else None)
assert fixed == "SELECT * FROM sales" and "does not exist" in seen[-1], (fixed, seen)
# a query that already binds is returned without a second model call
n = []
ai.chat = lambda *a, **k: (n.append(1), "SELECT 1")[1]
assert ai.generate_sql([{"role": "user", "content": "q"}], check=lambda q: None) == "SELECT 1" and len(n) == 1
print("ai sql tests OK")
