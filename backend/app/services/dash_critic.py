"""Self-review for AI-built widgets and dashboards (the "critic" in the plan → build → check → fix loop).

Each widget is checked against its real result: an empty or all-blank result goes back to the model once with the problem
spelled out; a chart type that does not fit the data's shape (a 40-slice pie, a one-point line, a KPI with many rows) is
re-typed deterministically. The whole dashboard is then checked (duplicates dropped, headline KPIs, a trend when there is
time data) and given a score with a readable checklist, so the user sees what was verified and what was corrected.
"""
from __future__ import annotations

import re
from typing import Any

from . import ai as ai_svc
from .chart_suggest import column_roles, encode

SLICED = {"pie", "funnel", "treemap"}
NO_MEASURE_OK = {"table", "pivot", "timebreak"}


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _retype(rows: list[dict], cols: list[str], ctype: str) -> tuple[str | None, str]:
    """(better chart type or None, why) for a result whose shape does not suit `ctype`."""
    roles, n = column_roles(cols, rows), len(rows)
    measures, dims = roles["measure"], roles["time"] + roles["category"]
    if ctype not in NO_MEASURE_OK and not measures:
        return "table", "no numeric column to plot, shown as a table"
    if ctype == "kpi" and (n > 1 or len(cols) > 1 and not measures):
        if roles["time"] and n > 1:
            return "line", f"a KPI needs one value but the query returned {n} rows over time, shown as a trend"
        return ("bar" if n <= 30 else "table"), f"a KPI needs one value but the query returned {n} rows"
    if ctype in SLICED and n > 8:
        return "bar", f"{n} slices are unreadable in a {ctype}, shown as a bar chart"
    if ctype == "pie" and any(_num(r.get(m)) and r[m] < 0 for r in rows for m in measures):
        return "bar", "a pie cannot show negative values"
    if ctype in ("line", "area") and n < 2:
        return ("kpi" if n == 1 and len(measures) == 1 else "bar"), "a trend needs at least two points"
    if ctype in ("bar", "line", "area") and n == 1 and len(measures) == 1 and not dims:
        return "kpi", "a single value reads best as a KPI"
    if ctype == "bar" and n > 50:
        return "table", f"{n} bars are unreadable, shown as a table"
    if ctype == "scatter" and (len(measures) < 2 or n < 3):
        return "bar" if dims else "table", "a scatter needs two numeric columns and several points"
    return None, ""


def _blank(rows: list[dict], cols: list[str]) -> str | None:
    """Why a result is useless to show, or None."""
    if not rows:
        return "the query returned no rows"
    if all(r.get(c) in (None, "") for r in rows for c in cols):
        return "every value in the result is empty"
    measures = column_roles(cols, rows)["measure"]
    if measures and all((r.get(m) in (None, 0)) for r in rows for m in measures):
        return "every number in the result is zero or empty"
    return None


def _rewrite(spec: dict[str, Any], problem: str, context: str, provider_id: str | None) -> dict[str, Any] | None:
    """Ask the model once for a corrected widget, telling it exactly what was wrong with the last attempt."""
    from .dash_ai import CHART_TYPES, json_objects   # lazy: dash_ai imports this module
    system = ("You fix one dashboard widget. Reply with ONLY JSON: {\"title\": string, \"type\": one of " + "|".join(CHART_TYPES)
              + ", \"sql\": one read-only DuckDB SELECT}. Keep the widget's intent. Use ONLY the listed tables and columns. "
              "Check filters, joins and date conditions against the real values in the context: a filter that matches nothing is the usual cause.")
    user = f"{context}\n\nWidget \"{spec.get('title')}\" ({spec.get('type')}) with SQL:\n{spec.get('sql')}\n\nProblem: {problem}. Give a corrected widget."
    try:
        text = ai_svc.chat([{"role": "system", "content": system}, {"role": "user", "content": user}], provider_id=provider_id, max_tokens=3000, timeout=120)
    except Exception:
        return None
    found = [o for o in json_objects(text) if o.get("sql")]
    return found[-1] if found else None


def polish(spec: dict[str, Any], w: dict[str, Any], context: str, provider_id: str | None) -> dict[str, Any]:
    """The built widget after self-review; w["notes"] lists what was corrected. Raises ValueError if it is still useless."""
    from .dash_ai import _materialize   # lazy: circular
    notes: list[str] = []
    problem = _blank(w["all_rows"], w["columns"])
    if problem:
        fixed_spec = _rewrite({**spec, "sql": w["sql"]}, problem, context, provider_id)
        try:
            fixed = _materialize(fixed_spec, context, provider_id, review=False) if fixed_spec else None
        except ValueError:
            fixed = None
        if not fixed or _blank(fixed["all_rows"], fixed["columns"]):
            raise ValueError(f"{problem} (and the AI's corrected query did not help)")
        w, notes = fixed, [f"rewrote the query: {problem}"]
    better, why = _retype(w["all_rows"], w["columns"], w["chart"]["type"])
    if better:
        w["chart"] = {"type": better, "encoding": encode(better, w["columns"], w["all_rows"]),
                      "options": {"numberFormat": "compact"} if better == "kpi" else {}}
        notes.append(f"changed to {better}: {why}")
    w["notes"] = notes
    return w


def _norm_sql(sql: str) -> str:
    return re.sub(r"\s+", " ", sql or "").strip().rstrip(";").lower()


def review_dashboard(built: list[dict[str, Any]], skipped: list[dict[str, str]], has_time: bool) -> dict[str, Any]:
    """Drop duplicate widgets and score the dashboard: {"kept", "dropped", "score", "checks": [{label, ok, detail}]}."""
    kept, dropped, seen_sql, seen_title = [], [], set(), set()
    for w in built:
        key, title = _norm_sql(w["sql"]), w["title"].strip().lower()
        if key in seen_sql or title in seen_title:
            dropped.append(w["title"])
            continue
        seen_sql.add(key)
        seen_title.add(title)
        kept.append(w)
    types = [w["chart"]["type"] for w in kept]
    fixed = sum(1 for w in kept if w.get("notes") or w.get("fixed"))
    checks = [
        {"label": "Every planned widget was built", "ok": not skipped,
         "detail": f"{len(skipped)} could not be built" if skipped else f"{len(kept)} widgets"},
        {"label": "Every query returns real data", "ok": not any("empty" in s["reason"] or "no rows" in s["reason"] for s in skipped),
         "detail": "empty results were rewritten by the AI or left out"},
        {"label": "Chart types fit the data", "ok": True,
         "detail": f"{fixed} widget(s) corrected automatically" if fixed else "no corrections needed"},
        {"label": "No duplicate widgets", "ok": not dropped, "detail": f"removed {', '.join(dropped)}" if dropped else "all distinct"},
        {"label": "Headline KPIs", "ok": "kpi" in types, "detail": f"{types.count('kpi')} KPI(s)" if "kpi" in types else "no KPI: consider adding totals"},
    ]
    if has_time:
        trend = any(t in ("line", "area", "composed") for t in types)
        checks.append({"label": "Trend over time", "ok": trend, "detail": "included" if trend else "the data has dates but no trend chart"})
    variety = len(set(types)) >= min(3, len(kept))
    checks.append({"label": "Varied visuals", "ok": variety, "detail": f"{len(set(types))} chart types"})
    score = round(100 * sum(c["ok"] for c in checks) / len(checks))
    return {"kept": kept, "dropped": dropped, "score": score, "checks": checks}


def has_time(built: list[dict[str, Any]], context: str) -> bool:
    return "[time]" in context or any(column_roles(w["columns"], w["all_rows"])["time"] for w in built)
