"""Local open-source code model for inline SQL completion (Tabnine-style), served by Ollama.

Qwen2.5-Coder is trained for fill-in-the-middle: we send the text before the cursor as `prompt` and the text after
it as `suffix`, and Ollama wraps them in the model's FIM tokens. The model stays loaded (keep_alive), answers are
greedy (temperature 0) and short (stop at a blank line / end of statement), so a suggestion takes tens of ms on a GPU.
No key, no cost, nothing leaves the machine.

Config (env): LOCAL_AI_URL (default http://127.0.0.1:11434, empty string = off), LOCAL_AI_MODEL (default qwen2.5-coder:3b-base).
"""
from __future__ import annotations

import os
import re
import threading
import time

import httpx

DEFAULT_MODEL = "qwen2.5-coder:3b-base"   # ~180 ms warm on a 6 GB laptop GPU; 1.5b is faster but less accurate
_up: tuple[float, bool] = (0.0, False)   # (checked_at, available) — re-checked every 30 s
_client = httpx.Client(timeout=httpx.Timeout(20.0, connect=0.3))


def url() -> str:
    return os.environ.get("LOCAL_AI_URL", "http://127.0.0.1:11434").rstrip("/")


def model() -> str:
    return os.environ.get("LOCAL_AI_MODEL", DEFAULT_MODEL)


def available() -> bool:
    """Ollama running with the model pulled (cached, so a missing server costs one quick check per 30 s)."""
    global _up
    if not url():
        return False
    now = time.monotonic()
    if now - _up[0] < 30:
        return _up[1]
    ok = False
    try:
        tags = _client.get(f"{url()}/api/tags").json().get("models", [])
        want = model()
        ok = any(m.get("name") in (want, f"{want}:latest") for m in tags)
    except Exception:  # noqa: BLE001
        ok = False
    if ok and not _up[1]:
        threading.Thread(target=warm, daemon=True).start()
    _up = (now, ok)
    return ok


def context_comment(schema: str, cells: list[dict], examples: list[str]) -> str:
    """Schema as CREATE TABLE, earlier cells as CREATE VIEW, the user's recent queries as examples: code models read DDL best."""
    lines = ["-- DuckDB SQL"] + [f"CREATE TABLE {t};" for t in schema.splitlines() if t.strip()]
    for c in cells[-4:]:
        sql = (c.get("sql") or "").strip().rstrip(";")
        if sql and c.get("name"):
            lines.append(f"CREATE VIEW {c['name']} AS {sql[:800]};")
    for q in examples[:5]:
        q = " ".join(q.split()).rstrip(";")
        if q:
            lines.append(q[:500] + ";")
    return "\n".join(lines) + "\n\n"


OPTIONS = {"temperature": 0, "num_predict": 40, "num_ctx": 2048,   # num_ctx fixed: a different value reloads the model
           "stop": ["\n", ";", "<|endoftext|>", "<|fim_pad|>", "<|file_sep|>"]}


def warm() -> None:
    """Load the model onto the GPU before the first keystroke needs it."""
    try:
        _client.post(f"{url()}/api/generate", json={"model": model(), "prompt": "SELECT", "stream": False, "keep_alive": "60m",
                                                    "options": dict(OPTIONS, num_predict=1)})
    except Exception:  # noqa: BLE001
        pass


def generate(prefix: str, suffix: str, schema: str, cells: list[dict], examples: list[str] | None = None) -> str:
    # token healing: FIM models complete whole tokens badly, so the half-typed word is cut off the prompt and the
    # answer must start with it ("SELECT reg" → prompt "SELECT ", answer must start "reg…")
    m = re.search(r"[A-Za-z_][\w]*$", prefix)
    partial = m.group(0) if m else ""
    head = prefix[: len(prefix) - len(partial)]
    r = _client.post(f"{url()}/api/generate", json={
        "model": model(),
        "prompt": context_comment(schema, cells, examples or []) + head[-2000:],
        "suffix": suffix[:500],
        "stream": False,
        "keep_alive": "60m",
        "options": OPTIONS,
    })
    r.raise_for_status()
    out = r.json().get("response", "")
    if partial:
        if not out.lower().startswith(partial.lower()):
            return ""
        out = out[len(partial):]
    return out
