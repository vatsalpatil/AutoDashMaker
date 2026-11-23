"""AI provider registry.

Users can connect any OpenAI-compatible service (OpenAI, Groq, OpenRouter,
custom base_url), Anthropic, or Gemini with their own API key.

Default fallback: Gemini free tier (free input/output tokens, fast flash
models). If the user hasn't configured anything and no env key is present,
AI endpoints return a clear "not configured" response instead of failing.
"""
from __future__ import annotations

import os
import re
from typing import Any

import time

import httpx

from ..core.config import settings
from ..core import tenant
from ..core.store import store

OPENAI_COMPATIBLE_DEFAULTS = {
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}


OPENROUTER_FREE_FALLBACKS = [   # fast, instruction-following, good at SQL (benchmarked 2026-11-24)
    "google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free",   # 1.5 s, 19 s, 49 s
]

# Greedy decoding: the same question over the same data gets the same SQL / answer (analytics needs repeatability).
TEMPERATURE = 0


class AIError(Exception):
    """A provider call failed; `status` and `headers` come from the HTTP reply when there was one."""

    def __init__(self, message: str = "", status: int | None = None, headers: Any = None):
        super().__init__(message)
        self.status, self.headers = status, dict(headers or {})


def _fail(resp: httpx.Response) -> None:
    if resp.status_code >= 400:
        raise AIError(f"{resp.status_code}: {resp.text[:300]}", resp.status_code, resp.headers)


class NotAQuery(Exception):
    """The user's message was not a question about the data (greeting, chit-chat)."""


class NeedsClarification(Exception):
    """The request is too ambiguous to turn into SQL; `args[0]` is the question to put to the user."""


CLARIFY_RULE = ("If the request is genuinely ambiguous (e.g. 'best product' without saying by revenue or quantity), "
                "reply with exactly `CLARIFY: <one short question>` instead of guessing. Prefer answering with a sensible "
                "default when only a small detail is unclear.")
_CLARIFY = re.compile(r"CLARIFY:\s*(.+)", re.IGNORECASE)
NOT_A_QUERY = "NOT_A_QUERY"
NOT_A_QUERY_RULE = (
    f"If the message is only a greeting, thanks or chit-chat, or asks about something none of the listed tables "
    f"could contain (e.g. the weather, news, general knowledge), reply with exactly {NOT_A_QUERY}. Any instruction "
    "to edit, fix, extend, filter, sort, limit or otherwise change the current SQL (\"edit this\", \"only the top 3\", "
    f"\"add a column\") is a valid request: answer it, never {NOT_A_QUERY}."
)


def openrouter_extras(base_url: str, model: str, payload: dict[str, Any]) -> None:
    """OpenRouter only: low reasoning effort (SQL needs little "thinking"), and for shared free models a fallback list,
    so a per-minute rate limit on one model switches to the next instead of failing the feature."""
    if "openrouter.ai" not in base_url:
        return
    payload["reasoning"] = {"effort": "low"}
    if model.endswith(":free"):
        payload["models"] = [model] + [m for m in OPENROUTER_FREE_FALLBACKS if m != model][:2]


def _guard_url(base_url: str) -> None:
    """SSRF check at call time too (providers saved before the router check, or edited in the DB)."""
    from ..core.netguard import NetworkBlocked, ensure_public_url
    try:
        ensure_public_url(base_url)
    except NetworkBlocked as e:
        raise AIError(f"AI provider address not allowed: {e}") from e


def _call_openai_compatible(base_url: str, api_key: str, model: str,
                            messages: list[dict], max_tokens: int = 2048, timeout: float = 60, meta: dict | None = None) -> str:
    payload: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": TEMPERATURE}
    openrouter_extras(base_url, model, payload)
    _guard_url(base_url)
    resp = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {api_key or 'none'}"},
        json=payload,
        timeout=timeout,
    )
    _fail(resp)
    data = resp.json()
    if meta is not None:
        u = data.get("usage") or {}
        meta.update(headers=resp.headers, usage=(u.get("prompt_tokens"), u.get("completion_tokens")))
    choices = data.get("choices")
    if not choices:
        raise AIError(f"provider returned no choices: {str(data)[:300]}")
    content = (choices[0].get("message") or {}).get("content")
    if not content:
        # Reasoning models can spend the whole budget on reasoning and return
        # content=null — never hand None to callers that call .strip() on it.
        raise AIError(
            f"empty content from model (finish_reason={choices[0].get('finish_reason')})"
        )
    return content


