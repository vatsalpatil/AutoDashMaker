"""Multi-layer transform engine: chained SQL and Python (Polars) layers (§9).

SQL layers run in DuckDB; Python layers run sandboxed on Polars DataFrames.
A pipeline always starts from a base dataset and each layer consumes the
previous layer's output — like Hex, but constrained and safe.

Python sandbox rules (deterministic, no LLM involved):
  - imports whitelisted: polars (as pl), numpy (as np), math, datetime, re, json
  - blocked: __import__, open, eval, exec, compile, input, globals, locals,
    getattr on dunders, any attribute starting with '__'
  - the code must assign its result to `result`
  - available names: df (current DataFrame), pl, np, math, result
"""
from __future__ import annotations

import ast
import math
from typing import Any

import polars as pl

from ..core.security import validate_readonly
from .engine import engine

ALLOWED_IMPORTS = {
    "polars": "pl",
    "numpy": "np",
    "math": "math",
    "re": "re",
    "json": "json",
    "datetime": "datetime",
}
BLOCKED_NAMES = {
    "__import__", "open", "eval", "exec", "compile", "input",
    "globals", "locals", "vars", "dir", "breakpoint", "exit", "quit",
    "getattr", "setattr", "delattr", "memoryview", "bytearray", "bytes",
}


class SandboxError(ValueError):
    pass


def _check_code(code: str) -> None:
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as e:
        raise SandboxError(f"Python syntax error: {e}") from e

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = (node.names[0].name.split(".")[0] if isinstance(node, ast.Import)
                      else (node.module or "").split(".")[0])
            if module not in ALLOWED_IMPORTS:
                raise SandboxError(f"import '{module}' is not allowed. "
                                   f"Allowed: {', '.join(ALLOWED_IMPORTS)}")
        elif isinstance(node, ast.Name) and node.id in BLOCKED_NAMES:
            raise SandboxError(f"'{node.id}' is not allowed in the sandbox")
        elif isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise SandboxError("dunder attribute access is not allowed")


def _strip_allowed_imports(code: str) -> str:
    """Whitelisted imports are pre-injected; drop the import statements so
    exec() never touches the real import machinery."""
    tree = ast.parse(code, mode="exec")
    tree.body = [n for n in tree.body if not isinstance(n, (ast.Import, ast.ImportFrom))]
    return ast.unparse(tree)


def run_python(code: str, df: pl.DataFrame, timeout_rows: int = 50_000) -> pl.DataFrame:
    """Execute user Python against a Polars DataFrame; must assign `result`."""
    _check_code(code)
    code = _strip_allowed_imports(code)
    namespace: dict[str, Any] = {"df": df, "pl": pl, "math": math, "result": None}
    try:
        import numpy as np
        namespace["np"] = np
    except ImportError:
        pass
    import re as _re, json as _json, datetime as _dt
    namespace.update({"re": _re, "json": _json, "datetime": _dt})
    SAFE_BUILTINS = {
        "len": len, "int": int, "float": float, "str": str, "bool": bool,
        "range": range, "isinstance": isinstance, "dict": dict, "list": list,
        "set": set, "tuple": tuple, "min": min, "max": max, "abs": abs,
        "sum": sum, "round": round, "sorted": sorted, "enumerate": enumerate,
        "zip": zip, "map": map, "filter": filter, "any": any, "all": all,
        "slice": slice, "None": None, "True": True, "False": False,
        "ValueError": ValueError, "TypeError": TypeError,
        "AttributeError": AttributeError, "IndexError": IndexError, "KeyError": KeyError,
    }
    try:
        exec(compile(code, "<transform>", "exec"), {"__builtins__": SAFE_BUILTINS}, namespace)
    except SandboxError:
        raise
    except Exception as e:
        raise SandboxError(f"Python error: {type(e).__name__}: {e}") from e
    result = namespace.get("result")
    if result is None:
        raise SandboxError("the code must assign its output to `result`")
    if isinstance(result, pl.LazyFrame):
        result = result.collect()
    if not isinstance(result, pl.DataFrame):
        raise SandboxError("`result` must be a Polars DataFrame")
    return result


