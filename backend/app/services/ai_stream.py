"""Model calls that show their work: stream the thinking and the answer into the live channel while still returning the full text.

`chat_live()` behaves exactly like `ai.chat()` when nobody listens (no live sink, or no step number). When someone does, an
OpenAI-compatible provider (OpenAI, OpenRouter, Groq...) is called with `stream: true` and every chunk of reasoning /
answer is pushed (batched, so a fast model does not flood the connection). Anthropic and Gemini fall back to one push at the end.
"""
from __future__ import annotations

import json
import time
from typing import Any

import httpx

from . import ai, live

FLUSH_SECONDS = 0.15
FLUSH_CHARS = 80


class _Batcher:
    """Collects small deltas and pushes them every ~150 ms (or 80 characters) as one event per kind."""

    def __init__(self, step: int, lane: str | None, label: str | None):
        self.step, self.lane, self.label, self.buf, self.last = step, lane, label, [], time.monotonic()

    def add(self, kind: str, text: str) -> None:
        if self.buf and self.buf[-1][0] == kind:
            self.buf[-1][1] += text
        else:
            self.buf.append([kind, text])
        if time.monotonic() - self.last >= FLUSH_SECONDS or sum(len(t) for _, t in self.buf) >= FLUSH_CHARS:
            self.flush()

    def flush(self) -> None:
        for kind, text in self.buf:
            live.push(self.step, kind, text, self.lane, self.label)
        self.buf, self.last = [], time.monotonic()


def _stream_openai(base_url: str, cfg: dict[str, Any], messages: list[dict], max_tokens: int, timeout: float, step: int, lane: str | None, label: str | None) -> str:
    from . import ai_limits
    ai_limits.check(cfg)
    t0 = time.perf_counter()
    try:
        text, usage, headers = _stream_body(base_url, cfg, messages, max_tokens, timeout, step, lane, label)
    except ai.AIError as e:
        hit = ai_limits.record(cfg, False, (time.perf_counter() - t0) * 1000, ai_limits.estimate_tokens(messages), e.status, str(e), e.headers)
        if hit:
            raise hit from None
        raise
    est = ai_limits.estimate_tokens(messages, text)
    ai_limits.record(cfg, True, (time.perf_counter() - t0) * 1000, (usage.get("prompt_tokens") or est[0], usage.get("completion_tokens") or est[1]), 200, "", headers)
    return text


def _stream_body(base_url: str, cfg: dict[str, Any], messages: list[dict], max_tokens: int, timeout: float, step: int, lane: str | None,
                 label: str | None) -> tuple[str, dict, Any]:
    payload: dict[str, Any] = {"model": cfg["model"], "messages": messages, "max_tokens": max_tokens, "stream": True,
                               "stream_options": {"include_usage": True}}
    if "openrouter.ai" in base_url:
        payload["reasoning"] = {"effort": "low"}
    batch, parts, finish, usage, headers = _Batcher(step, lane, label), [], None, {}, None
    live.push(step, "reset", "", lane, label)
    with httpx.stream("POST", f"{base_url.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {cfg.get('api_key') or 'none'}"},
                      json=payload, timeout=timeout) as resp:
        headers = resp.headers
        if resp.status_code >= 400:
            resp.read()
            raise ai.AIError(f"{resp.status_code}: {resp.text[:300]}", resp.status_code, resp.headers)
        for line in resp.iter_lines():
            if not line.startswith("data:"):   # blank keep-alives and ': OPENROUTER PROCESSING' comments
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                obj = json.loads(data)
            except ValueError:
                continue
            if obj.get("error"):
                err = obj["error"]
                code = err.get("code") if isinstance(err, dict) else None
                raise ai.AIError(str(err)[:300], code if isinstance(code, int) else None, headers)
            usage = obj.get("usage") or usage
            choice = (obj.get("choices") or [{}])[0]
            delta = choice.get("delta") or {}
            finish = choice.get("finish_reason") or finish
            if delta.get("reasoning") or delta.get("reasoning_content"):
                batch.add("reasoning", delta.get("reasoning") or delta.get("reasoning_content"))
            if delta.get("content"):
                parts.append(delta["content"])
                batch.add("answer", delta["content"])
    batch.flush()
    text = "".join(parts)
    if not text:
        raise ai.AIError(f"empty content from model (finish_reason={finish})")
    return text, usage, headers


def chat_live(messages: list[dict], provider_id: str | None = None, max_tokens: int = 2048, timeout: float = 60, step: int | None = None,
              lane: str | None = None, label: str | None = None) -> str:
    if live.sink.get() is None or step is None:
        return ai.chat(messages, provider_id=provider_id, max_tokens=max_tokens, timeout=timeout)
    cfg = ai.resolve_provider(provider_id)
    if cfg and cfg["provider"] not in ("anthropic", "gemini"):
        base_url = cfg.get("base_url") or ai.OPENAI_COMPATIBLE_DEFAULTS.get(cfg["provider"])
        if base_url:
            return _stream_openai(base_url, cfg, messages, max_tokens, timeout, step, lane, label)
    text = ai.chat(messages, provider_id=provider_id, max_tokens=max_tokens, timeout=timeout)
    live.push(step, "answer", text, lane, label)
    return text
