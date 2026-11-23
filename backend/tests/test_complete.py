"""Inline SQL autocomplete: fast-model pick, prompt, cleanup, cache. Run: backend/.venv/Scripts/python.exe tests/test_complete.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s")

from app.core.store import store
from app.services import ai, complete as c

# ---- no provider: empty, no crash ----
os.environ.pop("GOOGLE_API_KEY", None); os.environ.pop("GEMINI_API_KEY", None)
assert c.complete("SELECT ")["completion"] == ""

# ---- fastest provider wins, model swapped for the fast one ----
store.insert("ai_providers", {"provider": "openrouter", "model": "x/big", "api_key": "k", "label": "or", "is_default": True})
store.insert("ai_providers", {"provider": "groq", "model": "deepseek-r1", "api_key": "k", "label": "g", "is_default": False})
cfg = c.pick_provider()
assert cfg["provider"] == "groq" and cfg["model"] == c.FAST_MODELS["groq"], cfg

# ---- prompt carries schema + earlier cells + cursor ----
ds = store.insert("datasets", {"name": "sales", "physical_name": "ds_sales"})
store.insert("columns_meta", {"dataset_id": ds["id"], "name": "region", "dtype": "VARCHAR"})
msgs = c.build_messages("SELECT reg", "", [{"name": "step_1", "sql": "SELECT 1"}])
u = msgs[-1]["content"]
assert "sales(region VARCHAR)" in u and "step_1" in u and u.endswith("SELECT reg<CURSOR>"), u

# ---- cleanup: fences, echoes, partial-word overlap, empty ----
assert c.clean("```sql\nion, sum(x)\n```", "SELECT reg", "") == "ion, sum(x)"
assert c.clean("SELECT region FROM sales", "SELECT reg", "") == "ion FROM sales"
assert c.clean("region FROM sales", "SELECT reg", "") == "ion FROM sales"
assert c.clean("FROM sales", "SELECT region ", "") == "FROM sales"
assert c.clean('""', "SELECT ", "") == ""
assert c.clean("sales", "SELECT * FROM", "") == " sales"
assert c.clean("amount)", "SELECT sum(", "") == "amount)"
assert c.clean("b", "SELECT a,", "") == " b"

# ---- model call + cache (second identical request is free) ----
calls = []
def fake(cfg, messages, max_tokens, timeout=60):
    calls.append((cfg["model"], max_tokens, timeout))
    return "ion, SUM(amount) FROM sales GROUP BY ALL"
ai._call = fake
r1 = c.complete("SELECT reg", "", [])
r2 = c.complete("SELECT reg", "", [])
assert r1["completion"] == "ion, SUM(amount) FROM sales GROUP BY ALL" and r2["cached"] and len(calls) == 1, (r1, r2, calls)
assert calls[0][0] == c.FAST_MODELS["groq"] and calls[0][1] <= 128 and calls[0][2] <= 10

# ---- route never raises ----
from app.routers.ai_complete import complete as route, CompleteIn
ai._call = lambda *a, **k: (_ for _ in ()).throw(ai.AIError("rate limited"))
out = route(CompleteIn(prefix="SELECT x", suffix=""))
assert out["completion"] == "" and out.get("error"), out
print("test_complete OK")
