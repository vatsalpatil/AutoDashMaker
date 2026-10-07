"""Visual query builder compiler: a JSON spec -> one read-only DuckDB query (no AI, fully deterministic).

A spec is a list of `stages`; each stage reads the previous one (as a CTE), like Metabase's "add another stage":

  stage = {
    sql: "<raw SELECT>"                # first stage only, instead of table: the query is kept whole
    table: "<dataset name>"            # first stage only
    joins: [{table, type, on: [{left, right}]}]   # left/right are refs; tables are aliased t0 (source), t1, t2 ...
    custom: [{name, expr}]             # custom columns (SQL expression), usable everywhere below by name
    filters: [{col, op, value, value2}], filter_mode: "and" | "or"
    aggregations: [{fn, col, as, where: [filters]}]   # `where` makes a conditional aggregate
    breakouts: [{col, bucket, as}]     # group by
    having: [{col, op, value}]         # filter on aggregates (by alias)
    windows: [{fn, col, partition: [ref], order: ref, as, n}]
    columns: [ref], distinct: bool     # plain select list when there is no aggregation
    sort: [{col, dir}], limit: int
  }
A ref is a plain column / alias name, or {"t": "t1", "c": "column"}. Anything unknown raises ValueError.
"""
from __future__ import annotations

import sqlglot
from sqlglot import expressions as exp

from ..core.security import quote_ident as q
from ..core.store import store

from .qb_ops import AGGS, BUCKETS, CMP, JOINS, UNARY, WINDOWS



