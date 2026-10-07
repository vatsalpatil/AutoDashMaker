"""Read-only SQL guard.

Every query reaching the analytical engine passes through sqlglot:
  1. must parse
  2. must be a single statement
  3. must be SELECT / WITH (no mutations, no DDL, no ATTACH/COPY/pragma)
  4. gets a LIMIT injected if missing (cost guard)
"""
from __future__ import annotations

import re

import sqlglot
from sqlglot import expressions as exp

_SECRET_PARAM = re.compile(
    r"(?i)((?:api[_-]?key|apikey|access[_-]?token|token|secret|password|passwd|pwd|auth|key)=)[^&\s'\"]+")
_URL_USERINFO = re.compile(r"(?i)([a-z][a-z0-9+.-]*://)[^/\s:@]+:[^/\s@]+@")


def redact_secrets(text: str) -> str:
    """Mask credentials in free text (URL userinfo and key/token/password query params) before it is
    stored, logged or returned — connector errors routinely echo the full request URL."""
    return _URL_USERINFO.sub(r"\1***:***@", _SECRET_PARAM.sub(r"\1***", text))


def quote_ident(name: str) -> str:
    """Quote a column/table identifier for DuckDB (escapes embedded double quotes)."""
    return '"' + name.replace('"', '""') + '"'

FORBIDDEN = (
    exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter, exp.Create,
    exp.TruncateTable, exp.Merge, exp.Copy, exp.Attach, exp.Detach,
    exp.Pragma, exp.Set, exp.Command,
)


class UnsafeQueryError(ValueError):
    pass


def validate_readonly(sql: str, row_limit: int) -> str:
    """Return a safe, limited SQL string or raise UnsafeQueryError."""
    sql = sql.strip().rstrip(";")
    try:
        statements = [s for s in sqlglot.parse(sql) if s is not None]
    except Exception as e:
        raise UnsafeQueryError(f"SQL does not parse: {e}") from e

    if len(statements) != 1:
        raise UnsafeQueryError("Exactly one statement is allowed.")

    tree = statements[0]
    for node in tree.walk():
        if isinstance(node, FORBIDDEN):
            raise UnsafeQueryError(f"Statement type not allowed: {type(node).__name__}")

    if not isinstance(tree, (exp.Select, exp.Union, exp.Subquery)) and tree.find(exp.Select) is None:
        raise UnsafeQueryError("Only SELECT (optionally with CTEs) queries are allowed.")

    if tree.args.get("limit") is None:
        tree = tree.limit(row_limit)

    return tree.sql(dialect="duckdb")
