"""Compose several queries into one with CTEs (WITH ... AS), so complex queries can be built step by step.

    editor:   SELECT product, SUM(amount) ... GROUP BY product
    add:      SELECT region, product, SUM(amount) ... GROUP BY region, product
    result:   WITH step_1 AS (<editor>), step_2 AS (<add>) SELECT * FROM step_2

Adding a third query appends `step_3`; the final SELECT always points at the newest step and can be
edited by hand to join or filter any of the steps. Each step keeps its own WITH clauses (nested CTEs
are valid in DuckDB), so names inside a step never collide with other steps.
"""
from __future__ import annotations

import re

import sqlglot
from sqlglot import expressions as exp

DIALECT = "duckdb"
_STEP = re.compile(r"^step_(\d+)$")


def _clean(sql: str) -> str:
    return (sql or "").strip().rstrip(";").strip()


def _parse(sql: str, what: str) -> exp.Query:
    try:
        tree = sqlglot.parse_one(sql, read=DIALECT)
    except Exception as e:
        raise ValueError(f"{what} does not parse: {str(e)[:200]}") from e
    if not isinstance(tree, exp.Query):
        raise ValueError(f"{what} must be a SELECT query")
    return tree


def _pretty(sql: str) -> str:
    return sqlglot.parse_one(sql, read=DIALECT).sql(dialect=DIALECT, pretty=True)


def format_sql(sql: str) -> str:
    return _pretty(_clean(_parse(_clean(sql), "query").sql(dialect=DIALECT)))


def _composed_steps(tree: exp.Query) -> list[exp.CTE] | None:
    """The CTEs of `WITH step_1 AS (...), ... SELECT * FROM step_n`, else None (not one of ours)."""
    if not isinstance(tree, exp.Select):
        return None
    ctes = list(tree.ctes)
    if not ctes or not all(_STEP.match(c.alias) for c in ctes):
        return None
    bare = tree.copy()
    bare.set("with_", None)
    return ctes if bare.sql(dialect=DIALECT) == f"SELECT * FROM {ctes[-1].alias}" else None


def compose_sql(base_sql: str, add_sql: str, name: str | None = None) -> str:
    """Return `base_sql` extended with `add_sql` as a new CTE step (or just `add_sql` if base is empty)."""
    add = _clean(add_sql)
    _parse(add, "new query")
    base = _clean(base_sql)
    if not base:
        return _pretty(add)
    base_tree = _parse(base, "editor query")

    steps = _composed_steps(base_tree)
    if steps is not None:
        parts = [f"{c.alias} AS ({c.this.sql(dialect=DIALECT)})" for c in steps]
        taken = {c.alias for c in steps}
        n = max(int(_STEP.match(c.alias).group(1)) for c in steps) + 1
    else:
        parts, taken, n = [f"step_1 AS ({base})"], {"step_1"}, 2

    label = re.sub(r"\W+", "_", (name or "").strip()).strip("_").lower()
    if not label or label[0].isdigit():
        label = f"step_{n}"
    while label in taken:
        label = f"{label}_{n}"
    parts.append(f"{label} AS ({add})")
    return _pretty(f"WITH {', '.join(parts)} SELECT * FROM {label}")


# ---------------------------------------------------------------- notebook cells

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def compose_cell_sql(cells: list[dict], index: int, reserved: set[str] | None = None) -> str:
    """SQL that runs notebook cell `index`, with the earlier cells it uses chained in as CTEs.

    `cells` is [{name, sql}] in notebook order. A cell may query an earlier cell by its name like a table
    (`SELECT * FROM step_1 WHERE ...`). Only cells reachable from the target's SQL are included (transitively),
    in notebook order. Names must be identifiers, unique, and must not shadow a real table (`reserved`).
    """
    reserved = {r.lower() for r in (reserved or set())}
    names: list[str] = []
    for i in range(index + 1):
        name = (cells[i].get("name") or "").strip()
        if not _IDENT.match(name):
            raise ValueError(f"cell {i + 1}: name '{name}' must be letters, digits and _ (not starting with a digit)")
        if name.lower() in reserved:
            raise ValueError(f"cell {i + 1}: name '{name}' is already a table; pick another name")
        if name.lower() in (n.lower() for n in names):
            raise ValueError(f"cell {i + 1}: name '{name}' is used by an earlier cell")
        names.append(name)

    sqls = [_clean(cells[i].get("sql") or "") for i in range(index + 1)]
    if not sqls[index]:
        raise ValueError("this cell is empty")

    def refs(i: int) -> set[int]:
        return {j for j in range(i) if re.search(rf"\b{re.escape(names[j])}\b", sqls[i], re.IGNORECASE)}

    needed: set[int] = set()
    stack = [index]
    while stack:
        for j in refs(stack.pop()):
            if j not in needed:
                needed.add(j)
                stack.append(j)
    for j in needed:
        if not sqls[j]:
            raise ValueError(f"cell '{names[j]}' is empty but is used below")
    if not needed:
        return sqls[index]

    parts = [f"{names[j]} AS ({sqls[j]})" for j in sorted(needed)]
    target_tree = _parse(sqls[index], "this cell")
    if target_tree.args.get("with_") is not None:  # target has its own WITH: nest it so the clauses don't clash
        parts.append(f"__cell AS ({sqls[index]})")
        return f"WITH {', '.join(parts)} SELECT * FROM __cell"
    return f"WITH {', '.join(parts)} {sqls[index]}"
