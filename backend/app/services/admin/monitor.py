"""Backoffice monitoring: live load, traffic breakdowns and resource usage, all from activity_log / ai_usage + /proc.

Per-user and product-adoption views live in monitor_users.py.
"""
from __future__ import annotations

import shutil
import time
from datetime import date, timedelta

from ...core.config import DATA_DIR
from ...core.store import store
from . import activity, resources
from .system import STARTED

ROUTE = "regexp_replace(path, '/[0-9a-f-]{8,}', '/:id', 'g')"
# first path segment after /api = the product area ("datasets", "ai", "dashboards"…)
AREA = "split_part(path, '/', 3)"
DEVICE = ("CASE WHEN user_agent ILIKE '%mobile%' THEN 'Mobile' WHEN user_agent ILIKE '%python%' OR user_agent ILIKE '%curl%' "
          "OR user_agent ILIKE '%httpx%' OR user_agent ILIKE '%node%' THEN 'Script / API' WHEN user_agent = '' OR user_agent IS NULL "
          "THEN 'Unknown' ELSE 'Desktop' END")
BROWSER = ("CASE WHEN user_agent ILIKE '%edg/%' THEN 'Edge' WHEN user_agent ILIKE '%chrome/%' THEN 'Chrome' "
           "WHEN user_agent ILIKE '%firefox/%' THEN 'Firefox' WHEN user_agent ILIKE '%safari/%' THEN 'Safari' "
           "WHEN user_agent ILIKE '%claude%' OR user_agent ILIKE '%openai%' OR user_agent ILIKE '%mcp%' THEN 'AI client (MCP)' "
           "ELSE 'Other' END")


def _one(sql: str, params: list | None = None) -> dict:
    rows = store.execute(sql, params or [])
    return rows[0] if rows else {}


def _since(minutes: int) -> str:
    return f"created_at > now() - INTERVAL {int(minutes)} MINUTE"


def window(start: str | None, end: str | None, hours: int) -> tuple[str, float]:
    """SQL filter on created_at + its length in hours: a custom date range (inclusive days, validated) or the last N hours."""
    if not (start or end):
        return f"created_at > now() - INTERVAL {int(hours)} HOUR", hours
    hi = date.fromisoformat(end) + timedelta(days=1) if end else date.today() + timedelta(days=1)
    lo = date.fromisoformat(start) if start else hi - timedelta(days=30)
    if lo >= hi:
        lo, hi = hi - timedelta(days=1), lo + timedelta(days=1)
    return f"created_at >= TIMESTAMP '{lo}' AND created_at < TIMESTAMP '{hi}'", (hi - lo).days * 24


def live() -> dict:
    """Everything that changes second to second: the page polls this every few seconds."""
    disk = shutil.disk_usage(str(DATA_DIR))
    return {
        "inflight": activity.inflight[0],
        "uptime_s": round(time.time() - STARTED),
        "now": _one(
            f"SELECT COUNT(*) FILTER (WHERE {_since(1)}) AS req_1m, COUNT(*) FILTER (WHERE {_since(5)}) AS req_5m, "
            f"COUNT(*) AS req_60m, COUNT(*) FILTER (WHERE status >= 500) AS err5_60m, "
            f"COUNT(*) FILTER (WHERE status BETWEEN 400 AND 499) AS err4_60m, "
            f"COUNT(DISTINCT user_id) FILTER (WHERE {_since(5)}) AS users_5m, COUNT(DISTINCT user_id) FILTER (WHERE {_since(15)}) AS users_15m, "
            f"COUNT(DISTINCT user_id) AS users_60m, COUNT(DISTINCT ip) FILTER (WHERE {_since(15)}) AS ips_15m, "
            f"ROUND(QUANTILE_CONT(ms, 0.5), 1) AS p50, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95, ROUND(QUANTILE_CONT(ms, 0.99), 1) AS p99, "
            f"ROUND(MAX(ms), 1) AS max_ms FROM activity_log WHERE {_since(60)}"),
        "ai_60m": _one(f"SELECT COUNT(*) AS calls, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens, COUNT(*) FILTER (WHERE NOT ok) AS errors, "
                       f"ROUND(AVG(ms)) AS avg_ms FROM ai_usage WHERE {_since(60)}"),
        "per_minute": store.execute(
            f"SELECT strftime(date_trunc('minute', created_at), '%H:%M') AS time, COUNT(*) AS requests, "
            f"COUNT(*) FILTER (WHERE status >= 400) AS errors, COUNT(DISTINCT user_id) AS users, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95 "
            f"FROM activity_log WHERE {_since(60)} GROUP BY date_trunc('minute', created_at) ORDER BY date_trunc('minute', created_at)"),
        "online": store.execute(
            f"SELECT user_id, MAX(email) AS email, COUNT(*) AS requests, MAX(created_at) AS last_seen, arg_max(path, created_at) AS last_path, "
            f"COUNT(*) FILTER (WHERE status >= 400) AS errors FROM activity_log WHERE {_since(15)} AND user_id IS NOT NULL "
            f"GROUP BY user_id ORDER BY last_seen DESC LIMIT 50"),
        "stream": store.execute("SELECT created_at, email, method, path, status, ms, ip FROM activity_log ORDER BY created_at DESC LIMIT 40"),
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free},
        "host": resources.sample(),
    }


