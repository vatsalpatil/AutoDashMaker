"""Shared test setup: an isolated temp workspace and one-line datasets.

    from helpers import isolated, make_dataset     # FIRST import in a test file (before any `app` import)
    isolated()                                      # temp metadata/analytics/upload dirs for this process
    orders = make_dataset("orders", "SELECT * FROM (VALUES ('O1', 'Completed', 10.0)) t(order_id, status, amount)")

make_dataset creates the DuckDB table, registers the dataset and writes real column statistics (types, distinct counts,
sample values) exactly like an upload does, so tests see what production code sees.
"""
from __future__ import annotations

import os
import sys
import tempfile
from typing import Any

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def isolated() -> str:
    """Point every store at a fresh temp dir (verify.py does the same per process). Returns the dir."""
    if BACKEND not in sys.path:
        sys.path.insert(0, BACKEND)
    if "app" in sys.modules:
        raise RuntimeError("call isolated() before importing app: the stores read their paths at import time")
    tmp = tempfile.mkdtemp(prefix="dashtor_test_")
    os.environ.update(METADATA_DB=f"{tmp}/m.duckdb", ANALYTICS_DB=f"{tmp}/a.duckdb", UPLOAD_DIR=f"{tmp}/up",
                      DUCKDB_TEMP_DIR=f"{tmp}/s", DISK_USAGE_LIMIT_PCT=os.environ.get("DISK_USAGE_LIMIT_PCT", "99"))
    return tmp


def make_dataset(name: str, select_sql: str, folder: str | None = None, **fields: Any) -> dict[str, Any]:
    """CREATE TABLE ds_<name> AS <select_sql>, register it as dataset `name` with full column statistics."""
    from app.core.store import store
    from app.services.engine import engine
    table = f"ds_{name}"
    with engine.writer() as con:
        con.execute(f"CREATE OR REPLACE TABLE {table} AS {select_sql}")
    schema = engine.describe_table(table)
    ds = store.insert("datasets", {"name": name, "physical_name": table, "row_count": schema["row_count"],
                                   "column_count": len(schema["columns"]), "kind": "file", "folder": folder, **fields})
    for c in schema["columns"]:
        store.insert("columns_meta", {"dataset_id": ds["id"], **c})
    return ds
