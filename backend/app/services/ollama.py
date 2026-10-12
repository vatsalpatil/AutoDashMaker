"""Native Ollama client (self-hosted models).

Why not just the OpenAI-compatible `/v1` endpoint: on a CPU server every generated token costs real time, so two things matter that the
compatible endpoint does not give us control over:
  * `think: false`  - reasoning models otherwise spend most of their (slow) output on a hidden thinking transcript;
  * `format: "json"` - the server constrains decoding to valid JSON, so a small model cannot return prose around its plan.
It also lets us size the context window (`num_ctx`) and keep the model loaded between calls (`keep_alive`), which avoids a minute-long
reload per request. Streaming is NDJSON; each line may carry `message.content` (the answer) and `message.thinking` (reasoning).
"""
from __future__ import annotations

import json
import threading
from typing import Any, Callable

import httpx

from ..core.config import settings

# running totals so a benchmark (or the logs) can report real tokens/second per model
STATS: dict[str, dict[str, float]] = {}
_stats_lock = threading.Lock()


def root(base_url: str | None) -> str:
    """Ollama's own API root: the stored URL may end in /v1 (the OpenAI-compatible path)."""
    return (base_url or "http://localhost:11434/v1").rstrip("/").removesuffix("/v1")


def _record(model: str, final: dict[str, Any]) -> None:
    with _stats_lock:
        s = STATS.setdefault(model, {"calls": 0, "tokens": 0, "gen_s": 0.0, "prompt_tokens": 0, "prompt_s": 0.0, "load_s": 0.0})
        s["calls"] += 1
        s["tokens"] += final.get("eval_count", 0)
        s["gen_s"] += final.get("eval_duration", 0) / 1e9
        s["prompt_tokens"] += final.get("prompt_eval_count", 0)
        s["prompt_s"] += final.get("prompt_eval_duration", 0) / 1e9
        s["load_s"] += final.get("load_duration", 0) / 1e9


def _body(cfg: dict[str, Any], messages: list[dict], max_tokens: int, json_mode: bool, think: bool | None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": cfg["model"], "messages": messages, "stream": True, "keep_alive": settings.ollama_keep_alive,
        "options": {"num_ctx": settings.ollama_num_ctx, "num_predict": max_tokens, "temperature": 0.2},
    }
    if think is not None:
        body["think"] = think
    if json_mode:
        body["format"] = "json"
    return body


def chat(cfg: dict[str, Any], messages: list[dict], max_tokens: int = 2048, timeout: float = 60, json_mode: bool = False,
         on_delta: Callable[[str, str], None] | None = None) -> str:
    """One streamed call. `on_delta(kind, text)` gets 'answer' and 'reasoning' chunks as they arrive; returns the full answer."""
    from .ai import AIError   # lazy: ai imports this module

    url = f"{root(cfg.get('base_url'))}/api/chat"
    think: bool | None = False   # dashboards need the answer, not a transcript of thinking
    for attempt in range(2):
        parts: list[str] = []
        final: dict[str, Any] = {}
        try:
            with httpx.stream("POST", url, json=_body(cfg, messages, max_tokens, json_mode, think), timeout=httpx.Timeout(timeout, connect=10)) as resp:
                if resp.status_code >= 400:
                    resp.read()
                    text = resp.text[:300]
                    if think is not None and "think" in text.lower() and attempt == 0:
                        think = None   # an older Ollama or a model without thinking support: ask again without the flag
                        continue
                    raise AIError(f"{resp.status_code}: {text}")
                for line in resp.iter_lines():
                    if not line.strip():
                        continue
                    chunk = json.loads(line)
                    if chunk.get("error"):
                        raise AIError(str(chunk["error"])[:300])
                    msg = chunk.get("message") or {}
                    if msg.get("thinking") and on_delta:
                        on_delta("reasoning", msg["thinking"])
                    if msg.get("content"):
                        parts.append(msg["content"])
                        if on_delta:
                            on_delta("answer", msg["content"])
                    if chunk.get("done"):
                        final = chunk
        except httpx.ConnectError:
            raise AIError(f"Cannot reach Ollama at {root(cfg.get('base_url'))}. Is the service running, and is the URL the Ollama service name in Dokploy?") from None
        _record(cfg["model"], final)
        text = "".join(parts)
        if not text:
            raise AIError(f"empty content from model (finish_reason={final.get('done_reason')})")
        return text
    raise AIError("Ollama did not accept the request.")
