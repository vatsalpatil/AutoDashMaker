"""'Local AI' provider (Ollama on this server): routed through ai.chat, text-only messages, clear errors, model list.
Run: backend/.venv/Scripts/python.exe tests/test_ai_local.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s",
                  UPLOAD_DIR=tmp + "/up", LOCAL_AI_URL="http://127.0.0.1:59999")

import httpx
from app.core.store import store
from app.services import ai, ai_models, complete_local as L

sent = []
class Resp:
    def __init__(self, status, body): self.status_code, self._b = status, body
    def json(self): return self._b
    def raise_for_status(self):
        if self.status_code >= 400: raise httpx.HTTPStatusError("x", request=None, response=None)

def fake_post(url, timeout, json):
    sent.append((url, json))
    return Resp(200, {"message": {"content": "SELECT 1"}, "prompt_eval_count": 12, "eval_count": 3})
L.httpx.post = fake_post

store.insert("ai_providers", {"provider": "local", "model": "qwen2.5-coder:7b-instruct", "api_key": "", "label": "Local", "is_default": True})
out = ai.chat([{"role": "system", "content": "S"}, {"role": "user", "content": [{"type": "text", "text": "hi"}, {"type": "image_url", "image_url": {}}]}])
assert out == "SELECT 1", out
url, body = sent[-1]
assert url.endswith("/api/chat") and body["model"] == "qwen2.5-coder:7b-instruct" and body["options"]["temperature"] == 0
assert body["options"]["num_ctx"] == L.CHAT_CTX and body["keep_alive"]
assert body["messages"][1]["content"] == "hi", body["messages"]   # image parts dropped, text kept

# not running / model missing → readable AIError (and the fallback chain can move on)
def down(*a, **k): raise httpx.ConnectError("refused")
L.httpx.post = down
try:
    ai._call({"provider": "local", "model": "m"}, [{"role": "user", "content": "x"}], 10); raise SystemExit("no error")
except ai.AIError as e:
    assert "not running" in str(e), e
L.httpx.post = lambda url, timeout, json: Resp(404, {})
try:
    ai._call({"provider": "local", "model": "nope"}, [{"role": "user", "content": "x"}], 10); raise SystemExit("no error")
except ai.AIError as e:
    assert "ollama pull nope" in str(e), e

# catalog + model list hides base (autocomplete-only) models
assert any(c["id"] == "local" for c in ai_models.PROVIDER_CATALOG)
L.httpx.get = lambda url, timeout: Resp(200, {"models": [{"name": "qwen2.5-coder:3b-base", "size": 1.9e9}, {"name": "qwen2.5-coder:7b-instruct", "size": 4.7e9}]})
assert [m["id"] for m in L.list_models()] == ["qwen2.5-coder:7b-instruct"]
# cascade: the fast local model's SQL still fails after its own repair → the bigger local model gets one try
store.execute("UPDATE ai_providers SET model = 'qwen2.5-coder:3b-instruct'")
L.httpx.get = lambda url, timeout: Resp(200, {"models": [{"name": "qwen2.5-coder:3b-instruct"}, {"name": "qwen2.5-coder:7b-instruct"}]})
used = []
def post(url, timeout, json):
    used.append(json["model"])
    return Resp(200, {"message": {"content": "SELECT good FROM t" if "7b" in json["model"] else "SELECT bad FROM t"}})
L.httpx.post = post
check = lambda q: "Binder Error: Referenced column bad not found" if "bad" in q else None
assert ai.generate_sql([{"role": "user", "content": "q"}], check=check) == "SELECT good FROM t", used
assert used == ["qwen2.5-coder:3b-instruct", "qwen2.5-coder:3b-instruct", "qwen2.5-coder:7b-instruct"], used
used.clear()   # SQL that binds never escalates
L.httpx.post = lambda url, timeout, json: (used.append(json["model"]), Resp(200, {"message": {"content": "SELECT good FROM t"}}))[1]
ai.generate_sql([{"role": "user", "content": "q"}], check=check)
assert used == ["qwen2.5-coder:3b-instruct"], used
# with a cloud provider connected, the escalation goes there instead of the big local model
store.insert("ai_providers", {"provider": "groq", "model": "llama-3.3-70b-versatile", "api_key": "k", "label": "g", "is_default": False})
assert ai._stronger_local(None)["provider"] == "groq"
# LOCAL_AI_DEFAULT: a workspace without a Local AI row gets one as default, once
from app.core import tenant
with tenant.use("ws_adopt"):
    store.insert("ai_providers", {"provider": "openrouter", "model": "m", "api_key": "k", "label": "or", "is_default": True})
    L.available = lambda: True
    from app.core.config import settings
    settings.local_ai_default = True
    cfg = ai.resolve_provider()
    assert cfg["provider"] == "local" and cfg["model"] == "qwen2.5-coder:3b-instruct", cfg
    store.execute("UPDATE ai_providers SET is_default = (provider = 'openrouter') WHERE workspace_id = 'ws_adopt'")
    assert ai.resolve_provider()["provider"] == "openrouter"   # the user's later choice is kept
    assert len(store.list("ai_providers", where="provider = 'local'", order=None)) == 1
    settings.local_ai_default = False
print("test_ai_local OK")