def traffic(hours: int = 24, start: str | None = None, end: str | None = None) -> dict:
    w, hours = window(start, end, max(1, min(int(hours), 24 * 366)))
    bucket = "hour" if hours <= 72 else "day"
    fmt = "%m-%d %H:00" if bucket == "hour" else "%Y-%m-%d"
    return {
        "hours": hours,
        "totals": _one(f"SELECT COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users, COUNT(DISTINCT ip) AS ips, "
                       f"COUNT(*) FILTER (WHERE status >= 500) AS err5, COUNT(*) FILTER (WHERE status BETWEEN 400 AND 499) AS err4, "
                       f"ROUND(AVG(ms), 1) AS avg_ms, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95 FROM activity_log WHERE {w}"),
        "series": store.execute(
            f"SELECT strftime(date_trunc('{bucket}', created_at), '{fmt}') AS time, COUNT(*) AS requests, COUNT(DISTINCT user_id) AS users, "
            f"COUNT(*) FILTER (WHERE status >= 400) AS errors, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95 FROM activity_log WHERE {w} "
            f"GROUP BY date_trunc('{bucket}', created_at) ORDER BY date_trunc('{bucket}', created_at)"),
        "status": store.execute(f"SELECT (status // 100) || 'xx' AS label, COUNT(*) AS n FROM activity_log WHERE {w} GROUP BY 1 ORDER BY 1"),
        "methods": store.execute(f"SELECT method AS label, COUNT(*) AS n FROM activity_log WHERE {w} GROUP BY 1 ORDER BY n DESC"),
        "areas": store.execute(f"SELECT {AREA} AS label, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users, ROUND(AVG(ms), 1) AS avg_ms "
                               f"FROM activity_log WHERE {w} GROUP BY 1 ORDER BY n DESC LIMIT 20"),
        "routes": store.execute(
            f"SELECT method, {ROUTE} AS route, COUNT(*) AS n, COUNT(*) FILTER (WHERE status >= 400) AS errors, "
            f"ROUND(AVG(ms), 1) AS avg_ms, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95, ROUND(MAX(ms), 1) AS max_ms "
            f"FROM activity_log WHERE {w} GROUP BY 1, 2 ORDER BY n DESC LIMIT 100"),
        "error_routes": store.execute(
            f"SELECT method, {ROUTE} AS route, status, COUNT(*) AS n, MAX(created_at) AS last_at FROM activity_log "
            f"WHERE {w} AND status >= 400 GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 30"),
        "slowest": store.execute(f"SELECT created_at, email, method, path, status, ms FROM activity_log WHERE {w} ORDER BY ms DESC LIMIT 20"),
        "ips": store.execute(f"SELECT ip, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users, MAX(email) AS email, "
                             f"COUNT(*) FILTER (WHERE status >= 400) AS errors, MAX(created_at) AS last_at FROM activity_log WHERE {w} "
                             f"GROUP BY ip ORDER BY n DESC LIMIT 30"),
        "devices": store.execute(f"SELECT {DEVICE} AS label, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM activity_log WHERE {w} GROUP BY 1 ORDER BY n DESC"),
        "browsers": store.execute(f"SELECT {BROWSER} AS label, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM activity_log WHERE {w} GROUP BY 1 ORDER BY n DESC"),
        "heatmap": store.execute(f"SELECT dayofweek(created_at) AS dow, hour(created_at) AS hour, COUNT(*) AS n FROM activity_log "
                                 f"WHERE {w if start or end else 'created_at > now() - INTERVAL 28 DAY'} GROUP BY 1, 2"),
    }
