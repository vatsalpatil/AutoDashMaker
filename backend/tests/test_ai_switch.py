"""Auto-switch: two keys of the same provider; once the active key drops below its threshold, the one with more left is used."""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = tempfile.mkdtemp(prefix="adm_aisw_")
os.environ.update(METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb",
                  UPLOAD_DIR=f"{TMP}/uploads", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

from fastapi.testclient import TestClient  # noqa: E402
from app.core.store import store  # noqa: E402
from Main import app  # noqa: E402
from app.services import ai  # noqa: E402

c = TestClient(app)
k1 = store.insert("ai_providers", {"label": "Key 1", "provider": "groq", "model": "m", "api_key": "k1", "is_default": True, "limit_rpd": 10})
k2 = store.insert("ai_providers", {"label": "Key 2", "provider": "groq", "model": "m", "api_key": "k2", "is_default": False, "limit_rpd": 10})
used = []
ai._call_openai_compatible = lambda base, key, *a, **k: used.append(key) or "ok"

for _ in range(9):
    ai.chat([{"role": "user", "content": "hi"}])
assert used == ["k1"] * 9, used                       # 10% left > 5% threshold -> stays on key 1
assert c.patch(f"/api/ai/providers/{k1['id']}/switch", json={"auto_switch": True, "switch_below": 20}).status_code == 200
ai.chat([{"role": "user", "content": "hi"}])
assert used[-1] == "k2", used                         # 10% <= 20% -> key 2 has the most left
c.patch(f"/api/ai/providers/{k1['id']}/switch", json={"auto_switch": False, "switch_below": 20})
ai.chat([{"role": "user", "content": "hi"}])
assert used[-1] == "k1", used                         # off -> active key first
store.insert("ai_usage", {"provider_id": k2["id"], "provider": "groq", "model": "m", "ok": False, "status": 429, "tokens_in": 0, "tokens_out": 0, "ms": 1})
rep = c.get("/api/ai/usage").json()
p2 = next(p for p in rep["providers"] if p["id"] == k2["id"])
assert p2["today"]["requests"] == 1 and p2["today"]["errors"] == 1 and p2["name"] == "Key 2", p2   # a 429 does not use quota
print("ok")
