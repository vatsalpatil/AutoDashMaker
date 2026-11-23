"""Inline SQL autocomplete (Copilot-style ghost text) on a small, fast model.

Latency matters more than depth here, so each provider is asked with its fastest model that still writes good SQL
(no "thinking" models), a tiny prompt (schema names + types, earlier cells, the text around the cursor) and
a short answer budget. Results are cached so the same cursor context is never paid for twice.
"""
from __future__ import annotations

import re
import time
from collections import OrderedDict
from typing import Any

from ..core.store import store

# provider kind → fast model for completions; providers not listed keep their own model.
FAST_MODELS = {
    "groq": "llama-3.3-70b-versatile",     # ~300 tok/s on Groq: big-model quality at small-model speed
    "gemini": "gemini-2.5-flash-lite",
    "anthropic": "claude-haiku-5-5",
    "openai": "gpt-4.1-nano",
}
PREFERENCE = ["groq", "gemini", "anthropic", "openai", "openrouter"]   # fastest first
MAX_TOKENS = 96
THINKING_TOKENS = 1024   # retry budget for reasoning models that return nothing within MAX_TOKENS
TIMEOUT = 8.0

_cache: OrderedDict[str, str] = OrderedDict()
_CACHE_MAX = 256

SYSTEM = (
    "You are an SQL autocomplete engine for DuckDB inside a data notebook. "
    "Reply with ONLY the exact text to insert at <CURSOR> — no explanation, no markdown, no code fences, "
    "and never repeat text that is already before the cursor. Complete the current clause or statement in the most "
    "likely way (at most a few lines). Use only the tables, columns and notebook cells listed. "
    "Earlier cells can be queried by name like tables. If nothing sensible fits, reply with an empty string."
)


def pick_provider() -> dict[str, Any] | None:
    """The user's fastest connected provider, with its model swapped for the fast completion model."""
    from .ai import resolve_provider
    rows = store.list("ai_providers", order="created_at") or []
    if not rows:
        cfg = resolve_provider()
        return dict(cfg, model=FAST_MODELS.get(cfg["provider"], cfg["model"])) if cfg else None
    best = min(rows, key=lambda p: PREFERENCE.index(p["provider"]) if p["provider"] in PREFERENCE else len(PREFERENCE))
    model = FAST_MODELS.get(best["provider"], best["model"])
    if best["provider"] == "openrouter" and best.get("model") == "openrouter/free":
        model = best["model"]   # nothing faster we can assume on a free key
    return dict(best, model=model)


def schema_text(limit: int = 40) -> str:
    cols: dict[str, list[str]] = {}
    for c in store.list("columns_meta", order=None):
        cols.setdefault(c["dataset_id"], []).append(f'{c["name"]} {c.get("dtype") or ""}'.strip())
    lines = [f'{d["name"]}({", ".join(cols.get(d["id"], [])[:40])})' for d in store.list("datasets", order=None) if d.get("physical_name")]
    return "\n".join(lines[:limit])


def build_messages(prefix: str, suffix: str, cells: list[dict]) -> list[dict]:
    earlier = "\n".join(f'-- cell {c.get("name")}:\n{(c.get("sql") or "").strip()[:600]}' for c in cells[-6:] if (c.get("sql") or "").strip())
    user = (f"Tables:\n{schema_text() or '(none)'}\n\n"
            + (f"Earlier notebook cells:\n{earlier}\n\n" if earlier else "")
            + f"Current cell:\n{prefix[-1500:]}<CURSOR>{suffix[:300]}")
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]


_FENCE = re.compile(r"^```\w*\n?|\n?```$")


def clean(text: str, prefix: str, suffix: str) -> str:
    """Strip fences / chatter and any echo of the text before the cursor."""
    t = _FENCE.sub("", (text or "").strip("\n")).rstrip()
    t = t.replace("<CURSOR>", "")
    if not t.strip() or t.strip().lower() in {'""', "''", "empty", "(empty)"}:
        return ""
    # the model sometimes repeats the current line or the whole cell: drop the overlap
    for tail in (prefix, prefix.split("\n")[-1]):
        if tail.strip() and t.lstrip().lower().startswith(tail.strip().lower()):
            t = t.lstrip()[len(tail.strip()):]
            break
    else:
        # partial-word overlap: "SELECT reg" + "region, …" → "ion, …"
        word = re.search(r"([\w.]+)$", prefix)
        if word and t.lower().startswith(word.group(1).lower()):
            t = t[len(word.group(1)):]
    # a completion that just rewrites the text after the cursor adds nothing
    if suffix.strip() and t.strip().endswith(suffix.strip()):
        t = t.rstrip()[: -len(suffix.strip())]
    # keep tokens apart: "…FROM" + "sales" → " sales", "a," + "b" → " b" (but never split a word being typed)
    if prefix and not prefix[-1].isspace() and t and (t[0].isalnum() or t[0] in "\"*("):
        if (not re.search(r"[\w.]$", prefix) and prefix[-1] != "(") or re.search(r"\b(select|from|join|where|by|on|and|or|as|having|limit|in)$", prefix, re.I):
            t = " " + t
    return t[:400].rstrip()


