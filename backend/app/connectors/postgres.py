"""PostgreSQL connector via DuckDB's postgres extension (read-only)."""
from __future__ import annotations

from typing import Any

from .base import DataConnector, ConnectorError
from .tls import postgres_ssl, sql_escape
from ..core.netguard import NetworkBlocked, ensure_public_host


def _check_host(c: dict[str, Any]) -> None:
    """Auth-enabled servers: no connections to private/internal hosts (a DSN is parsed for its host)."""
    host = c.get("host")
    if c.get("dsn"):
        from psycopg2.extensions import parse_dsn
        try:
            host = parse_dsn(c["dsn"]).get("host")
        except Exception as e:
            raise ConnectorError(f"invalid DSN: {e}") from e
    try:
        ensure_public_host(str(host or ""))
    except NetworkBlocked as e:
        raise ConnectorError(str(e)) from e


class PostgresConnector(DataConnector):
    def _attach(self, con, alias: str = "pg_src") -> str:
        c = self.config
        _check_host(c)
        dsn = c.get("dsn") or (
            f"host={c['host']} port={c.get('port', 5432)} dbname={c['database']} "
            f"user={c['user']} password={c.get('password', '')}{postgres_ssl(c)}"
        )
        con.execute("INSTALL postgres; LOAD postgres;")
        con.execute(f"ATTACH '{sql_escape(dsn)}' AS {alias} (TYPE postgres, READ_ONLY)")
        return alias

    def test_connection(self) -> dict[str, Any]:
        import duckdb
        try:
            con = duckdb.connect()
            alias = self._attach(con)
            con.execute(f"SELECT 1 FROM {alias}.information_schema.tables LIMIT 1")
            con.close()
            return {"ok": True, "detail": "connected"}
        except Exception as e:
            return {"ok": False, "detail": str(e)}

    def discover(self) -> list[dict[str, Any]]:
        import duckdb
        con = duckdb.connect()
        try:
            alias = self._attach(con)
            rows = con.execute(
                f"SELECT table_schema, table_name FROM {alias}.information_schema.tables "
                "WHERE table_schema NOT IN ('pg_catalog','information_schema')"
            ).fetchall()
            return [{"name": f"{s}.{t}", "kind": "table"} for s, t in rows]
        except Exception as e:
            raise ConnectorError(str(e)) from e
        finally:
            con.close()

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        alias = self._attach(analytics_con)
        schema, _, table = name.partition(".")
        if not table:
            schema, table = "public", schema
        analytics_con.execute(
            f"CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM {alias}.{schema}.{table}"
        )
        info = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {
            "row_count": count,
            "columns": [{"name": r[1], "dtype": r[2]} for r in info],
        }
