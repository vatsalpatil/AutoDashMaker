"""Automatic repair of a dashboard widget whose query fails.

Models regularly write a query that does not bind (a table alias that was never defined, a column that does not exist) or that
fails when it runs. Instead of dropping the widget, the query goes through up to MAX_FIXES rounds: each round gives the model the
database's real error, a targeted hint built from the real schema, and what the earlier rounds already got wrong. The last round
is not a patch but an ALTERNATIVE: a different, simpler query for the same widget purpose. Only when all of that fails is the widget
skipped, and the reason says how many automatic fixes were tried.
"""
from __future__ import annotations

import re
from typing import Any

from ..core.security import validate_readonly
from . import ai as ai_svc, assist as assist_svc
from .engine import engine

MAX_FIXES = 3   # repair rounds; the last one rewrites the query instead of patching it

ALTERNATIVE_RULES = (
    "You write ONE read-only DuckDB SELECT for a dashboard widget. Earlier attempts failed, so write a DIFFERENT and SIMPLER query that "
    "gives the same information: plain aggregation (GROUP BY) with at most one CTE, no window functions unless essential, only the "
    "listed table and columns, every output column aliased. An approximation with a simpler measure is better than failing. "
    "Reply with only the query in a ```sql block.")


def _hint(error: str, context: str) -> str:
    """A targeted pointer built from the real schema (the model sees the table and column names it must use)."""
    table = re.search(r"Table `([^`]+)`", context)
    columns = re.findall(r"^- (\S+) \S+ \[", context, re.M)
    hints = []
    missing = re.search(r'Table with name (\w+) does not exist', error)
    if missing and table:
        hints.append(f"`{missing.group(1)}` is not a table or a CTE of this query. Read FROM `{table.group(1)}`, or define `{missing.group(1)}` "
                     f"in a WITH clause before using it.")
    if re.search(r"Referenced column|Binder Error|not found in FROM", error) and columns:
        hints.append("The columns that exist are: " + ", ".join(columns) + ".")
    return " ".join(hints)


def _explain(error: str, history: list[str], context: str) -> str:
    out = error[:600]
    hint = _hint(error, context)
    if hint:
        out += f"\nHint: {hint}"
    earlier = [h[:160] for h in history[:-1]]
    if earlier:
        out += "\nEarlier fixes also failed with: " + " | ".join(earlier) + ". Do not repeat those mistakes."
    return out


def _alternative(spec: dict[str, Any], history: list[str], context: str, provider_id: str | None) -> str:
    purpose = f"{spec.get('title', 'widget')} (chart type: {spec.get('type', 'table')}). Purpose: {spec.get('why') or 'n/a'}. Calculation: {spec.get('formula') or 'n/a'}."
    body = f"Widget: {purpose}\nThe previous queries failed with: " + " | ".join(h[:200] for h in history) + "\nWrite a different, simpler query."
    return ai_svc.generate_sql(assist_svc._messages(ALTERNATIVE_RULES, context, body), provider_id=provider_id, check=engine.check_sql)   # noqa: SLF001


def run_with_repairs(spec: dict[str, Any], sql: str, context: str, provider_id: str | None) -> tuple[str, dict[str, Any], int]:
    """(final sql, execution result, number of automatic fixes used). Raises ValueError when every round failed."""
    history: list[str] = []
    for attempt in range(MAX_FIXES + 1):
        try:
            sql = validate_readonly(sql, 10000)
            error = engine.check_sql(sql)            # binds against the real schema without running
            if error is None:
                return sql, engine.execute(sql, 2000), attempt
        except Exception as e:                        # unsafe SQL, a timeout, a runtime error, or an AI call that failed mid-repair
            error = str(e)
        history.append(error)
        if attempt == MAX_FIXES:
            break
        try:
            if attempt < MAX_FIXES - 1:
                sql = assist_svc.fix_sql(sql, _explain(error, history, context), context, provider_id, engine.check_sql)
            else:
                sql = _alternative(spec, history, context, provider_id)
        except Exception as e:                        # the model itself failed (rate limit, no usable answer): count the round, try the next
            history.append(f"repair call failed: {e}")
    raise ValueError(f"{history[0][:140]} (it still failed after {MAX_FIXES} automatic fixes: {history[-1][:100]})")
