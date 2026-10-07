"""Instant, no-model understanding of the simple requests people type most ("total revenue by category", "top 5 stores by profit",
"orders per month"), plus a safety net that re-applies obvious intent ("top N", "by month") when a model forgets it.

`quick_spec` returns None unless it is confident; anything with filters, comparisons, growth, joins ... goes to the AI instead.
"""
from __future__ import annotations

import re

from ..core.store import store

_COMPLEX = re.compile(r"\b(where|only|excluding|except|without|between|greater|less|more than|fewer|over|under|above|below|compare|versus|vs|ratio|percent|%|growth|"
                      r"change|running|cumulative|rank|previous|last \d+|since|before|after|join|each other|correlat|trend line|forecast|which|who|why|not)\b")
_VERBS = [("median", r"median"), ("count_distinct", r"(?:distinct|unique) (?:count of |number of )?"), ("avg", r"average|avg|mean"), ("max", r"maximum|max|highest|largest|biggest|best"),
          ("min", r"minimum|min|lowest|smallest|worst"), ("sum", r"total|sum of|sum|overall"), ("count", r"count of|count|number of|how many|# of")]
_LABEL = {"sum": "Total", "avg": "Average", "max": "Highest", "min": "Lowest", "median": "Median", "count_distinct": "Distinct"}
_BUCKETS = {"year": "year", "yearly": "year", "annual": "year", "quarter": "quarter", "quarterly": "quarter", "month": "month", "monthly": "month",
            "week": "week", "weekly": "week", "day": "day", "daily": "day", "hour": "hour", "hourly": "hour"}
_BY = re.compile(r"\b(?:by|per|for each|for every|grouped by|broken down by|across|each)\b")


def _norm(s: str) -> str:
    return re.sub(r"[_\s]+", " ", s.lower()).strip()


def _variants(name: str) -> list[str]:
    n = _norm(name)
    return list({n, n + "s", n + "es", n[:-1] if n.endswith("s") else n})


def _kind(dtype: str) -> str:
    d = (dtype or "").lower()
    return "time" if re.search(r"date|time", d) else "num" if re.search(r"int|float|double|decimal|numeric|real|number", d) else "text"


def _schema() -> list[dict]:
    cols: dict[str, list[dict]] = {}
    for c in store.list("columns_meta", order=None):
        cols.setdefault(c["dataset_id"], []).append({"name": c["name"], "kind": _kind(c.get("dtype"))})
    return [{"name": d["name"], "cols": cols.get(d["id"], [])} for d in store.list("datasets", order=None) if d.get("physical_name")]


def _find(text: str, cols: list[dict]) -> list[tuple[int, dict]]:
    """Columns mentioned in text with their positions (longest names first so 'unit price' wins over 'price')."""
    taken: list[tuple[int, int]] = []
    out: list[tuple[int, dict]] = []
    for c in sorted(cols, key=lambda c: -len(c["name"])):
        for v in _variants(c["name"]):
            m = re.search(rf"(?<![a-z0-9]){re.escape(v)}(?![a-z0-9])", text)
            if m and not any(a < m.end() and m.start() < b for a, b in taken):
                taken.append((m.start(), m.end()))
                out.append((m.start(), c))
                break
    return sorted(out, key=lambda x: x[0])


def hints(prompt: str, spec: dict) -> dict:
    """Re-apply obvious intent a model may have dropped: 'top/bottom N' on a summary, a time bucket for 'by month'."""
    p = prompt.lower()
    st = spec["stages"][-1]
    summarized = bool(st.get("aggregations") or st.get("breakouts"))
    m = re.search(r"\b(top|bottom|first|best|worst|highest|lowest)\s+(\d{1,3})\b", p)
    if m and summarized:
        asc = m.group(1) in ("bottom", "worst", "lowest")
        if not st.get("limit") or st["limit"] > int(m.group(2)):
            st["limit"] = int(m.group(2))
        first = next(iter(st.get("aggregations") or []), None)
        if first and not st.get("sort"):
            name = first.get("as") or ("count" if first.get("fn") == "count" else f"{first.get('fn')} of {first['col']['c'] if isinstance(first.get('col'), dict) else first.get('col')}")
            st["sort"] = [{"col": name, "dir": "asc" if asc else "desc"}]
    word = next((_BUCKETS[w] for w in re.findall(r"[a-z]+", p) if w in _BUCKETS), None)
    if word and st.get("breakouts"):
        first = (spec["stages"][0].get("table") or "")
        kinds = {c["name"]: c["kind"] for t in _schema() if t["name"] == first for c in t["cols"]}
        for br in st["breakouts"]:
            name = br["col"]["c"] if isinstance(br.get("col"), dict) else br.get("col")
            if br.get("bucket") in (None, "none") and kinds.get(name) == "time" and len(spec["stages"]) == 1:
                br["bucket"] = word
    return spec


