"""AI chart suggestions: the model sees only column names, kinds and a few sample rows (never the whole result), plus what the
user wants to show, and picks the best elements from the chart types Dashtor has. Its answer is validated: unknown types are
dropped, reasons are trimmed, and an empty / broken reply returns [] so the rule-based suggestions stay."""
from __future__ import annotations

import json
from typing import Any

from . import ai as ai_svc
from .dash_ai import json_objects

TYPES = {
    "bar": "bars per category (ranked, grouped or stacked)", "line": "trend over time", "area": "trend with volume",
    "composed": "bars + line, two measures", "pie": "share of a total (<= 8 slices)", "treemap": "share with many items",
    "funnel": "stages", "scatter": "two numbers related", "histogram": "spread of one number", "kpi": "one headline number",
    "gauge": "one value against ranges", "progress": "value toward a goal", "waterfall": "what drove a change",
    "ranked": "top N vs previous (needs current + previous numbers)", "quadrant": "stars/rising/watch/laggards (current + previous)",
    "timebreak": "items by year/month (needs a date)", "pivot": "category x category with totals", "sankey": "flow from one category to another",
    "sunburst": "category and sub-category rings", "reconcile": "do 2-3 numbers agree per key", "table": "all rows",
}

SYSTEM = ("You recommend dashboard elements for a query result. Reply with ONLY JSON: "
          '{"suggestions": [{"type": one of ' + "|".join(TYPES) + ', "title": "2-4 words", "reason": "one short sentence for a business user"}]}. '
          "Give 3 suggestions, best first, that fit the columns and the user's goal. Use only these types: "
          + "; ".join(f"{k} = {v}" for k, v in TYPES.items()) + ".")


def suggest(columns: list[str], rows: list[dict[str, Any]], goal: str = "", provider_id: str | None = None) -> list[dict[str, str]]:
    sample = [{c: r.get(c) for c in columns} for r in rows[:8]]
    user = f"Columns: {', '.join(columns)}\nRows in the result: {len(rows)}\nSample rows: {json.dumps(sample, default=str)[:2500]}\n" \
           f"What the user wants to show: {goal.strip()[:300] or '(not said: pick what fits the data best)'}"
    try:
        raw = ai_svc.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], provider_id=provider_id, max_tokens=600)
    except ai_svc.AIError:
        raise
    except Exception:
        return []
    out: list[dict[str, str]] = []
    for obj in json_objects(raw):
        for s in obj.get("suggestions", []) if isinstance(obj.get("suggestions"), list) else []:
            t = str(s.get("type", "")).strip().lower()
            if t in TYPES and t not in {o["type"] for o in out}:
                out.append({"type": t, "title": str(s.get("title") or t)[:40], "reason": str(s.get("reason") or "")[:200]})
    return out[:3]
