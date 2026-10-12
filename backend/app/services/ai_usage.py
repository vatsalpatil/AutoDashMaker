"""AI usage report: what was used in a period, what is left in each provider's current window, when it resets,
how many more runs of each feature that allows, and whether a provider is paused (and until when)."""
from __future__ import annotations

import json
import time
from datetime import timedelta
from typing import Any

import httpx

from ..core import tenant
from ..core.store import store
from . import ai as ai_svc
from .ai_limits import known_limits, label_of, next_reset, now, window_start

_ACCOUNT_CACHE: dict[str, tuple[float, dict | None]] = {}


def _where(extra: str = "") -> tuple[str, list]:
    ws = tenant.current()
    base, params = ("1=1", []) if ws == tenant.ALL else ("workspace_id = ?", [ws])
    return (f"{base} AND {extra}" if extra else base), params


def _sum(where: str, params: list) -> dict[str, Any]:
    r = store.execute(f"SELECT COUNT(*) AS requests, COALESCE(SUM(tokens_in), 0) AS tokens_in, COALESCE(SUM(tokens_out), 0) AS tokens_out, "
                      f"COALESCE(SUM(CASE WHEN ok THEN 0 ELSE 1 END), 0) AS errors, COALESCE(AVG(ms), 0) AS avg_ms FROM ai_usage WHERE {where}", params)[0]
    return {k: (round(v) if isinstance(v, float) else int(v or 0)) for k, v in r.items()}


def _openrouter_account(cfg: dict[str, Any]) -> dict[str, Any] | None:
    """OpenRouter's own numbers for the key (credits used / limit / free tier), cached 5 minutes."""
    key = cfg.get("api_key") or ""
    hit = _ACCOUNT_CACHE.get(key)
    if hit and time.monotonic() - hit[0] < 300:
        return hit[1]
    data = None
    try:
        r = httpx.get("https://openrouter.ai/api/v1/key", headers={"Authorization": f"Bearer {key}"}, timeout=8)
        if r.status_code == 200:
            d = r.json().get("data") or {}
            data = {"usage_usd": d.get("usage"), "limit_usd": d.get("limit"), "remaining_usd": d.get("limit_remaining"),
                    "free_tier": d.get("is_free_tier"), "usage_daily_usd": d.get("usage_daily")}
    except Exception:
        data = None
    _ACCOUNT_CACHE[key] = (time.monotonic(), data)
    return data


def _from_headers(snap: dict[str, Any]) -> dict[str, Any]:
    """Live limit numbers the provider sent with its last reply (Groq/OpenAI/Anthropic/OpenRouter style)."""
    def num(*keys):
        for k in keys:
            if snap.get(k) not in (None, ""):
                try:
                    return int(float(snap[k]))
                except ValueError:
                    pass
        return None
    return {"limit_requests": num("x-ratelimit-limit-requests", "x-ratelimit-limit", "anthropic-ratelimit-requests-limit"),
            "remaining_requests": num("x-ratelimit-remaining-requests", "x-ratelimit-remaining", "anthropic-ratelimit-requests-remaining"),
            "limit_tokens": num("x-ratelimit-limit-tokens", "anthropic-ratelimit-tokens-limit"),
            "remaining_tokens": num("x-ratelimit-remaining-tokens", "anthropic-ratelimit-tokens-remaining"),
            "reset_requests": snap.get("x-ratelimit-reset-requests"), "reset_tokens": snap.get("x-ratelimit-reset-tokens"), "seen": snap.get("_seen")}


