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

from . import tenant
from .config import settings

from .schema import MIGRATIONS, SCHEMA

DEFAULT_ORG = "org_local"
DEFAULT_WS = tenant.DEFAULT_WS
DEFAULT_USER = "user_local"


class Store:
    """Thread-safe DuckDB metadata store with simple JSON-row helpers."""

    def __init__(self, path: str):
        self._path = path
        self._lock = threading.Lock()
        self._versions: dict[str, int] = {}  # table -> write counter, so caches built from a table can tell it changed
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
            # rows written before per-user workspaces have workspace_id NULL: they belong to the legacy default
            # workspace, otherwise the workspace filter would hide them (idempotent)
            tables = [r[0] for r in con.execute(
                "SELECT table_name FROM information_schema.columns WHERE column_name = 'workspace_id'").fetchall()]
            for t in tables:
                con.execute(f"UPDATE {t} SET workspace_id = '{DEFAULT_WS}' WHERE workspace_id IS NULL")

    def version(self, table: str) -> int:
        return self._versions.get(table, 0)

    def _bump(self, table: str) -> None:
        self._versions[table] = self._versions.get(table, 0) + 1

    # -- generic helpers -------------------------------------------------
    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        row.setdefault("id", uuid.uuid4().hex[:12])
        if tenant.is_scoped():
            row["workspace_id"] = tenant.current()  # always the caller's own workspace, whatever the router passed
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
        self._bump(table)
        return row

    def list(self, table: str, where: str = "", params: list | None = None,
             order: str = "created_at DESC") -> list[dict[str, Any]]:
        where, params = self._scoped(where, params or [])
        sql = f"SELECT * FROM {table}"
        if where:
            sql += f" WHERE {where}"
        if order:
            sql += f" ORDER BY {order}"
        with self._lock, self._conn() as con:
            rows = con.execute(sql, params).fetchall()
            cols = [d[0] for d in con.description]
        return [self._row(dict(zip(cols, r))) for r in rows]

    def get(self, table: str, row_id: str) -> dict[str, Any] | None:
        with self._lock, self._conn() as con:
            where, params = self._scoped("id = ?", [row_id])
            res = con.execute(f"SELECT * FROM {table} WHERE {where}", params).fetchall()
            if not res:
                return None
            cols = [d[0] for d in con.description]
        return self._row(dict(zip(cols, res[0])))

    def update(self, table: str, row_id: str, patch: dict[str, Any]) -> None:
        if not patch:
            return
        sets = ", ".join(f"{k} = ?" for k in patch)
        where, params = self._scoped("id = ?", [row_id])
        vals = [self._ser(v) for v in patch.values()] + params
        with self._lock, self._conn() as con:
            con.execute(f"UPDATE {table} SET {sets} WHERE {where}", vals)
        self._bump(table)

    def delete(self, table: str, row_id: str) -> None:
        where, params = self._scoped("id = ?", [row_id])
        with self._lock, self._conn() as con:
            con.execute(f"DELETE FROM {table} WHERE {where}", params)
        self._bump(table)

    @staticmethod
    def _scoped(where: str, params: list) -> tuple[str, list]:
        """AND the caller's workspace onto a WHERE clause (no-op for system code under all_workspaces())."""
        ws = tenant.current()
        if ws == tenant.ALL:
            return where, list(params)
        return (f"({where}) AND workspace_id = ?" if where else "workspace_id = ?"), [*params, ws]

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