def _call_anthropic(api_key: str, model: str, messages: list[dict],
                    max_tokens: int = 2048, timeout: float = 60, meta: dict | None = None) -> str:
    system = "\n".join(m["content"] for m in messages if m["role"] == "system")
    from .ai_vision import anthropic_parts
    user_msgs = [{**m, "content": anthropic_parts(m["content"])} for m in messages if m["role"] != "system"]
    resp = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        # cache the system prompt (instructions + table list): repeated agent steps re-read it at ~10% of the price
        json={"model": model, "max_tokens": max_tokens, "temperature": TEMPERATURE, "messages": user_msgs,
              **({"system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]} if system else {})},
        timeout=timeout,
    )
    _fail(resp)
    data = resp.json()
    if meta is not None:
        u = data.get("usage") or {}
        meta.update(headers=resp.headers, usage=(u.get("input_tokens"), u.get("output_tokens")))
    return "".join(b["text"] for b in data["content"] if b["type"] == "text")


def _call_gemini(api_key: str, model: str, messages: list[dict],
                 max_tokens: int = 2048, meta: dict | None = None) -> str:
    from .ai_vision import gemini_parts
    contents = [
        {"role": "user" if m["role"] != "assistant" else "model",
         "parts": gemini_parts(m["content"])}
        for m in messages if m["role"] != "system"
    ]
    system = "\n".join(m["content"] for m in messages if m["role"] == "system")
    body: dict[str, Any] = {"contents": contents,
                            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": TEMPERATURE}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    resp = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": api_key}, json=body, timeout=60,
    )
    _fail(resp)
    res = resp.json()
    if meta is not None:
        u = res.get("usageMetadata") or {}
        meta.update(headers=resp.headers, usage=(u.get("promptTokenCount"), u.get("candidatesTokenCount")))
    candidates = res.get("candidates")
    if not candidates:
        raise AIError(f"Gemini returned no candidates: {res}")
    cand = candidates[0]
    content = cand.get("content")
    if not content or "parts" not in content:
        raise AIError(f"Gemini response has no content parts (finishReason={cand.get('finishReason')}): {res}")
    parts = content["parts"]
    return "".join(p.get("text", "") for p in parts)


def resolve_provider(provider_id: str | None = None) -> dict[str, Any] | None:
    """Pick the requested provider, else the user's default, else env default."""
    if provider_id:
        return store.get("ai_providers", provider_id)
    _adopt_local_default()
    defaults = store.list("ai_providers", where="is_default = TRUE", order=None)
    if defaults:
        return defaults[0]
    env_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if env_key:
        return {"provider": "gemini", "model": settings.default_ai_model,
                "api_key": env_key, "label": "Gemini (env default)"}
    return None


def _adopt_local_default() -> None:
    """LOCAL_AI_DEFAULT=true (this machine runs Ollama): a workspace that has never had a Local AI provider gets one, as its
    default. Only once — if the user later picks another default or removes it, that choice stands."""
    if not settings.local_ai_default:
        return
    from . import complete_local
    try:
        if store.list("ai_providers", where="provider = 'local'", order=None) or not complete_local.available():
            return
        store.execute("UPDATE ai_providers SET is_default = FALSE WHERE workspace_id = ?", [tenant.current()])
        store.insert("ai_providers", {"provider": "local", "model": os.environ.get("LOCAL_AI_CHAT_MODEL", "qwen2.5-coder:3b-instruct"),
                                      "label": "Local AI", "api_key": "", "is_default": True})
    except Exception:  # noqa: BLE001  (never block an AI call over this)
        pass


def chat(messages: list[dict], provider_id: str | None = None,
         max_tokens: int = 2048, timeout: float = 60) -> str:
    """Call the requested (or active) provider. With no explicit provider, a failure falls back to the
    user's other connected providers in turn, so one dead key or exhausted free quota doesn't stop the app."""
    from . import memory
    messages = memory.inject(messages)   # the user's editable AI memory (Markdown files) rides along on every request
    cfg = resolve_provider(provider_id)
    if not cfg:
        raise AIError(
            "No AI provider configured. Add one in Settings → AI Providers "
            "(Gemini free tier needs only a free Google AI Studio key)."
        )
    if provider_id or not cfg.get("id"):
        return _call(cfg, messages, max_tokens, timeout)
    from .ai_routing import order
    err: Exception | None = None
    for alt in order(cfg):
        try:
            return _call(alt, messages, max_tokens, timeout)
        except Exception as e:
            err = err or e
    raise err  # type: ignore[misc]


def _call(cfg: dict[str, Any], messages: list[dict], max_tokens: int, timeout: float = 60) -> str:
    """One call; a "thinking" model that spent the whole budget reasoning (empty reply, finish_reason=length) gets one
    retry with 4x the budget instead of failing the feature."""
    try:
        return _call_once(cfg, messages, max_tokens, timeout)
    except AIError as e:
        if "empty content" not in str(e) or "length" not in str(e) or max_tokens >= THINKING_CAP:
            raise
        return _call_once(cfg, messages, min(max_tokens * 4, THINKING_CAP), timeout * 2)


THINKING_CAP = 16384


def _call_once(cfg: dict[str, Any], messages: list[dict], max_tokens: int, timeout: float = 60) -> str:
    """One provider call, checked against its usage limits first and logged after (tokens, time, errors, rate-limit headers)."""
    from . import ai_limits, ai_vision   # lazy: ai_limits imports the store
    from .admin.controls import check_ai
    check_ai()  # backoffice kill switch (global / this user)
    ai_limits.check(cfg)
    messages = ai_vision.apply(messages)
    kind, meta, t0 = cfg["provider"], {}, time.perf_counter()
    try:
        if kind == "anthropic":
            text = _call_anthropic(cfg["api_key"], cfg["model"], messages, max_tokens, timeout, meta)
        elif kind == "local":   # open-source model on this server's Ollama (address from server config, never from users)
            from . import complete_local
            try:
                text = complete_local.chat(cfg["model"], messages, max_tokens, timeout, meta, cpu=bool(cfg.get("_cpu")))
            except RuntimeError as e:
                raise AIError(str(e)) from e
        elif kind == "gemini":
            text = _call_gemini(cfg["api_key"], cfg["model"], messages, max_tokens, meta)
        else:
            base_url = cfg.get("base_url") or OPENAI_COMPATIBLE_DEFAULTS.get(kind)
            if not base_url:
                raise AIError(f"unknown provider: {kind}")
            text = _call_openai_compatible(base_url, cfg["api_key"], cfg["model"], messages, max_tokens, timeout, meta)
    except AIError as e:
        hit = ai_limits.record(cfg, False, (time.perf_counter() - t0) * 1000, ai_limits.estimate_tokens(messages), e.status, str(e), e.headers)
        if hit:
            raise hit from None
        raise
    except Exception as e:
        ai_limits.record(cfg, False, (time.perf_counter() - t0) * 1000, ai_limits.estimate_tokens(messages), None, str(e))
        raise
    est = ai_limits.estimate_tokens(messages, text)
    used = meta.get("usage") or (None, None)
    ai_limits.record(cfg, True, (time.perf_counter() - t0) * 1000, (used[0] or est[0], used[1] or est[1]), 200, "", meta.get("headers"))
    return text


from .sql_extract import (  # noqa: F401  (re-exported: other modules reach these through `ai`)
    _ANSI, _FENCE, _REASONING, _SQL_KEYWORD, _STMT_START, _THINK, _parses, extract_sql,
)


def generate_sql(messages: list[dict], provider_id: str | None = None, check=None) -> str:
    """Ask the model for SQL and extract it; retry once, stricter, if the reply held no valid statement
    (reasoning models often burn the first answer on a thinking transcript)."""
    raw = chat(messages, provider_id=provider_id, max_tokens=2048)
    sql = extract_sql(raw)
    # reasoning models quote the rule ("reply with `CLARIFY: <one short question>` instead of guessing"): only a
    # real question, on its own line, counts
    asks = [m.group(1).strip() for m in _CLARIFY.finditer(_THINK.sub("", _ANSI.sub("", raw)))]
    asks = [a for a in asks if "<one short question>" not in a and "instead of guessing" not in a]
    if asks and not _parses(sql):
        raise NeedsClarification(asks[-1])
    if not _parses(sql) and NOT_A_QUERY in _THINK.sub("", _ANSI.sub("", raw)).upper():
        raise NotAQuery()
    if _parses(sql):
        return _fix_case(_repair(messages, sql, provider_id, check))
    retry = messages + [
        {"role": "assistant", "content": sql[:500]},
        {"role": "user", "content": "That was not a single SQL statement. Reply with ONLY the DuckDB SELECT "
                                    "query — no reasoning, no explanation, no markdown."},
    ]
    sql = extract_sql(chat(retry, provider_id=provider_id, max_tokens=2048))
    if not _parses(sql):
        raise AIError("Couldn't turn that into a query. If it is about your data, try rewording it with a table or "
                      "column name; if it keeps happening, pick a non-reasoning model in Settings → AI models.")
    return _fix_case(sql)


def _fix_case(sql: str) -> str:
    """Every AI-written query: 'completed' → 'Completed' when only the case differs from the real column value."""
    from . import value_guard
    try:
        return value_guard.fix_literal_case(sql) or sql
    except Exception:  # noqa: BLE001  (a safety net, never a failure)
        return sql


def _repair(messages: list[dict], sql: str, provider_id: str | None, check) -> str:
    """Execution feedback: if the query does not bind against the real schema, show the model the
    database's error once and take its corrected query (kept only if it parses)."""
    err = check(sql) if check else None
    if not err:
        return sql
    fixed = extract_sql(chat(messages + [
        {"role": "assistant", "content": sql},
        {"role": "user", "content": f"That query failed with: {err}\n"
                                    "Use only the listed tables, columns and the current SQL's CTEs. "
                                    "Reply with ONLY the corrected DuckDB query."},
    ], provider_id=provider_id, max_tokens=2048))
    if not _parses(fixed):
        fixed = sql
    still = check(fixed)
    strong = _stronger_local(provider_id) if still else None
    if strong:  # cascade: the fast local model could not fix it → ask the bigger local model once
        better = extract_sql(_call(strong, messages + [
            {"role": "assistant", "content": fixed},
            {"role": "user", "content": f"That query failed with: {still}\n"
                                        "Use only the listed tables, columns and the current SQL's CTEs (join a CTE before "
                                        "using its columns). Reply with ONLY the corrected DuckDB query."},
        ], 2048))
        if _parses(better) and not check(better):
            return better
    return fixed


def _stronger_local(provider_id: str | None) -> dict[str, Any] | None:
    """Local AI only: who gets one more try at a query the fast local model could not fix —
    a connected cloud provider (fast and strong) if the user has one, else the bigger local model (LOCAL_AI_STRONG_MODEL)."""
    cfg = resolve_provider(provider_id)
    if not cfg or cfg.get("provider") != "local":
        return None
    cloud = [p for p in store.list("ai_providers", order="created_at") if p.get("provider") != "local"]
    if cloud:
        return cloud[0]
    strong = os.environ.get("LOCAL_AI_STRONG_MODEL", "qwen2.5-coder:7b-instruct")
    if cfg.get("model") == strong:
        return None
    from .complete_local import list_models
    try:
        installed = {m["id"] for m in list_models()}
    except Exception:  # noqa: BLE001
        return None
    # GPU by default (on CPU a 7B is too slow); LOCAL_AI_STRONG_CPU=1 keeps it off a GPU shared with the fast models
    return dict(cfg, model=strong, _cpu=os.environ.get("LOCAL_AI_STRONG_CPU") == "1") if strong in installed else None


def test_provider(cfg: dict[str, Any]) -> dict[str, Any]:
    """Probe a provider with a tiny chat call.

    Distinguishes auth/model errors (failed) from "reachable but the model
    returned no text" (ok) — an invalid key or model fails at the HTTP level,
    while content=null only means the token budget was spent on reasoning.
    """
    try:
        out = chat(
            [{"role": "user", "content": "Reply with the single word: ok"}],
            provider_id=cfg.get("id"), max_tokens=256,
        ) if cfg.get("id") else _chat_direct(cfg)
        out = (out or "").strip()
        return {"ok": True, "detail": out[:80] or "reachable"}
    except AIError as e:
        msg = str(e)
        if "empty content" in msg or "no choices" in msg:
            return {"ok": True, "detail": "reachable (model returned no text)"}
        return {"ok": False, "detail": msg[:300]}
    except Exception as e:
        return {"ok": False, "detail": str(e)[:300]}


def _chat_direct(cfg: dict[str, Any]) -> str:
    return _call(cfg, [{"role": "user", "content": "Reply with the single word: ok"}], 256)
