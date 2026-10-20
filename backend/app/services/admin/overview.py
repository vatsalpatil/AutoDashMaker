"""Backoffice overview: platform-wide totals, daily activity, AI usage, disk and recent errors."""
from __future__ import annotations

import shutil

from ...core.config import DATA_DIR
from ...core.store import store

_TOTALS = ("datasources", "datasets", "dashboards", "charts", "queries", "alerts", "reports", "dashboard_shares")


def _one(sql: str) -> dict:
    rows = store.execute(sql)
    return rows[0] if rows else {}


def overview() -> dict:
    disk = shutil.disk_usage(str(DATA_DIR))
    return {
        "totals": {t: _one(f"SELECT COUNT(*) AS n FROM {t}")["n"] for t in _TOTALS},
        "workspaces": _one("SELECT COUNT(DISTINCT workspace_id) AS n FROM datasets")["n"],
        "activity": _one(
            "SELECT COUNT(*) FILTER (WHERE created_at > now() - INTERVAL 1 DAY) AS requests_24h, "
            "COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - INTERVAL 1 DAY) AS users_24h, "
            "COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - INTERVAL 7 DAY) AS users_7d, "
            "COUNT(*) FILTER (WHERE status >= 500 AND created_at > now() - INTERVAL 1 DAY) AS errors_24h, "
            "ROUND(QUANTILE_CONT(ms, 0.95) FILTER (WHERE created_at > now() - INTERVAL 1 DAY), 1) AS p95_ms_24h FROM activity_log"),
        "ai": _one(
            "SELECT COUNT(*) AS calls_24h, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens_24h, "
            "COUNT(*) FILTER (WHERE NOT ok) AS errors_24h FROM ai_usage WHERE created_at > now() - INTERVAL 1 DAY"),
        "daily": store.execute(
            "SELECT strftime(created_at, '%Y-%m-%d') AS day, COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users, "
            "COUNT(*) FILTER (WHERE status >= 400) AS errors FROM activity_log "
            "WHERE created_at > now() - INTERVAL 14 DAY GROUP BY 1 ORDER BY 1"),
        "ai_daily": store.execute(
            "SELECT strftime(created_at, '%Y-%m-%d') AS day, COUNT(*) AS calls, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens "
            "FROM ai_usage WHERE created_at > now() - INTERVAL 14 DAY GROUP BY 1 ORDER BY 1"),
        "top_paths": store.execute(
            "SELECT method, regexp_replace(path, '/[0-9a-f]{8,}', '/:id', 'g') AS route, COUNT(*) AS n, ROUND(AVG(ms), 1) AS avg_ms "
            "FROM activity_log WHERE created_at > now() - INTERVAL 1 DAY GROUP BY 1, 2 ORDER BY n DESC LIMIT 10"),
        "recent_errors": store.execute(
            "SELECT created_at, email, method, path, status, ms FROM activity_log WHERE status >= 500 ORDER BY created_at DESC LIMIT 20"),
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free},
    }
