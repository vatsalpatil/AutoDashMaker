"""Images in AI chats: validation, attachment to the last user message, per-provider formats, friendly 'no vision' error.
Run: backend/.venv/Scripts/python.exe tests/test_ai_vision.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_vision_")
os.environ.update(METADATA_DB=f"{TMP}/m.duckdb", ANALYTICS_DB=f"{TMP}/a.duckdb", UPLOAD_DIR=f"{TMP}/up", DUCKDB_TEMP_DIR=f"{TMP}/spill")
os.makedirs(f"{TMP}/up", exist_ok=True)

import httpx  # noqa: E402

from app.core.store import store  # noqa: E402
from app.services import ai, ai_vision  # noqa: E402
from app.services.ai_errors import friendly  # noqa: E402

PNG = "data:image/png;base64,iVBORw0KGgo="
try:
    ai_vision.use(["data:text/html;base64,PGI+"])
    raise SystemExit("expected ValueError")
except ValueError:
    pass
ai_vision.use([PNG])
msgs = ai_vision.apply([{"role": "system", "content": "s"}, {"role": "user", "content": "copy this dashboard"}])
parts = msgs[1]["content"]
assert parts[0]["type"] == "text" and parts[1] == {"type": "image_url", "image_url": {"url": PNG}}
assert ai_vision.anthropic_parts(parts)[1]["source"] == {"type": "base64", "media_type": "image/png", "data": "iVBORw0KGgo="}
assert ai_vision.gemini_parts(parts)[1] == {"inline_data": {"mime_type": "image/png", "data": "iVBORw0KGgo="}}

sent = {}


def fake_post(url, headers=None, json=None, timeout=None, params=None):
    sent["body"] = json
    return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [{"message": {"content": "ok"}}]})


ai.httpx.post = fake_post
store.insert("ai_providers", {"label": "o", "provider": "openai", "model": "gpt-4o-mini", "api_key": "k", "is_default": True})
assert ai.chat([{"role": "user", "content": "what is in the image?"}]) == "ok"
assert sent["body"]["messages"][0]["content"][1]["type"] == "image_url"
assert "can't read images" in friendly(ai.AIError("404: No endpoints found that support image input"))
print("ai vision tests OK")
