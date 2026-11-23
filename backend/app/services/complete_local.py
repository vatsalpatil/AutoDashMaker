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


# ---- general chat on a local instruct model (the "Local AI" provider: Ask, SQL, charts, dashboards, agent…) ----
CHAT_CTX = 4096   # fixed (a change reloads the model); 4K keeps a 7B model fully on a 6 GB GPU


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):   # OpenAI-style parts: keep the text ones (local models here are text-only)
        return "\n".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    return str(content or "")


def chat(model_name: str, messages: list[dict], max_tokens: int = 2048, timeout: float = 60, meta: dict | None = None,
         cpu: bool = False) -> str:
    """`cpu=True` keeps the model off the GPU (a rarely used bigger model must not evict the fast ones from VRAM)."""
    if not url():
        raise RuntimeError("Local AI is not set up on this server (LOCAL_AI_URL is empty)")
    try:
        r = httpx.post(f"{url()}/api/chat", timeout=timeout, json={
            "model": model_name,
            "messages": [{"role": m.get("role", "user"), "content": _text(m.get("content"))} for m in messages],
            "stream": False,
            "keep_alive": "60m",
            "options": {"temperature": 0, "num_ctx": CHAT_CTX, "num_predict": max_tokens, **({"num_gpu": 0} if cpu else {})},
        })
    except httpx.ConnectError as e:
        raise RuntimeError("Local AI (Ollama) is not running on this server. Start Ollama, or pick another provider.") from e
    if r.status_code == 404:
        raise RuntimeError(f"Local model '{model_name}' is not installed. Run: ollama pull {model_name}")
    r.raise_for_status()
    data = r.json()
    if meta is not None:
        meta.update(usage=(data.get("prompt_eval_count"), data.get("eval_count")))
    return (data.get("message") or {}).get("content", "")


def list_models() -> list[dict]:
    """Installed instruct/chat models (base models only do autocomplete, so they are left out)."""
    tags = httpx.get(f"{url()}/api/tags", timeout=5).json().get("models", [])
    return [{"id": m["name"], "name": f'{m["name"]} ({m.get("size", 0) / 1e9:.1f} GB)', "free": True}
            for m in tags if "-base" not in m["name"] and "embed" not in m["name"]]
