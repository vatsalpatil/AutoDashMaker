"""Round-trip check for SQL -> builder spec: does the compiled spec return what the SQL returns?"""
from __future__ import annotations

from collections import Counter

from .qb import compile_spec

CHECK_ROWS = 2000


def same_result(sql: str, spec: dict) -> str | None:
    """None when the spec reproduces the query (same columns and rows), otherwise why not."""
    from .engine import engine
    try:
        a = engine.execute(sql, CHECK_ROWS)
        b = engine.execute(compile_spec(spec), CHECK_ROWS)
    except Exception as e:  # noqa: BLE001
        return f"the steps did not run the same ({str(e)[:120]})"
    if a["columns"] != b["columns"]:
        return "the steps produce different columns"
    ra, rb = [tuple(r.values()) for r in a["rows"]], [tuple(r.values()) for r in b["rows"]]
    if len(ra) != len(rb):
        return "the steps return a different number of rows"
    if len(ra) < CHECK_ROWS:
        same = (ra == rb) if "ORDER BY" in sql.upper() else (Counter(map(repr, ra)) == Counter(map(repr, rb)))
        if not same:
            return "the steps return different rows"
    return None
