"""AI usage limits: record every model call, learn the provider's limits, pause a provider that hit one, and say when it is back.

Limits come from (best first): your own caps on the provider, the rate-limit headers the provider sent with its last reply
(Groq, OpenAI, Anthropic, OpenRouter), or the published free-tier limits of the model (OpenRouter free models, Gemini).
A 429 pauses the provider until its reset time (Retry-After / reset headers / the next daily reset) and turns the raw error
into a plain `LimitReached` message with the time it will work again; `ai.chat` then falls back to your other providers.
"""
from __future__ import annotations

import json
import re
import uuid
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from ..core.store import store
from .ai import AIError

feature: ContextVar[str] = ContextVar("ai_feature", default="Other")
run_id: ContextVar[str] = ContextVar("ai_run", default="")

_FEATURES = [("/generate", "Generate dashboard"), ("/ai/create", "Create with AI"), ("ai-edit", "Edit with AI"), ("/api/ai/ask", "Ask"),
             ("/api/ai/sql", "SQL assistant"), ("/api/ai/assist", "Workbench assistant"), ("/api/ai/agent", "Workbench assistant"),
             ("/api/ai/providers", "Connection tests"), ("/api/qb", "Query builder"), ("/api/studio", "API studio"), ("/api/why", "Why? engine"),
             ("/api/semantic", "Metrics"), ("/api/reports", "Reports")]


def feature_for(path: str) -> str:
    for key, name in _FEATURES:
        if key in path:
            return name
    parts = [p for p in path.split("/") if p and p != "api"]
    return parts[0].replace("-", " ").capitalize() if parts else "Other"


