"""Data-quality scoring: completeness, uniqueness, duplicate rate, freshness."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .engine import engine
from ..core.store import store


def run_quality_check(dataset: dict[str, Any]) -> dict[str, Any]:
    table = dataset["physical_name"]
    schema = engine.describe_table(table)
    n = schema["row_count"]

    with engine.connect(read_only=True) as con:
        total, distinct_n = con.execute(
            f"WITH s AS (SELECT * FROM {table} LIMIT 100000) "
            f"SELECT (SELECT COUNT(*) FROM s), "
            f"(SELECT COUNT(*) FROM (SELECT DISTINCT * FROM s) d)"
        ).fetchone() if n else (0, 0)
        dup_rows = total - distinct_n

    # completeness: fraction of non-null cells (weighted over first 50 cols)
    cols = schema["columns"]
    completeness = (
        round(sum(100 - c["null_pct"] for c in cols) / len(cols), 1) if cols else 100.0
    )
    duplicate_pct = round(dup_rows / total * 100, 2) if total else 0
    uniqueness = round(100 - duplicate_pct, 1)
    validity = _validity_heuristic(cols)

    created = dataset.get("created_at")
    freshness = _freshness(created)

    run = store.insert("quality_runs", {
        "dataset_id": dataset["id"],
        "completeness": completeness,
        "uniqueness": uniqueness,
        "validity": validity,
        "freshness": freshness,
        "row_count": n,
        "duplicate_pct": duplicate_pct,
        "details": {
            "columns": [
                {"name": c["name"], "null_pct": c["null_pct"], "distinct": c["distinct_count"]}
                for c in cols
            ]
        },
    })
    return run


def _validity_heuristic(cols: list[dict]) -> float:
    """Crude validity proxy: numeric/date columns with at least one distinct value."""
    if not cols:
        return 100.0
    ok = sum(1 for c in cols if c["distinct_count"] > 0)
    return round(ok / len(cols) * 100, 1)


def _freshness(created_at) -> str:
    if not created_at:
        return "unknown"
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    age = datetime.now(timezone.utc) - (
        created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    )
    mins = age.total_seconds() / 60
    if mins < 1:  # clock skew / tz conversion artifacts
        return "just now"
    if mins < 60:
        return f"{int(mins)} min ago"
    if mins < 60 * 24:
        return f"{mins/60:.1f} hours ago"
    return f"{mins/60/24:.1f} days ago"