def complete(prefix: str, suffix: str = "", cells: list[dict] | None = None, examples: list[str] | None = None) -> dict[str, Any]:
    from . import ai
    if not prefix.strip():
        return {"completion": "", "model": None, "ms": 0, "cached": False}
    from . import complete_local as local
    if local.available():   # local open-source model first: fastest, free, private
        key = f'local|{local.model()}|{prefix[-2000:]}|{suffix[:500]}|{hash(str(cells))}'
        if key in _cache:
            _cache.move_to_end(key)
            return {"completion": _cache[key], "model": local.model(), "ms": 0, "cached": True}
        t0 = time.perf_counter()
        try:
            out = checked(clean(local.generate(prefix, suffix, schema_text(), cells or [], examples), prefix, suffix), prefix, suffix, cells or [])
            _remember(key, out)
            return {"completion": out, "model": local.model(), "ms": round((time.perf_counter() - t0) * 1000), "cached": False}
        except Exception:  # noqa: BLE001  — fall through to the cloud model
            pass
    cfg = pick_provider()
    if not cfg:
        return {"completion": "", "model": None, "ms": 0, "cached": False, "error": "no AI provider"}
    key = f'{cfg.get("id")}|{cfg["model"]}|{prefix[-1500:]}|{suffix[:300]}|{hash(str(cells))}'
    if key in _cache:
        _cache.move_to_end(key)
        return {"completion": _cache[key], "model": cfg["model"], "ms": 0, "cached": True}
    t0 = time.perf_counter()
    msgs = build_messages(prefix, suffix, cells or [])
    try:
        raw = ai._call(cfg, msgs, MAX_TOKENS, TIMEOUT)
    except ai.AIError as e:
        if "empty content" not in str(e):
            raise
        # a "thinking" model spent the short budget on reasoning: once more with room to think, then answer
        raw = ai._call(cfg, msgs, THINKING_TOKENS, TIMEOUT + 7)
    out = checked(clean(raw, prefix, suffix), prefix, suffix, cells or [])
    _remember(key, out)
    return {"completion": out, "model": cfg["model"], "ms": round((time.perf_counter() - t0) * 1000), "cached": False}


def _remember(key: str, out: str) -> None:
    _cache[key] = out
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


_JUNK = re.compile(r"^\s*(1\s*=\s*1|true)\b|(\d+\s*,\s*){4,}", re.I)
# a WHERE / HAVING condition made only of numbers ("2025-2020 > 1") filters nothing useful
_NUMERIC_COND = re.compile(r"\b(where|having|and|or)\s*$", re.I)
_ONLY_NUMBERS = re.compile(r"^\s*[\d\s+\-*/<>=.()']+(?=\b(group|order|limit)\b|$)", re.I)
_UNKNOWN = re.compile(r"Referenced (column|table)|does not exist|not found|Binder Error", re.I)


def checked(out: str, prefix: str, suffix: str, cells: list[dict]) -> str:
    """Drop junk, and suggestions that name a column/table the data does not have (DuckDB bind check, no execution).
    Unfinished SQL (a parse error) is fine — the user is still typing."""
    if not out or _JUNK.search(out) or (_NUMERIC_COND.search(prefix) and _ONLY_NUMBERS.match(out)):
        return ""
    from .compose import compose_cell_sql
    from .engine import engine
    full = prefix + out + suffix
    try:
        sql = compose_cell_sql([*cells, {"name": "__cursor_cell", "sql": full}], len(cells), set(engine.list_tables()))
    except Exception:  # noqa: BLE001  (cell naming problems are not the suggestion's fault)
        sql = full
    err = engine.check_sql(sql)
    return "" if err and _UNKNOWN.search(err) else out
