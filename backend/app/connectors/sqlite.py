"""SQLite connector: attach a .db/.sqlite file and ingest tables (read-only)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .base import DataConnector, ConnectorError


class SQLiteConnector(DataConnector):
    def _attach(self, con, alias: str = "sqlite_src") -> str:
        path = self.config["path"]
        if not Path(path).exists():
            raise ConnectorError(f"file missing: {path}")
        con.execute("INSTALL sqlite; LOAD sqlite;")
        con.execute(f"ATTACH '{path}' AS {alias} (TYPE sqlite, READ_ONLY)")
        return alias

    def test_connection(self) -> dict[str, Any]:
        import duckdb
        try:
            con = duckdb.connect()
            alias = self._attach(con)
            con.execute(f"SHOW TABLES FROM {alias}").fetchone()
            con.close()
            return {"ok": True, "detail": "connected"}
        except Exception as e:
            return {"ok": False, "detail": str(e)}

    def discover(self) -> list[dict[str, Any]]:
        import duckdb
        con = duckdb.connect()
        try:
            alias = self._attach(con)
            rows = con.execute(f"SHOW TABLES FROM {alias}").fetchall()
            return [{"name": r[0], "kind": "table"} for r in rows]
        except Exception as e:
            raise ConnectorError(str(e)) from e
        finally:
            con.close()

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        alias = self._attach(analytics_con)
        analytics_con.execute(
            f"CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM {alias}.{name}"
        )
        info = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {
            "row_count": count,
            "columns": [{"name": r[1], "dtype": r[2]} for r in info],
        }
