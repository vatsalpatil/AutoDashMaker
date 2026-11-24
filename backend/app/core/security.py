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

from .config import settings

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


# Multi-user servers (AUTH_ENABLED): SQL may only touch tables, never files, the network or the server's settings.
_TABLE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")
_SERIES_FUNCS = {"range", "generate_series"}
_BLOCKED_FUNC_PREFIXES = (
    "read_", "parquet_", "duckdb_", "pragma_", "sniff_", "glob", "getenv", "current_setting", "query", "iceberg_",
    "delta_", "sqlite_", "postgres_", "mysql_", "st_read", "write_", "to_csv", "to_parquet", "list_files",
    # defence in depth: extension loaders, network fetchers, session variables, secrets, exports
    "load_", "install_", "http_", "set_variable", "getvariable", "which_secret", "export_", "checkpoint", "force_checkpoint",
)


def _func_name(node: exp.Func) -> str:
    return (str(node.this) if isinstance(node, exp.Anonymous) else node.sql_name()).lower()


def _forbid_external_access(tree: exp.Expression) -> None:
    for node in tree.walk():
        if isinstance(node, exp.Table):
            src = node.this
            if isinstance(src, exp.GenerateSeries) or (  # range(n) / generate_series(a, b) are harmless
                    isinstance(src, exp.Anonymous) and str(src.this).lower() in _SERIES_FUNCS):
                continue
            if not (isinstance(src, exp.Identifier) and _TABLE_NAME.match(src.name)):
                raise UnsafeQueryError("Only plain table names are allowed (no files, URLs or table functions).")
        elif isinstance(node, exp.Func):
            name = _func_name(node)
            if name.startswith(_BLOCKED_FUNC_PREFIXES):
                raise UnsafeQueryError(f"Function not allowed: {name}")


_WRITE_VERB = re.compile(r"\s*(drop|delete|insert|update|alter|create|truncate|merge|copy|attach|detach|grant|revoke)\b", re.I)


_ANSI = re.compile(r"\x1b\[[0-9;]*m")


def plain_error(e: Exception) -> str:
    """A parser error without terminal colour codes, first line only."""
    return _ANSI.sub("", str(e)).splitlines()[0] if str(e) else type(e).__name__


def _top_level_tail(sql: str) -> int:
    """Index where a trailing top-level ORDER BY / LIMIT starts (outside brackets and quotes), else len(sql)."""
    depth, quote, cut = 0, "", len(sql)
    for i, ch in enumerate(sql):
        if quote:
            quote = "" if ch == quote else quote
        elif ch in "'\"":
            quote = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif depth == 0 and cut == len(sql) and re.match(r"\s(ORDER\s+BY|LIMIT)\b", sql[i:], re.I):
            cut = i
    return cut


def wrap_pivot(sql: str) -> str:
    """DuckDB's statement form `PIVOT t ON c USING agg(...) [GROUP BY ..] [ORDER BY ..] [LIMIT ..]` as an ordinary SELECT
    (`SELECT * FROM (PIVOT ...) ORDER BY ...`): same result, and sqlglot can parse and check it. Anything else is unchanged."""
    s = sql.strip().rstrip(";").strip()
    if not re.match(r"(?i)(UN)?PIVOT\b", s):
        return sql
    cut = _top_level_tail(s)
    return f"SELECT * FROM ({s[:cut].strip()}){(' ' + s[cut:].strip()) if cut < len(s) else ''}"


def validate_readonly(sql: str, row_limit: int) -> str:
    """Return a safe, limited SQL string or raise UnsafeQueryError."""
    sql = wrap_pivot(sql.strip().rstrip(";"))
    try:
        statements = [s for s in sqlglot.parse(sql, read="duckdb") if s is not None]
    except Exception as e:
        if _WRITE_VERB.match(sql):
            raise UnsafeQueryError("Only read-only queries (SELECT / WITH) are allowed") from e
        msg = plain_error(e)
        raise UnsafeQueryError(f"SQL does not parse: {msg}") from e

    if len(statements) != 1:
        raise UnsafeQueryError("Exactly one statement is allowed.")

    tree = statements[0]
    for node in tree.walk():
        if isinstance(node, FORBIDDEN):
            raise UnsafeQueryError(f"Statement type not allowed: {type(node).__name__}")

    if not isinstance(tree, (exp.Select, exp.Union, exp.Subquery)) and tree.find(exp.Select) is None:
        raise UnsafeQueryError("Only SELECT (optionally with CTEs) queries are allowed.")

    if settings.auth_enabled:
        _forbid_external_access(tree)

    if tree.args.get("limit") is None:
        tree = tree.limit(row_limit)

    return tree.sql(dialect="duckdb")