def quick_spec(prompt: str) -> dict | None:
    p = " " + _norm(re.sub(r"[?!.,]", " ", prompt)) + " "
    if _COMPLEX.search(p.replace("top", "").replace("bottom", "")) and not re.search(r"\b(top|bottom) \d", p):
        return None
    schema = _schema()
    if not schema:
        return None
    named = [t for t in schema if re.search(rf"(?<![a-z0-9]){re.escape(_norm(t['name']))}(?![a-z0-9])", p)]
    table = named[0] if named else max(schema, key=lambda t: len(_find(p, t["cols"])))
    cols = table["cols"]
    split = _BY.search(p)
    left, right = (p[:split.start()], p[split.end():]) if split else (p, "")
    mets = _find(left, cols)
    dims = _find(right, cols)
    if not mets and not dims and not re.search(r"\b(count|how many|number of)\b", left):
        return None

    swapped = bool(mets) and not any(c["kind"] == "num" for _, c in mets) and any(c["kind"] == "num" for _, c in dims)
    if swapped:                              # "top 5 stores by profit": the thing after 'by' is the measure
        mets, dims = dims, mets
    src = right if swapped else left

    def verb_at(pos: int) -> str:
        best, best_pos = "sum", -1
        for key, rx in _VERBS:
            for m in re.finditer(rf"\b(?:{rx})\b", src):
                if m.start() < pos and m.start() > best_pos:
                    best, best_pos = key, m.start()
        return best
    aggs, brks, time_hint = [], [], next((_BUCKETS[w] for w in re.findall(r"[a-z]+", right or left) if w in _BUCKETS), None)
    for pos, c in mets:
        if c["kind"] == "num" or verb_at(pos) in ("count", "count_distinct"):
            v = verb_at(pos)
            fn = "count_distinct" if v == "count_distinct" else "count_col" if v == "count" else v
            aggs.append({"fn": fn, "col": c["name"], "as": f"{_LABEL.get(v, 'Count of')} {c['name']}"})
        elif c["kind"] in ("text", "time") and not split:
            dims.append((pos, c))          # "revenue category" -> treat a non-numeric mention as the grouping
    if not aggs:
        if re.search(r"\b(count|how many|number of|orders|rows|records)\b", left):
            aggs.append({"fn": "count", "as": "Count"})
        else:
            return None
    dims = [(p_, c) for p_, c in dims if c["kind"] != "num"]
    dims = [(p_, c) for p_, c in dims if c["kind"] != "num"]
    for _, c in dims:
        b = {"as": c["name"], "col": c["name"]}
        if c["kind"] == "time":
            b["bucket"] = time_hint or "month"
        brks.append(b)
    if not brks and time_hint:
        t = next((c for c in cols if c["kind"] == "time"), None)
        if not t:
            return None
        brks.append({"col": t["name"], "as": t["name"], "bucket": time_hint})
    if split and not brks:
        return None                         # said "by <something>" but we could not resolve it: let the AI try
    st: dict = {"table": table["name"], "aggregations": aggs}
    if brks:
        st["breakouts"] = brks
    timed = next((b for b in brks if b.get("bucket")), None)
    st["sort"] = [{"col": timed["as"], "dir": "asc"}] if timed else [{"col": aggs[0]["as"], "dir": "desc"}] if brks else []
    if not st["sort"]:
        st.pop("sort")
    spec = hints(prompt, {"stages": [st]})
    return spec


# ------------------------------------------------------------------------------------------ editing an open query
_NUM_OPS = [(r">=|at least", ">="), (r"<=|at most", "<="), (r">|greater than|more than|above|over", ">"), (r"<|less than|below|under", "<")]


def _num(v: str):
    try:
        return float(v.replace(",", "")) if "." in v else int(v.replace(",", ""))
    except ValueError:
        return None


_VALUES: dict[tuple[str, str], tuple[float, list[str]]] = {}


def _actual_value(table: str, column: str, typed: str) -> str | None:
    """The column's real spelling of a typed value ("dark" -> "Dark"), so the filter can be a plain `=` (fast, pushed down to remote
    databases) instead of a LOWER() comparison. Distinct values are looked up once and cached for 10 minutes."""
    import time
    from .engine import engine
    from .qb import compile_spec
    key = (table, column)
    hit = _VALUES.get(key)
    if not hit or time.time() - hit[0] > 600:
        try:
            r = engine.execute(compile_spec({"stages": [{"table": table, "columns": [column], "distinct": True, "limit": 500}]}), 500)
            _VALUES[key] = hit = (time.time(), [str(x[column]) for x in r["rows"] if x[column] is not None])
        except Exception:  # noqa: BLE001
            return None
    return next((v for v in hit[1] if v.lower() == typed.lower()), None)


