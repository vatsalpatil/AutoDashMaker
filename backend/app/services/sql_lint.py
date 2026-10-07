"""Instant, rule-based checks for a query (no AI): the reliable half of "Optimize".

Each finding is {level: info|warn, title, detail, fix?}. Built on the parsed query (sqlglot), plus row counts of the tables it reads
so advice is only given when it matters (a missing LIMIT on a 5-row table is not worth mentioning).
"""
from __future__ import annotations

from typing import Any

import sqlglot
from sqlglot import exp

from ..core.store import store

BIG = 50_000          # rows from which "reads everything" advice is worth giving


def _row_counts() -> dict[str, int]:
    out: dict[str, int] = {}
    for d in store.list("datasets", order=None):
        n = int(d.get("row_count") or 0)
        for key in (d["name"], d.get("physical_name") or ""):
            if key:
                out[key.lower()] = n
    return out


def lint(sql: str) -> list[dict[str, Any]]:
    try:
        tree = sqlglot.parse_one(sql, read="duckdb")
    except Exception:
        return []
    if not isinstance(tree, (exp.Select, exp.Union, exp.With)) and not tree.find(exp.Select):
        return []
    counts = _row_counts()
    ctes = {c.alias.lower() for c in tree.find_all(exp.CTE) if c.alias}
    tables = [t.name for t in tree.find_all(exp.Table) if t.name and t.name.lower() not in ctes]
    biggest = max((counts.get(t.lower(), 0) for t in tables), default=0)
    out: list[dict[str, Any]] = []
    add = lambda level, title, detail, fix=None: out.append({"level": level, "title": title, "detail": detail, **({"fix": fix} if fix else {})})  # noqa: E731

    top = tree if isinstance(tree, exp.Select) else tree.find(exp.Select)
    has_limit = bool(tree.args.get("limit") or (top is not None and top.args.get("limit")))
    aggregated = bool(top is not None and (top.args.get("group") or any(True for _ in top.find_all(exp.AggFunc))))

    if any(isinstance(s, exp.Star) for s in (top.expressions if top is not None else [])) and biggest >= BIG:
        add("warn", "SELECT * reads every column", f"The table has about {biggest:,} rows; list only the columns you need so less data is read and returned.",
            "SELECT col_a, col_b, … FROM …")
    if not has_limit and not aggregated and biggest >= BIG:
        add("warn", "No LIMIT", f"This returns every row (about {biggest:,}); add LIMIT while exploring.", "… LIMIT 1000")
    if top is not None and top.args.get("order") and not has_limit and not aggregated and biggest >= BIG:
        add("info", "Sorting without a LIMIT", "Sorting all rows is the most expensive part; with LIMIT only the top rows are kept.")
    if any(isinstance(n.this, exp.In) and n.this.args.get("query") is not None for n in tree.find_all(exp.Not)):
        add("warn", "NOT IN (subquery)", "If the subquery returns a NULL, NOT IN matches nothing. NOT EXISTS is safer and usually faster.",
            "WHERE NOT EXISTS (SELECT 1 FROM … WHERE …)")
    for where in tree.find_all(exp.Where):
        wrapped = [f for f in where.find_all(exp.Func) if not isinstance(f, (exp.And, exp.Or, exp.Not)) and f.find(exp.Column)
                   and isinstance(f.parent, (exp.EQ, exp.GT, exp.GTE, exp.LT, exp.LTE, exp.NEQ, exp.In, exp.Between))]
        if wrapped:
            add("info", "Function on a filtered column", f"{wrapped[0].sql(dialect='duckdb')[:60]} is computed for every row, which prevents skipping data. "
                "Compare the column itself to a range when you can (e.g. date >= '2024-01-01' AND date < '2025-01-01').")
            break
    if any(isinstance(l.args.get("expression"), exp.Literal) and str(l.args["expression"].this).startswith("%") for l in where_likes(tree)):
        add("info", "LIKE starting with %", "A leading wildcard cannot use any ordering of the data; match a prefix or use an exact value if possible.")
    if top is not None and top.args.get("distinct") and top.args.get("group"):
        add("info", "DISTINCT together with GROUP BY", "GROUP BY already returns one row per group; DISTINCT is redundant work.")
    for j in tree.find_all(exp.Join):
        if not j.args.get("on") and not j.args.get("using") and (j.kind or "").upper() in ("", "CROSS") and not j.args.get("side") and not j.args.get("method"):
            add("warn", "Join without a condition", "A join with no ON / USING pairs every row with every row (a cartesian product).", "JOIN … ON a.key = b.key")
            break
    if sum(1 for _ in tree.find_all(exp.Subquery)) >= 3:
        add("info", "Many nested subqueries", "Several nested subqueries are harder to read and check; CTEs (WITH name AS (…)) make each step visible.")
    return out


def where_likes(tree: exp.Expression):
    return [n for n in tree.find_all(exp.Like)]