def _runs_left(pid: str, remaining: int | None) -> list[dict[str, Any]]:
    """How many more runs of each feature the remaining requests allow, from the average calls per run over 30 days."""
    if remaining is None:
        return []
    rows = store.execute("SELECT feature, COUNT(*) * 1.0 / COUNT(DISTINCT run_id) AS per_run FROM ai_usage "
                         "WHERE provider_id = ? AND run_id <> '' AND created_at >= ? GROUP BY feature ORDER BY COUNT(*) DESC LIMIT 5",
                         [pid, now() - timedelta(days=30)])
    return [{"feature": r["feature"], "calls_per_run": round(r["per_run"], 1), "runs_left": int(remaining // max(r["per_run"], 1))} for r in rows]


def _provider(cfg: dict[str, Any]) -> dict[str, Any]:
    lim = known_limits(cfg)
    start, reset = window_start(lim["tz"]), next_reset(lim["tz"])
    pid = cfg["id"]
    day = _sum("provider_id = ? AND created_at >= ?", [pid, start])
    minute = _sum("provider_id = ? AND created_at >= ?", [pid, now() - timedelta(seconds=60)])["requests"]
    snap = cfg.get("rate_headers")
    live = _from_headers(json.loads(snap) if isinstance(snap, str) and snap else {})
    rpd = lim["rpd"]
    remaining = max(rpd - day["requests"], 0) if rpd else None
    if live["remaining_requests"] is not None and live["limit_requests"] and live["limit_requests"] >= 100:   # a daily-sized live counter beats our estimate
        remaining, rpd = live["remaining_requests"], live["limit_requests"]
    tpd = lim["tpd"]
    tokens_used = day["tokens_in"] + day["tokens_out"]
    until = cfg.get("blocked_until")
    blocked = {"until": until.isoformat() + "Z", "reason": cfg.get("block_reason") or "", "seconds": int((until - now()).total_seconds())} \
        if until and until > now() else None
    return {"id": pid, "provider": cfg["provider"], "label": label_of(cfg), "model": cfg.get("model"), "is_default": bool(cfg.get("is_default")),
            "limits": {"rpd": rpd, "rpm": lim["rpm"], "tpd": tpd, "source": lim["source"], "note": lim["note"], "tz": lim["tz"],
                       "mine": {k: cfg.get(f"limit_{k}") for k in ("rpd", "rpm", "tpd")}},
            "window": {"start": start.isoformat() + "Z", "resets_at": reset.isoformat() + "Z", "seconds_to_reset": int((reset - now()).total_seconds())},
            "today": day, "last_minute": minute,
            "remaining": {"requests": remaining, "tokens": max(tpd - tokens_used, 0) if tpd else None,
                          "pct": round(100 * remaining / rpd) if rpd and remaining is not None else None,
                          "minute": max(lim["rpm"] - minute, 0) if lim["rpm"] else None},
            "live": live, "blocked": blocked, "runs_left": _runs_left(pid, remaining),
            "account": _openrouter_account(cfg) if cfg["provider"] == "openrouter" else None}


def report(days: int = 30) -> dict[str, Any]:
    days = max(1, min(int(days), 365))
    since = now() - timedelta(days=days)
    where, params = _where("created_at >= ?")
    params = [*params, since]
    periods = {}
    for key, delta in (("today", None), ("7d", 7), ("30d", 30)):
        w, p = _where("created_at >= ?")
        periods[key] = _sum(w, [*p, window_start("UTC") if delta is None else now() - timedelta(days=delta)])
    w_all, p_all = _where()
    periods["all"] = _sum(w_all, p_all)
    daily = store.execute(f"SELECT CAST(created_at AS DATE) AS day, COUNT(*) AS requests, SUM(tokens_in + tokens_out) AS tokens, "
                          f"SUM(CASE WHEN ok THEN 0 ELSE 1 END) AS errors FROM ai_usage WHERE {where} GROUP BY 1 ORDER BY 1", params)
    by_feature = store.execute(f"SELECT feature, COUNT(*) AS requests, SUM(tokens_in + tokens_out) AS tokens FROM ai_usage WHERE {where} "
                               "GROUP BY 1 ORDER BY 2 DESC", params)
    by_model = store.execute(f"SELECT provider, model, COUNT(*) AS requests, SUM(tokens_in + tokens_out) AS tokens, AVG(ms) AS avg_ms FROM ai_usage "
                             f"WHERE {where} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10", params)
    recent = store.execute(f"SELECT created_at, provider, model, feature, ok, status, tokens_in, tokens_out, ms, error FROM ai_usage WHERE {where} "
                           "ORDER BY created_at DESC LIMIT 25", params)
    providers = [_provider(c) for c in store.list("ai_providers", order="is_default DESC, created_at")]
    active = next((p for p in providers if p["is_default"]), providers[0] if providers else None)
    return {"days": days, "periods": periods, "selected": _sum(where, params), "daily": [{**d, "day": str(d["day"])} for d in daily],
            "by_feature": by_feature, "by_model": [{**m, "avg_ms": round(m["avg_ms"] or 0)} for m in by_model],
            "recent": [{**r, "created_at": r["created_at"].isoformat() + "Z"} for r in recent], "providers": providers,
            "active": active["id"] if active else None, "now": now().isoformat() + "Z"}


def summary() -> dict[str, Any]:
    """Small payload for the header pill: the active provider's remaining requests, reset and pause."""
    cfg = ai_svc.resolve_provider()
    if not cfg or not cfg.get("id"):
        return {"provider": None}
    p = _provider(cfg)
    return {"provider": p["label"], "model": p["model"], "remaining": p["remaining"], "limits": {"rpd": p["limits"]["rpd"]},
            "today": p["today"]["requests"], "window": p["window"], "blocked": p["blocked"]}
