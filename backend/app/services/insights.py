"""Deterministic insight detection on query results (§24).

Trend detection, anomaly detection (z-score), and top-contributor analysis.
No LLM involved — numbers only.
"""
from __future__ import annotations

import re
import statistics
from typing import Any

_IDENTIFIER = re.compile(r"(^|_)(id|uuid|key)$", re.IGNORECASE)


def detect_insights(rows: list[dict], columns: list[str]) -> list[dict[str, Any]]:
    if len(rows) < 3:
        return []
    insights: list[dict[str, Any]] = []

    # identifiers are numeric but meaningless to trend/outlier-test ("order_id 2.7σ above mean")
    all_numeric = [
        c for c in columns
        if sum(1 for r in rows if isinstance(r.get(c), (int, float))) >= len(rows) * 0.8
    ]
    numeric_cols = [c for c in all_numeric if not _IDENTIFIER.search(c)]
    # label from the type-based list so an id column never displaces e.g. the date column
    label_col = next((c for c in columns if c not in all_numeric), columns[0])
    # Trend is only meaningful when rows are ordered by time.
    temporal = any(
        t in label_col.lower() for t in ("date", "month", "year", "week", "day", "time", "quarter")
    )

    for col in numeric_cols[:2]:
        vals = [r[col] for r in rows if isinstance(r.get(col), (int, float))]
        if len(vals) < 3:
            continue

        # Trend: first half vs second half (only for time-ordered results)
        mid = len(vals) // 2
        first, second = sum(vals[:mid]), sum(vals[mid:])
        if temporal and first and abs((second - first) / first) > 0.15:
            pct = (second - first) / abs(first) * 100
            insights.append({
                "kind": "trend",
                "text": f"{col} {'↑' if pct > 0 else '↓'} {abs(pct):.0f}% "
                        f"(second half vs first half of the result)",
            })

        # Anomaly: z-score outliers
        if len(vals) >= 6:
            try:
                mean, stdev = statistics.mean(vals), statistics.stdev(vals)
            except statistics.StatisticsError:
                continue
            if stdev > 0:
                for i, v in enumerate(vals):
                    z = (v - mean) / stdev
                    if abs(z) >= 2.5:
                        label = rows[i].get(label_col, f"row {i}")
                        insights.append({
                            "kind": "anomaly",
                            "text": f"{label}: {col} = {v:,.2f} is {abs(z):.1f}σ "
                                    f"{'above' if z > 0 else 'below'} the mean ({mean:,.2f})",
                        })

        # Contribution: top row share of total
        total = sum(vals)
        if total and max(vals) / total > 0.4 and len(vals) >= 3:
            top_i = vals.index(max(vals))
            insights.append({
                "kind": "contribution",
                "text": f"{rows[top_i].get(label_col, 'top row')} accounts for "
                        f"{max(vals)/total*100:.0f}% of total {col}",
            })

    return insights[:5]
