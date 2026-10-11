"""MySQL connector via DuckDB's mysql extension (read-only)."""
from __future__ import annotations

from typing import Any

from .base import DataConnector, ConnectorError, redact
from .tls import mysql_ssl, sql_escape
from ..core.netguard import NetworkBlocked, ensure_public_host


SYSTEM_DBS = ("information_schema", "mysql", "performance_schema", "sys", "metrics_schema", "inspection_schema")


def _q(n: str) -> str:
    return "`" + n.replace("`", "``") + "`"


class MySQLConnector(DataConnector):
    def _databases(self) -> list[str]:
        """The configured database field: one name, several separated by commas, or * for every database."""
        return [d.strip() for d in str(self.config.get("database", "")).split(",") if d.strip()]

    def _qualified(self, name: str) -> str:
        """`db`.`table` for a 'db.table' name (several databases), `table` for a plain one."""
        return ".".join(_q(p) for p in (name.split(".", 1) if self._multi else [name]))

    @property
    def _multi(self) -> bool:
        dbs = self._databases()
        return len(dbs) > 1 or dbs == ["*"]

    def _attach(self, con, alias: str = "mysql_src") -> str:
        c = self.config
        try:
            ensure_public_host(str(c.get("host", "")))
        except NetworkBlocked as e:
            raise ConnectorError(str(e)) from e
        con.execute("INSTALL mysql; LOAD mysql;")
        dsn = (
            f"host={sql_escape(c['host'])} port={c.get('port', 3306)} "
            f"database={sql_escape(self._default_db())} user={sql_escape(c['user'])} "
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

    def _default_db(self) -> str:
        dbs = self._databases()
        return dbs[0] if dbs and dbs[0] != "*" else "information_schema"  # '*': connect anywhere, then list every database

    def count_rows(self, con, alias: str, view_name: str, name: str) -> int:
        # DuckDB's MySQL scanner fails (internal binder error) on a bare COUNT(*) over a remote table: count remotely
        table = self._qualified(name)
        return int(con.execute("SELECT * FROM mysql_query(?, ?)", [alias, f"SELECT COUNT(*) FROM {table}"]).fetchone()[0])

    def remote_profile(self, con, alias: str, name: str, columns: list[str]) -> dict[str, tuple[int, int]] | None:
        q = _q
        aggs = ", ".join(f"COUNT(*) - COUNT({q(c)}), COUNT(DISTINCT {q(c)})" for c in columns)
        row = con.execute("SELECT * FROM mysql_query(?, ?)", [alias, f"SELECT {aggs} FROM {self._qualified(name)}"]).fetchone()
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
            return {"ok": False, "detail": redact(str(e))}

    def discover(self) -> list[dict[str, Any]]:
        import duckdb
        con = duckdb.connect()
        try:
            alias = self._attach(con)
            dbs = self._databases()
            if dbs == ["*"]:
                cond = "table_schema NOT IN (" + ", ".join(f"'{d}'" for d in SYSTEM_DBS) + ")"
            else:
                cond = "table_schema IN (" + ", ".join(f"'{sql_escape(d)}'" for d in dbs) + ")"
            try:
                # only the chosen databases' tables (SHOW TABLES also lists information_schema & friends)
                sql = f"SELECT table_schema, table_name FROM information_schema.tables WHERE {cond} ORDER BY table_schema, table_name"
                rows = con.execute("SELECT * FROM mysql_query(?, ?)", [alias, sql]).fetchall()
            except Exception:
                if self._multi:
                    raise
                rows = [(None, r[0]) for r in con.execute(f"SHOW TABLES FROM {alias}").fetchall()]
            # several databases: 'db.table' so equal table names stay apart; one database keeps plain names
            return [{"name": f"{s}.{t}" if self._multi else t, "kind": "table"} for s, t in rows]
        except Exception as e:
            raise ConnectorError(str(e)) from e
        finally:
            con.close()

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        alias = self._attach(analytics_con)
        ref = ".".join('"' + p.replace('"', '""') + '"' for p in (name.split(".", 1) if self._multi else [name]))
        analytics_con.execute(f"CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM {alias}.{ref}")
        info = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {
            "row_count": count,
            "columns": [{"name": r[1], "dtype": r[2]} for r in info],
        }
