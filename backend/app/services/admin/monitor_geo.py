"""Backoffice monitoring by visitor location (country / region / city from Cloudflare headers, see activity.py)."""
from __future__ import annotations

from ...core.store import store
from .monitor import _one, window

_WHO = "COUNT(DISTINCT user_id) AS users, COUNT(*) AS requests, COUNT(DISTINCT ip) AS ips, MAX(created_at) AS last_at"


def locations(hours: int = 24 * 30, start: str | None = None, end: str | None = None) -> dict:
    w, hours = window(start, end, max(1, min(int(hours), 24 * 366)))
    located = f"{w} AND country IS NOT NULL"
    return {
        "hours": hours,
        "totals": _one(f"SELECT COUNT(DISTINCT country) AS countries, COUNT(DISTINCT city) AS cities, "
                       f"COUNT(*) FILTER (WHERE country IS NOT NULL) AS located, COUNT(*) AS requests FROM activity_log WHERE {w}"),
        "countries": store.execute(f"SELECT country, {_WHO}, COUNT(*) FILTER (WHERE status >= 400) AS errors, ROUND(AVG(ms), 1) AS avg_ms "
                                   f"FROM activity_log WHERE {located} GROUP BY 1 ORDER BY users DESC, requests DESC"),
        "cities": store.execute(f"SELECT country, region, city, {_WHO} FROM activity_log WHERE {located} AND city IS NOT NULL "
                                f"GROUP BY 1, 2, 3 ORDER BY users DESC, requests DESC LIMIT 100"),
        "users": store.execute(
            f"SELECT user_id, MAX(email) AS email, mode(country) AS country, mode(city) AS city, mode(region) AS region, "
            f"COUNT(DISTINCT country) AS countries, string_agg(DISTINCT country, ', ') AS seen_in, COUNT(*) AS requests, "
            f"MAX(created_at) AS last_at FROM activity_log WHERE {located} AND user_id IS NOT NULL GROUP BY 1 ORDER BY last_at DESC LIMIT 500"),
        "daily": store.execute(f"SELECT strftime(created_at, '%Y-%m-%d') AS day, country, COUNT(DISTINCT user_id) AS users FROM activity_log "
                               f"WHERE {located} GROUP BY 1, 2 ORDER BY 1"),
    }
