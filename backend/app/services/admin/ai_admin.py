"""Backoffice AI view: platform-wide usage (by user, model, feature, day), failures and every connected key (never the key)."""
from __future__ import annotations

from ...core.store import store
from .users import owner_map

_WINDOW = "created_at > now() - INTERVAL {days} DAY"


def overview(days: int = 30) -> dict:
    days = max(1, min(int(days), 365))
    w = _WINDOW.format(days=days)
    owners = owner_map()
    by_user = store.execute(
        f"SELECT workspace_id, COUNT(*) AS calls, COALESCE(SUM(tokens_in), 0) AS tokens_in, COALESCE(SUM(tokens_out), 0) AS tokens_out, "
        f"COUNT(*) FILTER (WHERE NOT ok) AS errors, MAX(created_at) AS last_call FROM ai_usage WHERE {w} GROUP BY 1 ORDER BY calls DESC")
    for r in by_user:
        r["owner"] = owners.get(r["workspace_id"], r["workspace_id"])
    providers = store.execute(
        "SELECT id, workspace_id, label, provider, model, is_default, limit_rpd, blocked_until, block_reason, created_at FROM ai_providers "
        "ORDER BY workspace_id, created_at")
    for r in providers:
        r["owner"] = owners.get(r["workspace_id"], r["workspace_id"])
    return {
        "days": days,
        "totals": store.execute(
            f"SELECT COUNT(*) AS calls, COALESCE(SUM(tokens_in), 0) AS tokens_in, COALESCE(SUM(tokens_out), 0) AS tokens_out, "
            f"COUNT(*) FILTER (WHERE NOT ok) AS errors, ROUND(AVG(ms)) AS avg_ms FROM ai_usage WHERE {w}")[0],
        "daily": store.execute(
            f"SELECT strftime(created_at, '%Y-%m-%d') AS day, COUNT(*) AS calls, COUNT(*) FILTER (WHERE NOT ok) AS errors, "
            f"COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens FROM ai_usage WHERE {w} GROUP BY 1 ORDER BY 1"),
        "by_model": store.execute(
            f"SELECT provider, model, COUNT(*) AS calls, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens, "
            f"COUNT(*) FILTER (WHERE NOT ok) AS errors, ROUND(AVG(ms)) AS avg_ms FROM ai_usage WHERE {w} GROUP BY 1, 2 ORDER BY calls DESC"),
        "by_feature": store.execute(
            f"SELECT COALESCE(feature, 'other') AS feature, COUNT(*) AS calls, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens "
            f"FROM ai_usage WHERE {w} GROUP BY 1 ORDER BY calls DESC"),
        "by_user": by_user,
        "recent_errors": store.execute(
            f"SELECT created_at, workspace_id, provider, model, feature, status, error FROM ai_usage WHERE NOT ok AND {w} "
            "ORDER BY created_at DESC LIMIT 30"),
        "providers": providers,
    }


def unblock_provider(provider_id: str) -> dict:
    """Clear a rate-limit pause on someone's key (e.g. after they upgraded their plan)."""
    store.execute("UPDATE ai_providers SET blocked_until = NULL, block_reason = NULL WHERE id = ?", [provider_id])
    return {"ok": True}
