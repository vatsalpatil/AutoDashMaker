"""The "Why?" engine — change attribution (§66–67).

Compares a metric between two periods and breaks the change down by every
categorical dimension, ranking the largest contributors. Language is
deliberately non-causal: "associated with", "largest observed contributor".
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from .engine import engine


def _numeric(s: str) -> bool:
    return any(t in s.upper() for t in ("INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL", "HUGEINT"))


def _temporal(s: str) -> bool:
    return any(t in s.upper() for t in ("DATE", "TIME"))


def why_changed(dataset: dict[str, Any], date_column: str, metric_column: str,
                days: int = 30, agg: str = "SUM") -> dict[str, Any]:
    table = dataset["physical_name"]
    schema = engine.describe_table(table)
    cols = {c["name"]: c for c in schema["columns"]}

    if date_column not in cols or not _temporal(cols[date_column]["dtype"]):
        raise ValueError(f"'{date_column}' is not a date/timestamp column")
    if metric_column not in cols or not _numeric(cols[metric_column]["dtype"]):
        raise ValueError(f"'{metric_column}' is not a numeric column")

    dims = [c["name"] for c in schema["columns"]
            if c["name"] not in (date_column, metric_column)
            and not _numeric(c["dtype"]) and not _temporal(c["dtype"])
            and 1 < c["distinct_count"] <= 50]

    with engine.connect(read_only=True) as con:
        max_date = con.execute(f'SELECT MAX("{date_column}") FROM {table}').fetchone()[0]
    if max_date is None:
        raise ValueError("no data")
    if hasattr(max_date, "date"):
        max_date = max_date.date()
    elif isinstance(max_date, str):
        max_date = date.fromisoformat(max_date[:10])
    cur_start = max_date - timedelta(days=days - 1)
    prev_start = cur_start - timedelta(days=days)

    def period_sql(where: str) -> str:
        return (f'SELECT {agg}("{metric_column}") FROM {table} '
                f'WHERE "{date_column}" BETWEEN \'{prev_start}\' AND \'{max_date}\' AND {where}')

    with engine.connect(read_only=True) as con:
        total = con.execute(
            f'SELECT {agg}("{metric_column}") FROM {table} '
            f'WHERE "{date_column}" BETWEEN \'{cur_start}\' AND \'{max_date}\''
        ).fetchone()[0] or 0
        previous = con.execute(
            f'SELECT {agg}("{metric_column}") FROM {table} '
            f'WHERE "{date_column}" BETWEEN \'{prev_start}\' AND \'{cur_start - timedelta(days=1)}\''
        ).fetchone()[0] or 0

        breakdowns = []
        for dim in dims:
            rows = con.execute(f"""
                WITH cur AS (
                    SELECT "{dim}" AS k, {agg}("{metric_column}") AS v FROM {table}
                    WHERE "{date_column}" BETWEEN '{cur_start}' AND '{max_date}' GROUP BY 1
                ), prev AS (
                    SELECT "{dim}" AS k, {agg}("{metric_column}") AS v FROM {table}
                    WHERE "{date_column}" BETWEEN '{prev_start}' AND '{cur_start - timedelta(days=1)}' GROUP BY 1
                )
                SELECT COALESCE(c.k, p.k) AS value,
                       COALESCE(c.v, 0) AS current_val, COALESCE(p.v, 0) AS previous_val,
                       COALESCE(c.v, 0) - COALESCE(p.v, 0) AS delta
                FROM cur c FULL OUTER JOIN prev p ON c.k = p.k
                ORDER BY ABS(delta) DESC LIMIT 5
            """).fetchall()
            total_delta = sum(abs(r[3]) for r in rows) or 1
            breakdowns.append({
                "dimension": dim,
                "contributors": [
                    {"value": r[0], "current": round(r[1], 2), "previous": round(r[2], 2),
                     "delta": round(r[3], 2), "share_pct": round(abs(r[3]) / total_delta * 100, 1)}
                    for r in rows
                ],
            })

    delta = total - previous
    pct = (delta / abs(previous) * 100) if previous else None
    top = None
    if breakdowns and breakdowns[0]["contributors"]:
        c = breakdowns[0]["contributors"][0]
        top = (f"Largest observed contributor: {breakdowns[0]['dimension']} = "
               f"'{c['value']}' (Δ {c['delta']:+,.2f}, associated with "
               f"{c['share_pct']:.0f}% of the movement in that dimension)")

    return {
        "metric": f"{agg}({metric_column})",
        "period": {"current": f"{cur_start} → {max_date}", "previous": f"{prev_start} → {cur_start - timedelta(days=1)}"},
        "current": round(total, 2),
        "previous": round(previous, 2),
        "delta": round(delta, 2),
        "delta_pct": round(pct, 1) if pct is not None else None,
        "direction": "up" if delta > 0 else "down" if delta < 0 else "flat",
        "headline": top,
        "breakdowns": breakdowns,
        "caveat": "These are observed associations, not proven causation.",
    }