class UsageContext:
    """ASGI middleware: tags every request with a feature name and a run id, so each model call knows what it was for."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path", "").startswith("/api/"):
            feature.set(feature_for(scope["path"]))
            run_id.set(uuid.uuid4().hex[:10])
        await self.app(scope, receive, send)


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_free(cfg: dict[str, Any]) -> bool:
    m = str(cfg.get("model") or "")
    return m.endswith(":free") or m == "openrouter/free"


def known_limits(cfg: dict[str, Any]) -> dict[str, Any]:
    """{rpd, rpm, tpd, source, note, tz} for a provider config (rpd/rpm/tpd may be None = unknown / unlimited)."""
    kind, model = cfg.get("provider"), str(cfg.get("model") or "").lower()
    out: dict[str, Any] = {"rpd": None, "rpm": None, "tpd": None, "source": "none", "tz": "UTC",
                           "note": "This provider publishes no fixed limit for this model; usage is tracked, limits come from its replies."}
    if kind == "openrouter" and is_free(cfg):
        out.update(rpd=50, rpm=20, source="OpenRouter free tier",
                   note="Free models: 50 requests a day per account (1,000 once you have bought $10 of credits), 20 a minute. Resets at 00:00 UTC.")
    elif kind == "gemini":
        rpd, rpm = (100, 5) if "pro" in model else (1000, 15) if "lite" in model else (250, 10)
        out.update(rpd=rpd, rpm=rpm, tpd=None, source="Google free tier (estimate)", tz="America/Los_Angeles",
                   note=f"Gemini free tier for this model: about {rpd} requests a day and {rpm} a minute. Resets at midnight Pacific time.")
    elif kind == "groq":
        out.update(rpd=1000, rpm=30, source="Groq free tier (estimate)", note="Groq free tier: about 1,000 requests a day, 30 a minute; exact numbers come from its replies.")
    mine = {k: cfg.get(f"limit_{k}") for k in ("rpd", "rpm", "tpd")}
    if any(v for v in mine.values()):
        out.update({k: v for k, v in mine.items() if v}, source="your limit")
    return out


def _zone(tz: str):
    """A time zone; without a tz database (Windows without tzdata) Pacific falls back to UTC-8."""
    if tz == "UTC":
        return timezone.utc
    try:
        return ZoneInfo(tz)
    except Exception:
        return timezone(timedelta(hours=-8))


def window_start(tz: str) -> datetime:
    """Start (UTC, naive) of the current daily quota window."""
    local = datetime.now(_zone(tz))
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.astimezone(timezone.utc).replace(tzinfo=None)


def next_reset(tz: str) -> datetime:
    return window_start(tz) + timedelta(days=1)


_DUR = re.compile(r"([\d.]+)(ms|h|m|s)")


def _seconds(value: str) -> float | None:
    """'2m59.56s' / '6s' / '250ms' / '30' -> seconds."""
    v = str(value).strip()
    try:
        return float(v)
    except ValueError:
        pass
    parts = _DUR.findall(v)
    if not parts:
        return None
    mult = {"h": 3600, "m": 60, "s": 1, "ms": 0.001}
    return sum(float(n) * mult[u] for n, u in parts)


def _epoch(value: str) -> datetime | None:
    try:
        n = float(value)
    except ValueError:
        return None
    if n > 1e12:
        n /= 1000
    if n < 1e9:
        return now() + timedelta(seconds=n)
    return datetime.fromtimestamp(n, timezone.utc).replace(tzinfo=None)


def rate_snapshot(headers: Any) -> dict[str, Any]:
    """The rate-limit headers worth keeping (lower-cased), with the time they were seen."""
    keep = {k.lower(): v for k, v in dict(headers or {}).items()
            if k.lower().startswith(("x-ratelimit", "anthropic-ratelimit", "retry-after"))}
    return {**keep, "_seen": now().isoformat()} if keep else {}


def daily_hit(message: str) -> bool:
    m = message.lower()
    return "per-day" in m or "per day" in m or "daily" in m or "perday" in m or "quota" in m and "minute" not in m


def reset_after(cfg: dict[str, Any], headers: dict[str, Any], message: str) -> tuple[datetime, str]:
    """(when the provider works again, 'daily' | 'per-minute' | 'rate') after a 429."""
    h = {k.lower(): v for k, v in (headers or {}).items()}
    daily = daily_hit(message)
    if h.get("retry-after") and (s := _seconds(h["retry-after"])) is not None:
        return now() + timedelta(seconds=max(s, 1)), "daily" if daily else "rate"
    if h.get("x-ratelimit-reset") and (t := _epoch(h["x-ratelimit-reset"])):
        return t, "daily" if daily else "rate"
    key = "x-ratelimit-reset-requests" if daily or not h.get("x-ratelimit-reset-tokens") else "x-ratelimit-reset-tokens"
    if h.get(key) and (s := _seconds(h[key])) is not None:
        return now() + timedelta(seconds=max(s, 1)), "daily" if daily else "rate"
    if daily:
        return next_reset(known_limits(cfg)["tz"]), "daily"
    return now() + timedelta(seconds=60), "per-minute"


def human(delta: timedelta) -> str:
    s = max(int(delta.total_seconds()), 0)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}h {m:02d}m" if h else f"{m}m {sec:02d}s" if m else f"{sec}s"


class LimitReached(AIError):
    """A provider is paused by its usage limit; `until` is when it works again."""

    def __init__(self, label: str, until: datetime, kind: str, model: str = ""):
        self.label, self.until, self.kind = label, until, kind
        what = "daily usage limit" if kind == "daily" else "rate limit"
        super().__init__(f"{label}{f' ({model})' if model else ''} reached its {what}. It works again in {human(until - now())} "
                         f"(at {until:%H:%M} UTC). Meanwhile, connect or switch to another provider in Settings → AI models.")


def label_of(cfg: dict[str, Any]) -> str:
    return {"openrouter": "OpenRouter", "gemini": "Google Gemini", "groq": "Groq", "openai": "OpenAI", "anthropic": "Anthropic"}.get(cfg.get("provider"), str(cfg.get("provider")))


def check(cfg: dict[str, Any]) -> None:
    """Raise LimitReached before calling a provider that is paused or over your own daily cap."""
    until = cfg.get("blocked_until")
    if isinstance(until, datetime) and until > now():
        raise LimitReached(label_of(cfg), until, "daily" if "day" in str(cfg.get("block_reason") or "") else "rate", cfg.get("model", ""))
    if cfg.get("id") and cfg.get("limit_rpd"):
        tz = known_limits(cfg)["tz"]
        used = store.execute("SELECT COUNT(*) AS n FROM ai_usage WHERE provider_id = ? AND created_at >= ?", [cfg["id"], window_start(tz)])[0]["n"]
        if used >= cfg["limit_rpd"]:
            raise LimitReached(label_of(cfg), next_reset(tz), "daily", cfg.get("model", ""))


def record(cfg: dict[str, Any], ok: bool, ms: int, tokens: tuple[int, int], status: int | None = None, error: str = "",
           headers: Any = None) -> LimitReached | None:
    """Log one call; on a 429 pause the provider and return the LimitReached to raise instead of the raw error."""
    try:
        store.insert("ai_usage", {"provider_id": cfg.get("id"), "provider": cfg.get("provider"), "model": cfg.get("model"),
                                  "feature": feature.get(), "run_id": run_id.get(), "ok": ok, "status": status,
                                  "tokens_in": int(tokens[0]), "tokens_out": int(tokens[1]), "ms": int(ms), "error": error[:300] or None})
    except Exception:
        return None   # usage logging must never break an AI call
    snap = rate_snapshot(headers)
    patch: dict[str, Any] = {"rate_headers": json.dumps(snap)} if snap else {}
    hit = None
    if status == 429:
        until, kind = reset_after(cfg, dict(headers or {}), error)
        patch.update(blocked_until=until, block_reason=f"{'daily' if kind == 'daily' else 'rate'}: {error[:200]}")
        hit = LimitReached(label_of(cfg), until, kind, cfg.get("model", ""))
    elif ok and cfg.get("blocked_until"):
        patch.update(blocked_until=None, block_reason=None)
    if patch and cfg.get("id") and cfg["id"] != "server":
        try:
            store.update("ai_providers", cfg["id"], patch)
        except Exception:
            pass
    return hit


def estimate_tokens(messages: list[dict], text: str = "") -> tuple[int, int]:
    """Rough tokens (4 characters each) when the provider reports no usage."""
    from .ai_vision import text_of
    images = sum(1 for m in messages if isinstance(m.get("content"), list) for p in m["content"] if p.get("type") == "image_url")
    return sum(len(text_of(m.get("content", ""))) for m in messages) // 4 + 1000 * images, len(text) // 4
