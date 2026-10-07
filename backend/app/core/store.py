"""Metadata store backed by DuckDB.

Holds every platform entity (sources, datasets, columns, queries, charts,
dashboards, widgets, quality runs, AI provider configs). Column shapes mirror
what a future PostgreSQL migration would use (organization_id / workspace_id /
created_by present from day one).
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

import duckdb

from .config import settings

from .schema import MIGRATIONS, SCHEMA

DEFAULT_ORG = "org_local"
DEFAULT_WS = "ws_default"
DEFAULT_USER = "user_local"


class Store:
    """Thread-safe DuckDB metadata store with simple JSON-row helpers."""

    def __init__(self, path: str):
        self._path = path
        self._lock = threading.Lock()
        self._init()

    def _conn(self) -> duckdb.DuckDBPyConnection:
        return duckdb.connect(self._path)

    def _init(self) -> None:
        with self._lock, self._conn() as con:
            con.execute(SCHEMA)
            for sql in MIGRATIONS:
                try:
                    con.execute(sql)
                except Exception:
                    pass  # column already exists

    # -- generic helpers -------------------------------------------------
    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        row.setdefault("id", uuid.uuid4().hex[:12])
        now = datetime.now(timezone.utc)
        for col in ("created_at", "updated_at"):
            try:
                row.setdefault(col, now)
            except Exception:
                pass
        cols = ", ".join(row.keys())
        ph = ", ".join(["?"] * len(row))
        vals = [self._ser(v) for v in row.values()]
        with self._lock, self._conn() as con:
            try:
                con.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph})", vals)
            except duckdb.BinderException:
                # missing columns (e.g. updated_at) — drop unknown keys and retry
                cols_info = {r[1] for r in con.execute(f"PRAGMA table_info('{table}')").fetchall()}
                row = {k: v for k, v in row.items() if k in cols_info}
                cols = ", ".join(row.keys())
                ph = ", ".join(["?"] * len(row))
                vals = [self._ser(v) for v in row.values()]
                con.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph})", vals)
        return row

    def list(self, table: str, where: str = "", params: list | None = None,
             order: str = "created_at DESC") -> list[dict[str, Any]]:
        sql = f"SELECT * FROM {table}"
        if where:
            sql += f" WHERE {where}"
        if order:
            sql += f" ORDER BY {order}"
        with self._lock, self._conn() as con:
            rows = con.execute(sql, params or []).fetchall()
            cols = [d[0] for d in con.description]
        return [self._row(dict(zip(cols, r))) for r in rows]

    def get(self, table: str, row_id: str) -> dict[str, Any] | None:
        with self._lock, self._conn() as con:
            res = con.execute(f"SELECT * FROM {table} WHERE id = ?", [row_id]).fetchall()
            if not res:
                return None
            cols = [d[0] for d in con.description]
        return self._row(dict(zip(cols, res[0])))

    def update(self, table: str, row_id: str, patch: dict[str, Any]) -> None:
        if not patch:
            return
        sets = ", ".join(f"{k} = ?" for k in patch)
        vals = [self._ser(v) for v in patch.values()] + [row_id]
        with self._lock, self._conn() as con:
            con.execute(f"UPDATE {table} SET {sets} WHERE id = ?", vals)

    def delete(self, table: str, row_id: str) -> None:
        with self._lock, self._conn() as con:
            con.execute(f"DELETE FROM {table} WHERE id = ?", [row_id])

    def execute(self, sql: str, params: list | None = None) -> list[dict[str, Any]]:
        with self._lock, self._conn() as con:
            rows = con.execute(sql, params or []).fetchall()
            cols = [d[0] for d in con.description] if con.description else []
        return [self._row(dict(zip(cols, r))) for r in rows]

    # -- serialization ---------------------------------------------------
    @staticmethod
    def _ser(v: Any) -> Any:
        return json.dumps(v) if isinstance(v, (dict, list)) else v

    @staticmethod
    def _row(row: dict[str, Any]) -> dict[str, Any]:
        JSON_COLS = {
            "config", "sample_values", "spec", "layout", "pages", "position",
            "settings", "details", "state", "filters", "metric_refs", "layers",
            "history", "metric_refs"
        }
        out = {}
        for k, v in row.items():
            if k in JSON_COLS and isinstance(v, str) and v[:1] in ("{", "["):
                try:
                    v = json.loads(v)
                except Exception:
                    pass
            out[k] = v
        return out


store = Store(settings.metadata_db)
