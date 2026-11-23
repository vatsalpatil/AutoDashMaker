"""Deterministic checks of AI SQL against the real values of text columns (no model call).

- fix_literal_case: `status = 'completed'` when the data says 'Completed' → corrected literal (case-only differences).
- missing_values: the question names a real value ("completed orders") but the SQL never uses it → the hint to retry with.
Only low-cardinality text columns are considered (column_values), so this stays cheap and precise.
"""
from __future__ import annotations

import re

import sqlglot
from sqlglot import exp

from ..core.store import store
from . import column_values


def _catalog() -> tuple[dict, dict]:
    """physical table → dataset, and physical table → {column (lower) → columns_meta row}."""
    ds = {d["physical_name"].lower(): d for d in store.list("datasets", order=None) if d.get("physical_name")}
    by_id = {d["id"]: d for d in ds.values()}
    cols: dict[str, dict] = {}
    for c in store.list("columns_meta", order=None):
        d = by_id.get(c["dataset_id"])
        if d:
            cols.setdefault(d["physical_name"].lower(), {})[c["name"].lower()] = c
    return ds, cols


def _values(ds: dict, cols: dict, table: str, col: str) -> list[str] | None:
    d, c = ds.get(table), cols.get(table, {}).get(col.lower())
    return column_values.values_for(d, c) if d and c else None


def _parse(sql: str):
    try:
        return sqlglot.parse_one(sql, read="duckdb")
    except Exception:  # noqa: BLE001
        return None


def fix_literal_case(sql: str) -> str | None:
    """The SQL with case-only literal mistakes corrected, or None when there is nothing to fix."""
    tree = _parse(sql)
    if tree is None:
        return None
    ds, cols = _catalog()
    aliases = {(t.alias_or_name or "").lower(): t.name.lower() for t in tree.find_all(exp.Table)}
    changed = False
    for lit in list(tree.find_all(exp.Literal)):
        parent = lit.parent
        if not lit.is_string or not isinstance(parent, (exp.EQ, exp.NEQ, exp.In)):
            continue
        col = parent.this if isinstance(parent, exp.In) else (parent.left if parent.right is lit else parent.right)
        if not isinstance(col, exp.Column):
            continue
        tables = [aliases[col.table.lower()]] if col.table and col.table.lower() in aliases else list(set(aliases.values()))
        for t in tables:
            vals = _values(ds, cols, t, col.name)
            if not vals or lit.this in vals:
                continue
            match = next((v for v in vals if v.lower() == lit.this.lower()), None)
            if match:
                lit.set("this", match)
                changed = True
                break
    return tree.sql(dialect="duckdb") if changed else None


def missing_values(question: str, sql: str) -> list[str]:
    """Values of text columns that the question names (whole word) but the SQL never mentions, e.g. "orders.status = 'Completed'"."""
    q, s = question.lower(), sql.lower()
    ds, cols = _catalog()
    out: list[str] = []
    for table, columns in cols.items():
        for c in columns.values():
            for v in _values(ds, cols, table, c["name"]) or []:
                lv = v.lower()
                if len(lv) >= 3 and lv not in s and re.search(rf"(?<!\w){re.escape(lv)}(?!\w)", q):
                    out.append(f"{ds[table]['name']}.{c['name']} = '{v}'")
    return out[:5]