def refine_spec(prompt: str, current: dict) -> dict | None:
    """Apply simple edits to an open query: filters ("only category is Dark", "amount > 100"), "add the count", "sort by X desc",
    "limit 20", "remove filters". ALL parts of the sentence must be understood, otherwise None (the AI gets the whole request)."""
    import copy
    spec = copy.deepcopy(current)
    st0, last = spec["stages"][0], spec["stages"][-1]
    table = next((t for t in _schema() if t["name"] == st0.get("table")), None)
    if not table:
        return None
    cols = table["cols"]
    outputs = {(a.get("as") or "").lower(): a["as"] for a in last.get("aggregations") or [] if a.get("as")}
    outputs |= {(b.get("as") or "").lower(): b["as"] for b in last.get("breakouts") or [] if b.get("as")}

    def column(text: str) -> dict | None:
        hit = _find(" " + _norm(text) + " ", cols)
        return hit[0][1] if len(hit) == 1 else None

    def apply(clause: str) -> bool:
        c = clause.strip().rstrip(".")
        low = " ".join(c.lower().split())
        if re.fullmatch(r"(?:remove|clear|drop|reset)(?: all)?(?: the)? filters?", low):
            st0.pop("filters", None)
            return True
        m = re.fullmatch(r"(?:limit|show|first|top|only|just)\s+(?:the\s+)?(?:first\s+)?(\d{1,6})(?:\s+rows?)?", low)
        if m:
            last["limit"] = int(m.group(1))
            return True
        if re.fullmatch(r"(?:add|include|also show|show)(?: me)?(?: the)? (?:count|row count|number of rows|number of orders|count of (?:rows|orders|records))", low):
            if not (last.get("aggregations") or last.get("breakouts")):
                return False
            if not any(a.get("fn") == "count" for a in last.get("aggregations") or []):
                last.setdefault("aggregations", []).append({"fn": "count", "as": "Count"})
            return True
        m = re.fullmatch(r"(?:sort|order)(?:ed)?(?: the results?)? by (.+?)(?: (desc\w*|asc\w*|high to low|low to high|highest first|lowest first|biggest first|smallest first))?", low)
        if m:
            name = outputs.get(_norm(m.group(1)).lower()) or outputs.get(m.group(1).strip())
            if not name:
                col = column(m.group(1))
                name = col["name"] if col and not (last.get("aggregations") or last.get("breakouts")) else None
            if not name:
                return False
            asc = bool(m.group(2)) and re.match(r"asc|low to high|lowest first|smallest first", m.group(2)) is not None
            last["sort"] = [{"col": name, "dir": "asc" if asc else "desc"}]
            return True
        m = re.fullmatch(r"(?:only|just|keep|filter|show|where)(?: rows)?(?: where| for| with)?\s+(?:the\s+)?(.+?)\s+(?:is|are|=|==|equals|is equal to)\s+(.+)", c, flags=re.I)
        if m:
            col = column(m.group(1))
            if not col or len(spec["stages"]) > 1 and (last.get("aggregations") or last.get("breakouts")) and False:
                return False
            val = m.group(2).strip().strip("'\"")
            n = _num(val) if col["kind"] == "num" else None
            if col["kind"] == "num" and n is None:
                return False
            flt = {"col": col["name"], "op": "=", "value": n if n is not None else val}
            if col["kind"] == "text":
                remote = any(d.get("remote_table") for d in store.list("datasets", where="name = ?", params=[table["name"]], order=None))
                if remote:                       # a lookup would scan the whole remote table: match the usual spellings instead (pushed down)
                    flt |= {"op": "in", "value": list(dict.fromkeys([val, val.lower(), val.upper(), val.title(), val.capitalize()]))}
                else:
                    exact = _actual_value(table["name"], col["name"], val)
                    flt |= {"op": "=", "value": exact} if exact else {"op": "ieq"}
            st0.setdefault("filters", []).append(flt)
            return True
        for rx, op in _NUM_OPS:
            m = re.fullmatch(rf"(?:only|just|keep|filter|show|where)?(?: rows)?(?: where)?\s*(?:the\s+)?(.+?)\s+(?:{rx})\s+(-?[\d.,]+)", low)
            if m:
                col, n = column(m.group(1)), _num(m.group(2))
                if not col or col["kind"] != "num" or n is None:
                    return False
                st0.setdefault("filters", []).append({"col": col["name"], "op": op, "value": n})
                return True
        return False

    clauses = [x for x in re.split(r",|;|\band then\b|\bthen\b|\band\b", prompt) if x.strip()]
    if not clauses or not all(apply(x) for x in clauses):
        return None
    return hints(prompt, spec)