def lit(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def _like_escape(v) -> str:
    return str(v).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _positive(n, default: int) -> int:
    try:
        return max(1, int(n))
    except (TypeError, ValueError):
        return default


class _Stage:
    def __init__(self, spec: dict, first: bool, prev: str | None):
        self.s, self.first, self.prev = spec, first, prev
        self.custom = {c["name"]: c["expr"] for c in spec.get("custom") or [] if c.get("name") and c.get("expr")}
        self.hidden = {c["name"] for c in spec.get("custom") or [] if c.get("hidden")}
        self.alias_expr: dict[str, str] = {}   # aggregate/breakout alias -> expression (for having/sort/windows)
        self._seen_custom: set[str] = set()

    # ---- expressions
    def ref(self, r) -> str:
        if isinstance(r, dict):
            if not r.get("c"):
                raise ValueError("column is missing")
            return (q(r["t"]) + "." if r.get("t") else "") + q(r["c"])
        if not r:
            raise ValueError("column is missing")
        if r in self.alias_expr:
            return self.alias_expr[r]
        if r in self.custom:
            if r in self._seen_custom:
                raise ValueError(f"custom column '{r}' refers to itself")
            self._seen_custom.add(r)
            try:
                return "(" + self.expr(self.custom[r]) + ")"
            finally:
                self._seen_custom.discard(r)
        return q(r)

    def select_item(self, c) -> str:
        label = c.get("as") or c.get("c") if isinstance(c, dict) else c
        return f"{self.ref(c)} AS {q(label)}"

    def expr(self, text: str) -> str:
        """A user-written SQL expression: parsed, subqueries refused; custom column names expand inline."""
        try:
            tree = sqlglot.parse_one(text, read="duckdb")
        except Exception as e:
            raise ValueError(f"the formula '{text[:60]}' is incomplete or has a typo: check brackets, commas and quotes") from e
        if tree.find(exp.Select, exp.Subquery, exp.Command):
            raise ValueError("subqueries are not allowed in expressions")
        for col in list(tree.find_all(exp.Column)):
            if not col.table and col.name in self.custom and col.name not in self._seen_custom:
                col.replace(sqlglot.parse_one(self.ref(col.name), read="duckdb"))
        return tree.sql(dialect="duckdb")

    def cond(self, f: dict, col_expr: str | None = None) -> str:
        op, v = f.get("op"), f.get("value")
        if op == "expr":
            return "(" + self.expr(str(v)) + ")"
        c = col_expr or self.ref(f.get("col"))
        if op in UNARY:
            return UNARY[op].format(c=c)
        if op in CMP:
            return f"{c} {CMP[op]} {lit(v)}"
        if op == "ieq":                                  # equals, ignoring upper/lower case (what people mean when they type "dark")
            return f"LOWER(CAST({c} AS VARCHAR)) = LOWER({lit(v)})"
        if op == "between":
            return f"{c} BETWEEN {lit(v)} AND {lit(f.get('value2'))}"
        if op in ("in", "not_in"):
            vals = v if isinstance(v, list) else [x.strip() for x in str(v).split(",") if x.strip()]
            if not vals:
                raise ValueError("pick at least one value")
            return f"{c} {'NOT ' if op == 'not_in' else ''}IN ({', '.join(lit(x) for x in vals)})"
        if op in ("contains", "not_contains", "starts_with", "ends_with"):
            pat = _like_escape(v)
            pat = {"contains": f"%{pat}%", "not_contains": f"%{pat}%", "starts_with": f"{pat}%", "ends_with": f"%{pat}"}[op]
            return f"CAST({c} AS VARCHAR) {'NOT ' if op == 'not_contains' else ''}ILIKE {lit(pat)} ESCAPE '\\'"
        if op == "regex":
            return f"REGEXP_MATCHES(CAST({c} AS VARCHAR), {lit(v)})"
        if op in ("last_n_days", "next_n_days"):
            n = _positive(v, 7)
            return (f"CAST({c} AS DATE) BETWEEN CURRENT_DATE - INTERVAL {n} DAY AND CURRENT_DATE" if op == "last_n_days"
                    else f"CAST({c} AS DATE) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL {n} DAY")
        if op == "expr":
            return "(" + self.expr(str(v)) + ")"
        raise ValueError(f"unknown filter operator '{op}'")

    def where(self, filters: list[dict], mode: str = "and") -> str:
        parts = [self.cond(f) for f in filters or []]
        return f" {mode.upper() if mode in ('and', 'or') else 'AND'} ".join(parts)

    def breakout(self, b: dict) -> tuple[str, str]:
        c = self.ref(b.get("col"))
        bucket = b.get("bucket") or "none"
        if bucket == "none":
            e = c
        elif bucket.startswith("bin:"):
            w = float(bucket[4:] or 10)
            if w <= 0:
                raise ValueError("bin width must be positive")
            e = f"FLOOR({c} / {w!r}) * {w!r}"
        elif bucket in BUCKETS:
            e = BUCKETS[bucket].format(c=c)
        else:
            raise ValueError(f"unknown bucket '{bucket}'")
        name = b.get("as") or (b["col"]["c"] if isinstance(b["col"], dict) else str(b["col"])) + ("" if bucket == "none" else f" ({bucket})")
        return e, name

    def agg(self, a: dict) -> tuple[str, str]:
        fn = a.get("fn")
        if fn == "expr":
            e = self.expr(str(a.get("expr") or ""))
        elif fn in AGGS:
            if "{c}" in AGGS[fn] and not a.get("col"):
                raise ValueError(f"'{fn}' needs a column")
            e = AGGS[fn].format(c=self.ref(a["col"]) if a.get("col") else "")
        else:
            raise ValueError(f"unknown aggregation '{fn}'")
        if a.get("where"):
            if fn == "expr" or fn in ("null_count", "null_pct", "range"):
                raise ValueError(f"'{fn}' cannot take a condition")
            e = f"{e} FILTER (WHERE {self.where(a['where'])})"
        label = a.get("as") or (fn if fn == "count" else f"{fn} of {a['col']['c'] if isinstance(a.get('col'), dict) else a.get('col')}")
        return e, label

    def window(self, w: dict) -> tuple[str, str]:
        fn = w.get("fn")
        if fn not in WINDOWS:
            raise ValueError(f"unknown window function '{fn}'")
        tpl, needs_col = WINDOWS[fn]
        if needs_col and not w.get("col"):
            raise ValueError(f"'{fn}' needs a column")
        part = ", ".join(self.ref(p) for p in w.get("partition") or [])
        p = f"PARTITION BY {part}" if part else ""
        o = ""
        if w.get("order"):
            o = f"{' ' if p else ''}ORDER BY {self.ref(w['order'])} {'DESC' if w.get('order_dir') == 'desc' else 'ASC'}"
        elif fn not in ("pct_of_total", "z_score"):
            raise ValueError(f"'{fn}' needs an order column")
        e = tpl.format(c=self.ref(w["col"]) if w.get("col") else "", p=p, o=o, n=_positive(w.get("n"), 3 if "moving" in fn else 1))
        return e, w.get("as") or f"{fn}" + (f" of {w['col']}" if isinstance(w.get("col"), str) else "")

    # ---- the stage itself
    def build(self) -> str:
        s = self.s
        tables = self.prev
        if self.first and s.get("sql"):   # a query kept whole (e.g. opened from the Workbench): later stages build on it
            body = str(s["sql"]).strip().rstrip(";").strip()
            return f"SELECT * FROM ({body}) AS {q('t0')}" + (f" LIMIT {_positive(s['limit'], 1000)}" if s.get("limit") else "")
        if self.first:
            tables = f"{_physical(s.get('table'))} AS {q('t0')}"
            for i, j in enumerate(s.get("joins") or [], 1):
                jt = JOINS.get(j.get("type") or "left")
                if not jt:
                    raise ValueError(f"unknown join type '{j.get('type')}'")
                on = " AND ".join(f"{self.ref(k['left'])} = {self.ref(k['right'])}" for k in j.get("on") or [])
                if not on and jt != "CROSS JOIN":
                    raise ValueError(f"join with {j.get('table')} needs a matching column pair")
                tables += f" {jt} {_physical(j.get('table'))} AS {q(f't{i}')}" + (f" ON {on}" if on else "")
        where = self.where(s.get("filters"), s.get("filter_mode", "and"))
        aggs = [self.agg(a) for a in s.get("aggregations") or []]
        brks = [self.breakout(b) for b in s.get("breakouts") or []]
        post_needed = bool(s.get("windows") or s.get("having"))
        order_limit = ""
        if aggs or brks:
            sel, grp = [], []
            for e, n in brks:
                sel.append(f"{e} AS {q(n)}"); grp.append(e); self.alias_expr[n] = q(n) if post_needed else e
            for e, n in aggs:
                sel.append(f"{e} AS {q(n)}"); self.alias_expr[n] = q(n) if post_needed else e
            if len({n for _, n in brks + aggs}) != len(brks + aggs):
                raise ValueError("two output columns share a name; rename one")
            inner = f"SELECT {', '.join(sel)} FROM {tables}" + (f" WHERE {where}" if where else "") + (f" GROUP BY {', '.join(grp)}" if grp else "")
            if post_needed:
                names = [n for _, n in brks + aggs]
                self.alias_expr = {n: q(n) for n in names}
                outer = ["*"]
                inner_from = f"({inner}) AS agg"
                having = self.where(s.get("having"))
                wins = [self.window(w) for w in s.get("windows") or []]
                outer += [f"{e} AS {q(n)}" for e, n in wins]
                for _, n in wins:
                    self.alias_expr[n] = q(n)
                if having:
                    inner_from = f"(SELECT * FROM {inner_from} WHERE {having}) AS h"
                sql = f"SELECT {', '.join(outer)} FROM {inner_from}"
            else:
                sql = inner
        else:
            if s.get("having"):
                raise ValueError("'filter on summary' needs a summarize step")
            cols = s.get("columns") or []
            if cols:
                sel = [self.select_item(c) for c in cols]   # a picked list is exact: only these columns, in this order
            else:
                njoin = len(s.get("joins") or [])
                base = [f"{q('t0')}.*"] + [f"{q(f't{i}')}.*" for i in range(1, njoin + 1)] if self.first and njoin else ["*"]
                sel = [f"({self.expr(e)}) AS {q(n)}" for n, e in self.custom.items() if n not in self.hidden] + base   # custom columns first: visible, not 30 columns away
            if s.get("windows"):
                wins = [self.window(w) for w in s["windows"]]
                sel += [f"{e} AS {q(n)}" for e, n in wins]
                for _, n in wins:
                    self.alias_expr[n] = q(n)
            sql = f"SELECT {'DISTINCT ' if s.get('distinct') else ''}{', '.join(sel)} FROM {tables}" + (f" WHERE {where}" if where else "")
        if s.get("sort"):
            order_limit += " ORDER BY " + ", ".join(f"{self.ref(o['col'])} {'DESC' if o.get('dir') == 'desc' else 'ASC'}" for o in s["sort"])
        if s.get("limit"):
            order_limit += f" LIMIT {_positive(s['limit'], 1000)}"
        return sql + order_limit


def _physical(name: str | None) -> str:
    if not name:
        raise ValueError("pick a table first")
    rows = [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    hit = next((d for d in rows if d["physical_name"] == name), None) or next((d for d in rows if d["name"] == name), None) \
        or next((d for d in rows if d["name"].lower() == name.lower()), None)
    if not hit:
        raise ValueError(f"table '{name}' not found")
    return hit["physical_name"]


def compile_spec(spec: dict, upto: int | None = None) -> str:
    """Compile stages (optionally only the first `upto`, for per-step previews) to one SELECT."""
    stages = (spec.get("stages") or [spec])[: upto or None]
    if not stages:
        raise ValueError("empty query")
    ctes, prev = [], None
    for i, st in enumerate(stages):
        body = _Stage(st, i == 0, prev).build()
        if i == len(stages) - 1:
            return ("WITH " + ", ".join(ctes) + " " if ctes else "") + body
        ctes.append(f"stage_{i + 1} AS ({body})")
        prev = f"stage_{i + 1}"
    raise ValueError("empty query")
