"""Backoffice monitoring, per user and platform-wide: who uses what, how much, how well; growth, retention, adoption."""
from __future__ import annotations

from ...core.store import store
from .monitor import AREA, BROWSER, DEVICE, ROUTE, _one
from .users import _ws, owner_map

_CONTENT = ("datasources", "datasets", "dashboards", "charts", "queries", "alerts", "reports")


def _by_ws(table: str) -> dict[str, int]:
    return {r["w"]: r["n"] for r in store.execute(f"SELECT workspace_id AS w, COUNT(*) AS n FROM {table} GROUP BY 1")}


def users(days: int = 7) -> list[dict]:
    """One row per user seen in the window, with traffic, quality, AI and content numbers."""
    days = max(1, min(int(days), 365))
    rows = store.execute(
        f"SELECT user_id, MAX(email) AS email, COUNT(*) AS requests, COUNT(*) FILTER (WHERE status >= 400) AS errors, "
        f"ROUND(AVG(ms), 1) AS avg_ms, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95, COUNT(DISTINCT CAST(created_at AS DATE)) AS active_days, "
        f"COUNT(DISTINCT {AREA}) AS areas, COUNT(DISTINCT ip) AS ips, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen, "
        f"mode({DEVICE}) AS device, mode({BROWSER}) AS browser FROM activity_log "
        f"WHERE created_at > now() - INTERVAL {days} DAY AND user_id IS NOT NULL GROUP BY user_id ORDER BY requests DESC")
    ai = {r["w"]: r for r in store.execute(
        f"SELECT workspace_id AS w, COUNT(*) AS calls, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens FROM ai_usage "
        f"WHERE created_at > now() - INTERVAL {days} DAY GROUP BY 1")}
    counts = {t: _by_ws(t) for t in ("datasets", "dashboards", "charts")}
    for r in rows:
        ws = _ws(r["user_id"])
        r["ai_calls"], r["ai_tokens"] = ai.get(ws, {}).get("calls", 0), ai.get(ws, {}).get("tokens", 0)
        for t, m in counts.items():
            r[t] = m.get(ws, 0)
        r["error_rate"] = round(100 * r["errors"] / r["requests"], 1) if r["requests"] else 0
    return rows


def user(user_id: str, days: int = 30) -> dict:
    days = max(1, min(int(days), 365))
    w, p, ws = f"user_id = ? AND created_at > now() - INTERVAL {days} DAY", [user_id], _ws(user_id)
    return {
        "user_id": user_id, "days": days,
        "totals": _one(f"SELECT MAX(email) AS email, COUNT(*) AS requests, COUNT(*) FILTER (WHERE status >= 400) AS errors, "
                       f"ROUND(AVG(ms), 1) AS avg_ms, ROUND(QUANTILE_CONT(ms, 0.95), 1) AS p95, COUNT(DISTINCT CAST(created_at AS DATE)) AS active_days, "
                       f"MIN(created_at) AS first_seen, MAX(created_at) AS last_seen FROM activity_log WHERE {w}", p),
        "daily": store.execute(f"SELECT strftime(created_at, '%Y-%m-%d') AS day, COUNT(*) AS requests, COUNT(*) FILTER (WHERE status >= 400) AS errors "
                               f"FROM activity_log WHERE {w} GROUP BY 1 ORDER BY 1", p),
        "hours": store.execute(f"SELECT hour(created_at) AS hour, COUNT(*) AS n FROM activity_log WHERE {w} GROUP BY 1 ORDER BY 1", p),
        "areas": store.execute(f"SELECT {AREA} AS label, COUNT(*) AS n FROM activity_log WHERE {w} GROUP BY 1 ORDER BY n DESC", p),
        "routes": store.execute(f"SELECT method, {ROUTE} AS route, COUNT(*) AS n, COUNT(*) FILTER (WHERE status >= 400) AS errors, "
                                f"ROUND(AVG(ms), 1) AS avg_ms FROM activity_log WHERE {w} GROUP BY 1, 2 ORDER BY n DESC LIMIT 25", p),
        "ips": store.execute(f"SELECT ip, COUNT(*) AS n, MIN(created_at) AS first_at, MAX(created_at) AS last_at, {BROWSER} AS browser, "
                             f"{DEVICE} AS device FROM activity_log WHERE {w} GROUP BY ip, 5, 6 ORDER BY n DESC LIMIT 20", p),
        "sessions": store.execute(  # a new session starts after 30 idle minutes
            f"WITH s AS (SELECT created_at, CASE WHEN created_at - lag(created_at) OVER (ORDER BY created_at) > INTERVAL 30 MINUTE "
            f"OR lag(created_at) OVER (ORDER BY created_at) IS NULL THEN 1 ELSE 0 END AS new FROM activity_log WHERE {w}), "
            f"g AS (SELECT created_at, SUM(new) OVER (ORDER BY created_at) AS sid FROM s) "
            f"SELECT sid, MIN(created_at) AS start, MAX(created_at) AS \"end\", COUNT(*) AS requests, "
            f"ROUND(epoch(MAX(created_at) - MIN(created_at)) / 60, 1) AS minutes FROM g GROUP BY sid ORDER BY start DESC LIMIT 30", p),
        "errors": store.execute(f"SELECT created_at, method, path, status, ms FROM activity_log WHERE {w} AND status >= 400 "
                                f"ORDER BY created_at DESC LIMIT 50", p),
        "recent": store.execute(f"SELECT created_at, method, path, status, ms, ip FROM activity_log WHERE {w} ORDER BY created_at DESC LIMIT 100", p),
        "ai": store.execute(f"SELECT feature, model, COUNT(*) AS calls, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens, "
                            f"COUNT(*) FILTER (WHERE NOT ok) AS errors, ROUND(AVG(ms)) AS avg_ms FROM ai_usage "
                            f"WHERE workspace_id = ? AND created_at > now() - INTERVAL {days} DAY GROUP BY 1, 2 ORDER BY calls DESC", [ws]),
        "content": {t: _one(f"SELECT COUNT(*) AS n FROM {t} WHERE workspace_id = ?", [ws]).get("n", 0) for t in _CONTENT},
    }


