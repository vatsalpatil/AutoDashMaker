"""Parquet-backed dataset storage.

A dataset's rows live in one zstd-compressed Parquet file in the user's folder; its `ds_*` name in the analytics DuckDB
is a VIEW over that file, so queries, schema profiling and charts work unchanged. Compared with a DuckDB table the file
is smaller, deleting it frees the space at once, and quotas are just file sizes.
"""
from __future__ import annotations

import os
from pathlib import Path

import duckdb

from ..core import tenant
from . import quota


def parquet_path(table: str) -> Path:
    return tenant.parquet_dir() / f"{table}.parquet"


def _lit(path: Path) -> str:
    return str(path).replace("\\", "/").replace("'", "''")


def drop_relation(con: duckdb.DuckDBPyConnection, name: str) -> None:
    """Drop `name` whether it is a table or a view (DROP of the wrong kind raises a CatalogException)."""
    for kind in ("VIEW", "TABLE"):
        try:
            con.execute(f"DROP {kind} IF EXISTS {name}")
        except duckdb.CatalogException:
            pass


def publish(con: duckdb.DuckDBPyConnection, staging: str, table: str) -> None:
    """Move the rows of the staging table into `table`'s Parquet file and point `table` (a view) at it.

    The new file is written beside the old one and swapped in only after the quota check, so a failed refresh
    leaves the previous data untouched."""
    final = parquet_path(table)
    tmp = final.with_name(final.name + ".tmp")
    try:
        con.execute(f"COPY {staging} TO '{_lit(tmp)}' (FORMAT parquet, COMPRESSION zstd)")
        quota.ensure_fits(tmp.stat().st_size - (final.stat().st_size if final.exists() else 0))
        os.replace(tmp, final)
    finally:
        tmp.unlink(missing_ok=True)
        drop_relation(con, staging)
    drop_relation(con, table)
    con.execute(f"CREATE VIEW {table} AS SELECT * FROM read_parquet('{_lit(final)}')")


def remove(table: str) -> None:
    """Delete the dataset's file (after its view has been dropped)."""
    parquet_path(table).unlink(missing_ok=True)
