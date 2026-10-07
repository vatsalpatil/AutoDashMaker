"""MySQL connector via DuckDB's mysql extension (read-only)."""
from __future__ import annotations

from typing import Any

from .base import DataConnector, ConnectorError
from .tls import mysql_ssl, sql_escape
from ..core.netguard import NetworkBlocked, ensure_public_host


class MySQLConnector(DataConnector):
    def _attach(self, con, alias: str = "mysql_src") -> str:
        c = self.config
        try:
            ensure_public_host(str(c.get("host", "")))
        except NetworkBlocked as e:
            raise ConnectorError(str(e)) from e
        con.execute("INSTALL mysql; LOAD mysql;")
        dsn = (
            f"host={sql_escape(c['host'])} port={c.get('port', 3306)} "
            f"database={sql_escape(c['database'])} user={sql_escape(c['user'])} "
            f"password={sql_escape(c.get('password', ''))}{mysql_ssl(c)}"
        )
        try:
            con.execute(f"ATTACH '{dsn}' AS {alias} (TYPE mysql, READ_ONLY)")
            con.execute(f"SHOW TABLES FROM {alias}").fetchone()  # the first query opens the READ ONLY transaction
        except Exception as e:
            # Some MySQL-compatible servers (TiDB) reject that transaction. We only ever run SELECTs against the
            # attached database (every statement passes validate_readonly), so a plain attach is equivalent.
            if "READ ONLY" not in str(e).upper() and "NOOP" not in str(e).upper():
                raise
            try:
                con.execute(f"DETACH {alias}")
            except Exception:
                pass  # the failed attach may not have registered
            con.execute(f"ATTACH '{dsn}' AS {alias} (TYPE mysql)")
        return alias

    def count_rows(self, con, alias: str, view_name: str, name: str) -> int:
        # DuckDB's MySQL scanner fails (internal binder error) on a bare COUNT(*) over a remote table: count remotely
        table = "`" + name.replace("`", "``") + "`"
        return int(con.execute("SELECT * FROM mysql_query(?, ?)", [alias, f"SELECT COUNT(*) FROM {table}"]).fetchone()[0])

    def remote_profile(self, con, alias: str, name: str, columns: list[str]) -> dict[str, tuple[int, int]] | None:
        q = lambda n: "`" + n.replace("`", "``") + "`"
        aggs = ", ".join(f"COUNT(*) - COUNT({q(c)}), COUNT(DISTINCT {q(c)})" for c in columns)
        row = con.execute("SELECT * FROM mysql_query(?, ?)", [alias, f"SELECT {aggs} FROM {q(name)}"]).fetchone()
        return {c: (int(row[2 * i]), int(row[2 * i + 1])) for i, c in enumerate(columns)}

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
            try:
                # only the configured database's own tables (SHOW TABLES also lists information_schema & friends)
                sql = ("SELECT table_name FROM information_schema.tables "
                       f"WHERE table_schema = '{sql_escape(self.config['database'])}' ORDER BY table_name")
                rows = con.execute("SELECT * FROM mysql_query(?, ?)", [alias, sql]).fetchall()
            except Exception:
                rows = con.execute(f"SHOW TABLES FROM {alias}").fetchall()
            return [{"name": r[0], "kind": "table"} for r in rows]
        except Exception as e:
            raise ConnectorError(str(e)) from e
        finally:
            con.close()

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        alias = self._attach(analytics_con)
        analytics_con.execute(
            f'CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM {alias}."{name.replace(chr(34), chr(34) * 2)}"'
        )
        info = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {
            "row_count": count,
            "columns": [{"name": r[1], "dtype": r[2]} for r in info],
        }
