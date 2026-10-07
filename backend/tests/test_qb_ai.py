"""Run: backend/.venv/Scripts/python.exe tests/test_qb_ai.py   (model replaced by a script, so no provider is needed)"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()  # temp stores BEFORE any `app` import
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services import ai as ai_svc, qb_ai
from app.services.engine import engine
from app.services.qb_explain import describe_spec

with engine.writer() as con:
    con.execute("CREATE TABLE ds_sales AS SELECT * FROM (VALUES (1,'N',10.0,DATE '2024-01-05'),(2,'N',20.0,DATE '2024-02-05'),(3,'S',5.0,DATE '2024-02-09')) t(cid,region,amount,d)")
    con.execute("CREATE TABLE ds_cust AS SELECT * FROM (VALUES (1,'Ann'),(2,'Bob')) t(cid,name)")
for name, phys, cols in (("Sales", "ds_sales", [("cid", "BIGINT"), ("region", "VARCHAR"), ("amount", "DOUBLE"), ("d", "DATE")]), ("Cust", "ds_cust", [("cid", "BIGINT"), ("name", "VARCHAR")])):
    ds = store.insert("datasets", {"name": name, "physical_name": phys, "workspace_id": "default"})
    for c, t in cols:
        store.insert("columns_meta", {"dataset_id": ds["id"], "name": c, "dtype": t})

replies: list[str] = []
seen: list[list[dict]] = []
def fake_chat(messages, provider_id=None, max_tokens=2048):
    seen.append(messages)
    return replies.pop(0)
ai_svc.chat = fake_chat

# 0) a simple request never reaches the model
def boom(*a, **k): raise AssertionError("model must not be called")
_real, ai_svc.chat = ai_svc.chat, boom
out = qb_ai.build_spec("total amount by region", None, None)
assert out["source"] == "rules" and out["attempts"] == 0, out
ai_svc.chat = _real

# 1) fenced JSON, 'Sales.amount' style refs and a stray key are cleaned; result compiles and runs
replies[:] = ['Sure!\n```json\n' + json.dumps({"spec": {"table": "sales", "bogus": 1, "aggregations": [{"fn": "sum", "col": "Sales.amount", "as": "total"}],
              "breakouts": [{"col": "region"}], "sort": [{"col": "total", "dir": "desc"}]}, "explanation": "Total by region", "title": "Sales by region"}) + '\n```']
out = qb_ai.build_spec("total amount by region where relevant", None, None)
assert out["attempts"] == 1 and out["spec"]["stages"][0]["table"] == "Sales" and "bogus" not in out["spec"]["stages"][0], out
assert out["spec"]["stages"][0]["aggregations"][0]["col"] == {"t": "t0", "c": "amount"}, out["spec"]
assert any("Summarize" in s for s in out["steps"]) and out["title"] == "Sales by region"

# 2) a wrong column is sent back to the model with the real error, and its second answer is used
replies[:] = [json.dumps({"spec": {"table": "Sales", "breakouts": [{"col": "nope"}], "aggregations": [{"fn": "count"}]}}),
              json.dumps({"spec": {"table": "Sales", "breakouts": [{"col": "region"}], "aggregations": [{"fn": "count"}]}, "explanation": "rows per region"})]
seen.clear()
out = qb_ai.build_spec("rows per region where relevant", None, None)
assert out["attempts"] == 2 and "failed" in seen[1][-1]["content"], out

# 3) refinement: the current spec travels with the request
cur = out["spec"]
replies[:] = [json.dumps({"spec": {"stages": [{**cur["stages"][0], "filters": [{"col": "amount", "op": ">", "value": 5}]}]}, "explanation": "only amounts above 5"})]
seen.clear()
out = qb_ai.build_spec("keep the best performing ones", cur, None)
assert "CURRENT SPEC" in seen[0][-1]["content"] and out["spec"]["stages"][0]["filters"], out

# 4) unknown table -> repair, then a clear error when the model keeps failing
replies[:] = [json.dumps({"spec": {"table": "Ghost"}})] * 3
try:
    qb_ai.build_spec("anything", None, None); raise SystemExit("should fail")
except ValueError as e:
    assert "Ghost" in str(e)

# 5) a join spec with t0/t1 refs works
replies[:] = [json.dumps({"spec": {"table": "Sales", "joins": [{"table": "Cust", "type": "inner", "on": [{"left": "t0.cid", "right": "t1.cid"}]}],
              "breakouts": [{"col": "t1.name", "as": "who"}], "aggregations": [{"fn": "sum", "col": "t0.amount", "as": "total"}]}})]
out = qb_ai.build_spec("spend per customer name where relevant", None, None)
assert out["spec"]["stages"][0]["joins"][0]["on"][0]["right"] == {"t": "t1", "c": "cid"}

# 6) formula helper validates the expression on real rows and repairs
replies[:] = [json.dumps({"expr": "amount / (", "explanation": "x"}), json.dumps({"expr": "amount * 2", "explanation": "double"})]
f = qb_ai.formula("double the amount", "Sales", [{"name": "amount"}], "", "", None)
assert f["expr"] == "amount * 2"

# 6b) the model ran out of tokens but stated its answer: the expression is salvaged (and still validated on real rows)
replies[:] = ["Thinking...\n   Expression: `ROUND(amount * 2, 1)`\n   Check constraints: yes"]
assert qb_ai.formula("double it", "Sales", [{"name": "amount"}], "", "", None)["expr"] == "ROUND(amount * 2, 1)"

# 7) describe_spec is deterministic English
steps = describe_spec({"stages": [{"table": "Sales", "filters": [{"col": "amount", "op": ">", "value": 5}], "aggregations": [{"fn": "sum", "col": "amount"}], "breakouts": [{"col": "d", "bucket": "month"}], "limit": 10}]})
assert steps[0].startswith("Start from") and any("amount is greater than 5" in s for s in steps), steps
print("qb ai ok")

# ---- rules fast path (no model): must be right when it answers, and decline when unsure
from app.services import qb_rules
from app.services.qb import compile_spec as _compile
assert qb_rules.quick_spec("total amount by region")["stages"][0]["aggregations"][0]["fn"] == "sum"
s = qb_rules.quick_spec("average amount per region")["stages"][0]
assert s["aggregations"][0]["fn"] == "avg" and s["breakouts"][0]["col"] == "region", s
s = qb_rules.quick_spec("top 1 region by amount")["stages"][0]
assert s["limit"] == 1 and s["sort"][0]["dir"] == "desc" and s["breakouts"][0]["col"] == "region", s
s = qb_rules.quick_spec("total amount by month")["stages"][0]
assert s["breakouts"][0]["bucket"] == "month" and s["sort"][0]["dir"] == "asc", s
s = qb_rules.quick_spec("how many rows per region")["stages"][0]
assert s["aggregations"][0]["fn"] == "count", s
s = qb_rules.quick_spec("sum of amount and count of cid by region")["stages"][0]
assert [a["fn"] for a in s["aggregations"]] == ["sum", "count_col"], s
for hard in ("compare amount between north and south", "amount growth over time", "customers whose amount is greater than 10", "show me something nice"):
    assert qb_rules.quick_spec(hard) is None, hard
for ok in ("total amount by region", "average amount per region", "top 1 region by amount", "total amount by month", "how many rows per region"):
    engine.execute(_compile(qb_rules.quick_spec(ok)), 5)     # every fast-path answer must also run
# the safety net: a model forgot 'top 3' and the month bucket
sp = {"stages": [{"table": "Sales", "breakouts": [{"col": "d"}], "aggregations": [{"fn": "sum", "col": "amount", "as": "t"}]}]}
sp = qb_rules.hints("top 3 totals by month", sp)["stages"][0]
assert sp["limit"] == 3 and sp["sort"][0]["col"] == "t" and sp["breakouts"][0]["bucket"] == "month", sp
print("qb rules ok")

# ---- editing an open query without a model
cur = qb_rules.quick_spec("total amount by region")
def run_spec(sp): return list(engine.execute(_compile(sp), 50)["rows"])
e = qb_rules.refine_spec("only region is n", cur)
assert e["stages"][0]["filters"][0] == {"col": "region", "op": "=", "value": "N"}, e        # typed "n": resolved to the real value, plain =
e2 = qb_rules.refine_spec("only region is zzz", cur)
assert e2["stages"][0]["filters"][0]["op"] == "ieq", e2                                      # unknown value: any-case match
assert [r["region"] for r in run_spec(e)] == ["N"], run_spec(e)
e = qb_rules.refine_spec("amount > 6", cur)
assert e["stages"][0]["filters"][0]["op"] == ">" and e["stages"][0]["filters"][0]["value"] == 6, e
e = qb_rules.refine_spec("only region is s, add the count", cur)
assert any(a["fn"] == "count" for a in e["stages"][0]["aggregations"]) and e["stages"][0]["filters"], e
assert len(run_spec(e)) == 1
e = qb_rules.refine_spec("sort by region ascending", cur)
assert e["stages"][0]["sort"] == [{"col": "region", "dir": "asc"}], e
assert qb_rules.refine_spec("limit 1", cur)["stages"][0]["limit"] == 1
filtered = qb_rules.refine_spec("only region is n", cur)
assert "filters" not in qb_rules.refine_spec("remove filters", filtered)["stages"][0]
for hard in ("make it purple", "only nonsense is x", "only region is n, and make it pretty"):
    assert qb_rules.refine_spec(hard, cur) is None, hard
# through build_spec: the model is not called for these, and an AI answer that changes nothing is rejected
ai_svc.chat = boom
assert qb_ai.build_spec("only region is n", cur, None)["source"] == "rules"
ai_svc.chat = fake_chat
replies[:] = [json.dumps({"spec": cur}), json.dumps({"spec": {"stages": [{**cur["stages"][0], "limit": 2, "filters": [{"col": "amount", "op": ">", "value": 1}]}]}})]
seen.clear()
out = qb_ai.build_spec("something only a model can do", cur, None)
assert out["attempts"] == 2 and "unchanged" in seen[1][-1]["content"], out
print("qb refine ok")