# ---------------------------------------------------------------- pipeline

def _table_to_polars(table: str) -> pl.DataFrame:
    from . import remote
    with engine.connect(read_only=True, hint=table) as con:  # linked datasets: attach the remote source, read its table
        return con.execute(f"SELECT * FROM {remote.table_ref(table)}").pl()


def _sql_to_polars(sql: str) -> pl.DataFrame:
    safe = validate_readonly(sql, 1_000_000)
    with engine.connect(read_only=True) as con:
        return con.execute(safe).pl()


def run_pipeline(base_table: str, layers: list[dict[str, Any]]) -> pl.DataFrame:
    """Execute chained layers; each layer sees the previous layer's output."""
    from . import remote
    current = _table_to_polars(base_table)
    for i, layer in enumerate(layers):
        kind = layer.get("type")
        if kind == "sql":
            # park the current frame as a temp DuckDB view, run SQL against it
            raw = layer["sql"].replace("{df}", f"layer_{i}")
            with engine.connect(hint=raw) as con:  # hint attaches remote sources when the SQL names a linked dataset
                con.register(f"layer_{i}", current.to_arrow())
                try:
                    current = con.execute(remote.rewrite_sql(validate_readonly(raw, 1_000_000))).pl()
                finally:
                    con.unregister(f"layer_{i}")
        elif kind == "python":
            current = run_python(layer["code"], current)
        else:
            raise ValueError(f"unknown layer type: {kind}")
    return current


def preview_transform(dataset_table: str, kind: str, payload: dict[str, Any],
                      limit: int = 200) -> dict[str, Any]:
    """Run a single layer against the base table and return a preview."""
    if kind == "python":
        df = run_python(payload["code"], _table_to_polars(dataset_table))
    elif kind == "sql":
        df = run_pipeline(dataset_table, [{"type": "sql", "sql": payload["sql"]}])
    else:
        raise ValueError(f"unknown kind {kind}")
    head = df.head(limit)
    return {
        "columns": head.columns,
        "rows": head.to_dicts(),
        "row_count": df.height,
        "preview_of": df.height,
    }


SNIPPETS = [
    {"name": "Extract date parts", "kind": "python",
     "description": "Add year, month, and weekday columns from a date column",
     "code": "result = df.with_columns([\n"
            "    pl.col('order_date').dt.year().alias('year'),\n"
            "    pl.col('order_date').dt.month().alias('month'),\n"
            "    pl.col('order_date').dt.strftime('%A').alias('weekday'),\n"
            "])"},
    {"name": "Fill nulls", "kind": "python",
     "description": "Replace nulls in a column with a fixed value",
     "code": "result = df.with_columns(\n"
            "    pl.col('amount').fill_null(0)\n"
            ")"},
    {"name": "Bin a numeric column", "kind": "python",
     "description": "Bucket values into labeled ranges",
     "code": "result = df.with_columns(\n"
            "    pl.col('amount').cut([100, 250], labels=['low', 'mid', 'high']).alias('amount_band')\n"
            ")"},
    {"name": "Computed ratio", "kind": "python",
     "description": "Create a new column from existing ones",
     "code": "result = df.with_columns(\n"
            "    (pl.col('amount') / pl.col('amount').sum()).alias('amount_share')\n"
            ")"},
    {"name": "Group & aggregate", "kind": "python",
     "description": "Aggregate by a dimension, Polars-style",
     "code": "result = df.group_by('region').agg([\n"
            "    pl.col('amount').sum().alias('revenue'),\n"
            "    pl.len().alias('orders'),\n"
            "])"},
    {"name": "Filter rows", "kind": "python",
     "description": "Keep only matching rows",
     "code": "result = df.filter(pl.col('status') == 'completed')"},
]
