"""Deterministic lineage for an Ask answer, parsed (sqlglot) from the SQL that actually ran — never from the LLM.

Shape (additive `lineage` field on /ai/chat and /ai/ask):
  {sql, tables:[physical], datasets:[{id, name, table, refreshed_at, updated_at}], columns:[{table, column}],
   filters:[sql], group_by:[sql], aggregations:[sql], windows:[sql], joins:[{type, table, on}], ctes:[name],
   metrics:[{id, name, label, expression, filters, definition_sql}], row_count, execution_ms, attempts}
"""
from __future__ import annotations

from typing import Any

import sqlglot
from sqlglot import expressions as exp

from ..core.store import store
from .semantic import metrics_used

D = "duckdb"


def _uniq(xs: list) -> list:
    seen: list = []
    for x in xs:
        if x not in seen:
            seen.append(x)
    return seen


def _datasets(tables: list[str]) -> list[dict[str, Any]]:
    out = []
    for d in store.list("datasets", order=None):
        if d.get("physical_name") in tables:
            out.append({"id": d["id"], "name": d.get("name"), "table": d["physical_name"],
                        "refreshed_at": str(d["refreshed_at"]) if d.get("refreshed_at") else None,
                        "updated_at": str(d["updated_at"]) if d.get("updated_at") else None})
    return out


def _columns(tree: exp.Expression, alias_to_table: dict[str, str], tables: list[str]) -> list[dict[str, str | None]]:
    out = []
    for c in tree.find_all(exp.Column):
        if not c.name or isinstance(c.this, exp.Star):
            continue
        t = alias_to_table.get(c.table) if c.table else (tables[0] if len(tables) == 1 else None)
        out.append({"table": t, "column": c.name})
    return _uniq(out)


def build(sql: str, result: dict | None = None, dataset_id: str | None = None, attempts: int = 1) -> dict[str, Any]:
    result = result or {}
    base: dict[str, Any] = {"sql": sql, "row_count": result.get("row_count"), "execution_ms": result.get("duration_ms"),
                            "attempts": attempts}
    try:
        tree = sqlglot.parse_one(sql, dialect=D)
    except Exception as e:  # noqa: BLE001 - lineage must never break an answer
        return {**base, "error": f"could not parse SQL: {str(e)[:200]}"}
    ctes = [c.alias_or_name for c in tree.find_all(exp.CTE)]
    tabs = [t for t in tree.find_all(exp.Table) if t.name and t.name not in ctes]
    tables = _uniq([t.name for t in tabs])
    alias_to_table = {(t.alias or t.name): t.name for t in tabs}
    joins = [{"type": (j.side or j.kind or "inner").lower(), "table": j.this.sql(dialect=D),
              "on": j.args["on"].sql(dialect=D) if j.args.get("on") else None} for j in tree.find_all(exp.Join)]
    return {
        **base,
        "tables": tables, "datasets": _datasets(tables), "ctes": ctes,
        "columns": _columns(tree, alias_to_table, tables),
        "filters": [w.this.sql(dialect=D) for w in tree.find_all(exp.Where)]
                   + [f"HAVING {h.this.sql(dialect=D)}" for h in tree.find_all(exp.Having)],
        "group_by": [g.sql(dialect=D) for grp in tree.find_all(exp.Group) for g in grp.expressions],
        "aggregations": _uniq([f.sql(dialect=D) for f in tree.find_all(exp.AggFunc) if not f.find_ancestor(exp.Window)]),
        "windows": _uniq([w.sql(dialect=D) for w in tree.find_all(exp.Window)]),
        "joins": joins,
        "metrics": metrics_used(sql, dataset_id),
    }