def platform(days: int = 30) -> dict:
    """Growth and positioning: DAU/WAU/MAU, new vs returning users, retention, feature adoption, content growth."""
    days = max(7, min(int(days), 365))
    owners = owner_map()
    first = "(SELECT user_id, MIN(CAST(created_at AS DATE)) AS d0 FROM activity_log WHERE user_id IS NOT NULL GROUP BY 1)"
    total_users = _one("SELECT COUNT(DISTINCT user_id) AS n FROM activity_log WHERE user_id IS NOT NULL").get("n", 0)
    return {
        "days": days,
        "engagement": _one(
            "SELECT COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - INTERVAL 1 DAY) AS dau, "
            "COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - INTERVAL 7 DAY) AS wau, "
            "COUNT(DISTINCT user_id) FILTER (WHERE created_at > now() - INTERVAL 30 DAY) AS mau FROM activity_log WHERE user_id IS NOT NULL")
        | {"total_users": total_users},
        "growth": store.execute(
            f"WITH days AS (SELECT CAST(d AS DATE) AS day FROM range(current_date - INTERVAL {days} DAY, current_date + INTERVAL 1 DAY, INTERVAL 1 DAY) t(d)), "
            f"act AS (SELECT CAST(created_at AS DATE) AS day, COUNT(DISTINCT user_id) AS active FROM activity_log WHERE user_id IS NOT NULL GROUP BY 1), "
            f"new AS (SELECT d0 AS day, COUNT(*) AS new_users FROM {first} GROUP BY 1) "
            f"SELECT strftime(days.day, '%Y-%m-%d') AS day, COALESCE(active, 0) AS active, COALESCE(new_users, 0) AS new_users, "
            f"(SELECT COUNT(*) FROM {first} f WHERE f.d0 <= days.day) AS total "
            f"FROM days LEFT JOIN act USING (day) LEFT JOIN new USING (day) ORDER BY days.day"),
        "retention": store.execute(  # weekly cohorts: share of each signup week still active N weeks later
            f"WITH f AS (SELECT user_id, date_trunc('week', d0) AS cohort FROM {first}), "
            f"a AS (SELECT DISTINCT user_id, date_trunc('week', created_at) AS wk FROM activity_log WHERE user_id IS NOT NULL) "
            f"SELECT strftime(cohort, '%Y-%m-%d') AS cohort, CAST(date_diff('week', cohort, wk) AS INTEGER) AS week, COUNT(DISTINCT a.user_id) AS users "
            f"FROM f JOIN a USING (user_id) WHERE cohort > now() - INTERVAL 10 WEEK GROUP BY 1, 2 ORDER BY 1, 2"),
        "adoption": store.execute(
            f"SELECT {AREA} AS label, COUNT(DISTINCT user_id) AS users, COUNT(*) AS requests, "
            f"ROUND(100.0 * COUNT(DISTINCT user_id) / NULLIF((SELECT COUNT(DISTINCT user_id) FROM activity_log "
            f"WHERE created_at > now() - INTERVAL {days} DAY), 0), 1) AS pct FROM activity_log "
            f"WHERE created_at > now() - INTERVAL {days} DAY AND user_id IS NOT NULL GROUP BY 1 ORDER BY users DESC LIMIT 25"),
        "ai_features": store.execute(
            f"SELECT feature AS label, COUNT(*) AS n, COUNT(DISTINCT workspace_id) AS users, COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens "
            f"FROM ai_usage WHERE created_at > now() - INTERVAL {days} DAY GROUP BY 1 ORDER BY n DESC"),
        "content": {t: _one(f"SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > now() - INTERVAL {days} DAY) AS recent, "
                            f"COUNT(DISTINCT workspace_id) AS workspaces FROM {t}") for t in _CONTENT},
        "content_daily": store.execute(
            " UNION ALL ".join(f"SELECT '{t}' AS kind, strftime(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n FROM {t} "
                               f"WHERE created_at > now() - INTERVAL {days} DAY GROUP BY 2" for t in ("datasets", "dashboards", "charts"))),
        "leaders": [r | {"owner": owners.get(r["w"], r["w"])} for r in store.execute(
            "SELECT workspace_id AS w, COUNT(*) AS n FROM datasets GROUP BY 1 ORDER BY n DESC LIMIT 10")],
    }
