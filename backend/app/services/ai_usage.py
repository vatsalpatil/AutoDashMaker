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


# calls that never reached the provider's quota (rejected by the limit, network errors) do not count against it
_COUNTED = "(ok OR (status IS NOT NULL AND status <> 429))"


def _limits(cfg: dict[str, Any], account: dict | None) -> dict[str, Any]:
    lim = known_limits(cfg)
    if account and cfg.get("provider") == "openrouter" and lim["source"] == "OpenRouter free tier" and account.get("free_tier") is False:
        lim.update(rpd=1000, note="Free models: 1,000 requests a day (your account has bought credits), 20 a minute. Resets at 00:00 UTC.")
    return lim


def _left(cfg: dict[str, Any], account: dict | None = None) -> dict[str, Any]:
    """What is left in the current window for one provider/key: {lim, start, reset, day, remaining, rpd, exact, live, pct}."""
    lim = _limits(cfg, account)
    start, reset = window_start(lim["tz"]), next_reset(lim["tz"])
    day = _sum(f"provider_id = ? AND created_at >= ? AND {_COUNTED}", [cfg["id"], start])
    day["errors"] = _sum("provider_id = ? AND created_at >= ? AND NOT ok", [cfg["id"], start])["requests"]
    snap = cfg.get("rate_headers")
    live = _from_headers(json.loads(snap) if isinstance(snap, str) and snap else {})
    seen = live.get("seen")
    if seen and seen < start.isoformat():   # headers from a previous window say nothing about today
        live = {**live, "remaining_requests": None, "limit_requests": None, "remaining_tokens": None, "limit_tokens": None}
    rpd = lim["rpd"]
    remaining = max(rpd - day["requests"], 0) if rpd else None
    exact = False
    if live["remaining_requests"] is not None and live["limit_requests"] and live["limit_requests"] >= 100:   # a daily-sized live counter beats our count
        rpd, exact = live["limit_requests"], True
        remaining = live["remaining_requests"]
    tpd = lim["tpd"]
    tokens_left = max(tpd - day["tokens_in"] - day["tokens_out"], 0) if tpd else None
    pcts = [100 * remaining / rpd] if rpd and remaining is not None else []
    if tpd and tokens_left is not None:
        pcts.append(100 * tokens_left / tpd)
    until = cfg.get("blocked_until")
    blocked = bool(until and until > now())
    return {"lim": lim, "start": start, "reset": reset, "day": day, "remaining": remaining, "rpd": rpd, "tpd": tpd, "tokens_left": tokens_left,
            "exact": exact, "live": live, "pct": 0 if blocked else (round(min(pcts)) if pcts else None)}


def pct_left(cfg: dict[str, Any]) -> int | None:
    """% left of the tightest known daily limit (requests or tokens); 0 when paused, None when unlimited/unknown."""
    if not cfg.get("id"):
        return None
    acct = _ACCOUNT_CACHE.get(cfg.get("api_key") or "", (0, None))[1]
    return _left(cfg, acct)["pct"]


def _provider(cfg: dict[str, Any]) -> dict[str, Any]:
    pid = cfg["id"]
    account = _openrouter_account(cfg) if cfg["provider"] == "openrouter" else None
    L = _left(cfg, account)
    lim, day, remaining, rpd = L["lim"], L["day"], L["remaining"], L["rpd"]
    minute = _sum(f"provider_id = ? AND created_at >= ? AND {_COUNTED}", [pid, now() - timedelta(seconds=60)])["requests"]
    until = cfg.get("blocked_until")
    blocked = {"until": until.isoformat() + "Z", "reason": cfg.get("block_reason") or "", "seconds": int((until - now()).total_seconds())}         if until and until > now() else None
    first = store.execute("SELECT MIN(created_at) AS t FROM ai_usage WHERE provider_id = ?", [pid])[0]["t"]
    key = cfg.get("api_key") or ""
    return {"id": pid, "provider": cfg["provider"], "tracked_since": first.isoformat() + "Z" if first else None,
            "exact": L["exact"],   # False = counted by Dashtor only (calls from other apps / before tracking are not seen)
            "label": label_of(cfg), "name": cfg.get("label") or label_of(cfg), "key_hint": ("•••" + key[-4:]) if key else "",
            "model": cfg.get("model"), "is_default": bool(cfg.get("is_default")),
            "auto_switch": cfg.get("auto_switch") is not False, "switch_below": cfg.get("switch_below") if cfg.get("switch_below") is not None else 5,
            "limits": {"rpd": rpd, "rpm": lim["rpm"], "tpd": L["tpd"], "source": lim["source"], "note": lim["note"], "tz": lim["tz"],
                       "mine": {k: cfg.get(f"limit_{k}") for k in ("rpd", "rpm", "tpd")}},
            "window": {"start": L["start"].isoformat() + "Z", "resets_at": L["reset"].isoformat() + "Z", "seconds_to_reset": int((L["reset"] - now()).total_seconds())},
            "today": day, "last_minute": minute,
            "remaining": {"requests": 0 if blocked and remaining is not None else remaining, "tokens": L["tokens_left"], "pct": L["pct"],
                          "minute": max(lim["rpm"] - minute, 0) if lim["rpm"] else None},
            "live": L["live"], "blocked": blocked, "runs_left": _runs_left(pid, remaining),
            "account": account}


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
                          f"SUM(CASE WHEN ok THEN 1 ELSE 0 END) AS ok, SUM(CASE WHEN ok THEN 0 ELSE 1 END) AS errors FROM ai_usage WHERE {where} GROUP BY 1 ORDER BY 1", params)
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
    return {"provider": p["label"], "model": p["model"], "remaining": p["remaining"], "exact": p["exact"], "tracked_since": p["tracked_since"], "limits": {"rpd": p["limits"]["rpd"]},
            "today": p["today"]["requests"], "window": p["window"], "blocked": p["blocked"]}
