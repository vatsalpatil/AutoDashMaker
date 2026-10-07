"""Deterministic query explanation via sqlglot (§31).

Never asks the LLM to explain its own SQL — parses it and reports facts.
"""
from __future__ import annotations

from typing import Any

import sqlglot
from sqlglot import expressions as exp


def explain_sql(sql: str) -> dict[str, Any]:
    try:
        tree = sqlglot.parse_one(sql, dialect="duckdb")
    except Exception as e:
        return {"error": str(e)}

    tables = sorted({t.name for t in tree.find_all(exp.Table)})
    columns = sorted({c.name for c in tree.find_all(exp.Column)})
    group_cols = [
        c.sql(dialect="duckdb")
        for g in tree.find_all(exp.Group)
        for c in g.expressions
    ]
    aggregations = sorted({
        f.sql(dialect="duckdb")
        for f in tree.find_all(exp.AggFunc)
    })
    filters = []
    for w in tree.find_all(exp.Where):
        filters.append(w.this.sql(dialect="duckdb"))
    for h in tree.find_all(exp.Having):
        filters.append(f"HAVING {h.this.sql(dialect='duckdb')}")

    joins = [
        f"{j.this.sql(dialect='duckdb')}"
        for j in tree.find_all(exp.Join)
    ]
    ordering = [
        o.sql(dialect="duckdb") for o in tree.find_all(exp.Ordered)
    ]
    limit = None
    if tree.args.get("limit"):
        limit = tree.args["limit"].expression.name

    return {
        "tables": tables,
        "columns": columns,
        "filters": filters,
        "grouped_by": group_cols,
        "calculated": aggregations,
        "joins": joins,
        "sorted_by": ordering,
        "limit": limit,
        "read_only": not any(
            isinstance(n, (exp.Insert, exp.Update, exp.Delete, exp.Drop,
                           exp.Alter, exp.Create, exp.TruncateTable))
            for n in tree.walk()
        ),
    }
