"""Plain-English description of a query-builder spec (deterministic, no model): what the AI built, or what a hand-built query does."""
from __future__ import annotations

from .qb_ops import AGGS

_OP = {"=": "is", "ieq": "is", "!=": "is not", ">": "is greater than", ">=": "is at least", "<": "is less than", "<=": "is at most", "between": "is between",
       "in": "is one of", "not_in": "is none of", "contains": "contains", "not_contains": "does not contain", "starts_with": "starts with",
       "ends_with": "ends with", "is_null": "is empty", "not_null": "is not empty", "is_empty": "is blank", "not_empty": "is not blank",
       "last_n_days": "is in the last N days", "this_month": "is this month", "this_year": "is this year", "this_week": "is this week",
       "today": "is today", "regex": "matches", "expr": "satisfies"}
_AGG = {"count": "the number of rows", "count_distinct": "the number of distinct", "sum": "the total of", "avg": "the average of", "min": "the lowest",
        "max": "the highest", "median": "the median of", "stddev": "the standard deviation of"}


def _n(ref) -> str:
    return ref["c"] if isinstance(ref, dict) else str(ref)


def _cond(f: dict) -> str:
    op = f.get("op")
    v = f.get("value")
    tail = "" if op in ("is_null", "not_null", "is_empty", "not_empty", "today", "this_week", "this_month", "this_year") else f" {v}" + (f" and {f.get('value2')}" if op == "between" else "")
    return f"{_n(f.get('col'))} {_OP.get(op, op)}{tail}".strip()


def describe_stage(st: dict, first: bool) -> list[str]:
    out: list[str] = []
    if first and st.get("table"):
        out.append(f"Start from **{st['table']}**")
    for j in st.get("joins") or []:
        on = ", ".join(f"{_n(k['left'])} = {_n(k['right'])}" for k in j.get("on") or [])
        out.append(f"Join **{j.get('table')}** ({j.get('type', 'left')} join" + (f" on {on}" if on else "") + ")")
    for c in st.get("custom") or []:
        out.append(f"Add column **{c.get('name')}** = `{c.get('expr')}`")
    if st.get("filters"):
        glue = " or " if st.get("filter_mode") == "or" else " and "
        out.append("Keep rows where " + glue.join(_cond(f) for f in st["filters"]))
    aggs, brks = st.get("aggregations") or [], st.get("breakouts") or []
    if aggs or brks:
        parts = []
        for a in aggs:
            what = _AGG.get(a.get("fn"), a.get("fn", "").replace("_", " "))
            col = f" {_n(a['col'])}" if a.get("col") and a.get("fn") != "count" else ""
            cond = f" (only where {' and '.join(_cond(w) for w in a['where'])})" if a.get("where") else ""
            parts.append(f"{what}{col}{cond}")
        by = ", ".join(_n(b["col"]) + (f" by {b['bucket']}" if b.get("bucket") not in (None, "none") else "") for b in brks)
        out.append("Summarize: " + (", ".join(parts) or "rows") + (f" for each {by}" if by else ""))
    if st.get("having"):
        out.append("Keep only summary rows where " + " and ".join(_cond(f) for f in st["having"]))
    for w in st.get("windows") or []:
        out.append(f"Calculate **{w.get('as') or w.get('fn')}** ({str(w.get('fn')).replace('_', ' ')}" + (f" of {_n(w['col'])}" if w.get("col") else "") + (f", ordered by {_n(w['order'])}" if w.get("order") else "") + ")")
    if st.get("columns"):
        out.append("Show only: " + ", ".join(_n(c) for c in st["columns"]))
    if st.get("distinct"):
        out.append("Remove duplicate rows")
    if st.get("sort"):
        out.append("Sort by " + ", ".join(f"{_n(s['col'])} {'high to low' if s.get('dir') == 'desc' else 'low to high'}" for s in st["sort"]))
    if st.get("limit"):
        out.append(f"Return the first {st['limit']:,} rows")
    return out


def describe_spec(spec: dict) -> list[str]:
    """One line per step, stages labelled 'Then' after the first."""
    lines: list[str] = []
    for i, st in enumerate(spec.get("stages") or []):
        steps = describe_stage(st, i == 0)
        if i > 0 and steps:
            steps[0] = "Then, using those results: " + steps[0][0].lower() + steps[0][1:]
        lines += steps
    return lines


assert "count" in AGGS  # keep descriptions in step with the compiler's aggregate names
