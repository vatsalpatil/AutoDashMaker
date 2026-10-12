"""AI usage tracking: calls logged with tokens, a 429 pauses the provider with its reset time, fallback, report + summary.
Run: backend/.venv/Scripts/python.exe tests/test_ai_usage.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_usage_")
os.environ.update(METADATA_DB=f"{TMP}/m.duckdb", ANALYTICS_DB=f"{TMP}/a.duckdb", UPLOAD_DIR=f"{TMP}/up", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/up", exist_ok=True)

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from Main import app  # noqa: E402
from app.core.store import store  # noqa: E402
from app.services import ai, ai_limits  # noqa: E402

c = TestClient(app)
a = store.insert("ai_providers", {"label": "or", "provider": "openrouter", "model": "x/y:free", "api_key": "k", "is_default": True})
b = store.insert("ai_providers", {"label": "g", "provider": "groq", "model": "llama", "api_key": "k2", "is_default": False})

state = {"or": "ok"}


def fake_post(url, headers=None, json=None, timeout=None, params=None):
    req = httpx.Request("POST", url)
    if "openrouter" in url and state["or"] == "429":
        return httpx.Response(429, json={"error": {"message": "Rate limit exceeded: free-models-per-day"}}, request=req,
                              headers={"X-RateLimit-Limit": "50", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "4102444800000"})
    return httpx.Response(200, request=req, headers={"x-ratelimit-limit-requests": "14400", "x-ratelimit-remaining-requests": "14399"},
                          json={"choices": [{"message": {"content": "hi"}}], "usage": {"prompt_tokens": 12, "completion_tokens": 3}})


ai.httpx.post = fake_post

ai_limits.feature.set("Ask")
ai_limits.run_id.set("r1")
assert ai.chat([{"role": "user", "content": "hello"}]) == "hi"
row = store.list("ai_usage")[0]
assert row["ok"] and row["tokens_in"] == 12 and row["tokens_out"] == 3 and row["feature"] == "Ask", row

# 429 on the active provider: it is paused until its reset, and the call falls back to Groq
state["or"] = "429"
assert ai.chat([{"role": "user", "content": "again"}]) == "hi"
pa = store.get("ai_providers", a["id"])
assert pa["blocked_until"] and pa["blocked_until"].year == 2100 and pa["block_reason"].startswith("daily"), pa
try:   # asking the paused provider directly: a plain message with the time it works again, no HTTP call
    ai.chat([{"role": "user", "content": "x"}], provider_id=a["id"])
    raise SystemExit("expected LimitReached")
except ai_limits.LimitReached as e:
    assert "works again in" in str(e) and "daily usage limit" in str(e), str(e)

rep = c.get("/api/ai/usage?days=7").json()
pr = {p["label"]: p for p in rep["providers"]}
assert pr["OpenRouter"]["blocked"] and pr["OpenRouter"]["limits"]["rpd"] == 50, pr["OpenRouter"]
assert pr["Groq"]["remaining"]["requests"] == 14399 and pr["Groq"]["today"]["requests"] == 1, pr["Groq"]
assert rep["periods"]["today"]["requests"] == 3 and rep["periods"]["today"]["errors"] == 1, rep["periods"]
assert rep["by_feature"][0]["feature"] == "Ask" and len(rep["daily"]) == 1
assert c.get("/api/ai/usage/summary").json()["blocked"]

# your own cap: over it, the provider is refused before any call
assert c.post(f"/api/ai/providers/{a['id']}/unblock").status_code == 200
assert c.patch(f"/api/ai/providers/{b['id']}/limits", json={"limit_rpd": 1}).status_code == 200
try:
    ai.chat([{"role": "user", "content": "x"}], provider_id=b["id"])
    raise SystemExit("expected own cap")
except ai_limits.LimitReached:
    pass
assert ai_limits._seconds("2m59.5s") == 179.5 and ai_limits.feature_for("/api/dashboards/x/ai-edit/stream") == "Edit with AI"
print("ai usage tests OK")
