"""AI provider fallback, edit endpoint and removal of leftover Ollama rows."""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = tempfile.mkdtemp(prefix="adm_aifb_")
os.environ.update(METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb",
                  UPLOAD_DIR=f"{TMP}/uploads", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

from fastapi.testclient import TestClient  # noqa: E402
from app.core.store import store  # noqa: E402
from Main import app  # noqa: E402
from app.services import ai  # noqa: E402

c = TestClient(app)
a = store.insert("ai_providers", {"label": "g", "provider": "groq", "model": "m1", "api_key": "k1", "is_default": True})
b = store.insert("ai_providers", {"label": "o", "provider": "openai", "model": "m2", "api_key": "k2", "is_default": False})
store.insert("ai_providers", {"label": "x", "provider": "ollama", "model": "q", "api_key": "", "is_default": False})

calls = []
def fake(base_url, key, model, msgs, max_tokens, timeout=60):
    calls.append(model)
    if model == "m1":
        raise ai.AIError("429 quota")
    return "ok-" + model
ai._call_openai_compatible = fake

assert ai.chat([{"role": "user", "content": "hi"}]) == "ok-m2", calls   # active fails -> next provider
try:
    ai.chat([{"role": "user", "content": "hi"}], provider_id=a["id"]); raise SystemExit("explicit provider must not fall back")
except ai.AIError:
    pass

assert [p["provider"] for p in c.get("/api/ai/providers").json()].count("ollama") == 0
r = c.patch(f"/api/ai/providers/{b['id']}", json={"label": "Work key", "api_key": "k3"})
assert r.status_code == 200, r.text
row = store.get("ai_providers", b["id"])
assert row["label"] == "Work key" and row["api_key"] == "k3"
r = c.patch(f"/api/ai/providers/{a['id']}", json={"api_key": "bad"})   # m1 always fails -> rejected, key kept
assert r.status_code == 400 and store.get("ai_providers", a["id"])["api_key"] == "k1"
print("ok")
