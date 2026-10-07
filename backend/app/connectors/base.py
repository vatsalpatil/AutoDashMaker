"""Connector interface — every data source implements this contract."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class ConnectorError(Exception):
    pass


class DataConnector(ABC):
    def __init__(self, config: dict[str, Any]):
        self.config = config

    @abstractmethod
    def test_connection(self) -> dict[str, Any]:
        """Verify the source is reachable. Returns {'ok': bool, 'detail': str}."""

    @abstractmethod
    def discover(self) -> list[dict[str, Any]]:
        """List available tables/files: [{'name': ..., 'kind': ...}]."""

    def attach(self, con, alias: str) -> str:
        """Attach the remote database to `con` under `alias` (database connectors only)."""
        fn = getattr(self, "_attach", None)
        if not fn:
            raise ConnectorError("this source type cannot be linked live; import a copy instead")
        return fn(con, alias)

    def link(self, name: str, view_name: str, con, alias: str) -> None:
        """Create VIEW `view_name` over remote table `name` (no rows are copied)."""
        self.attach(con, alias)
        ref = ".".join('"' + part.replace('"', '""') + '"' for part in name.split("."))
        con.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM {alias}.{ref}")

    def count_rows(self, con, alias: str, view_name: str, name: str) -> int:
        """Row count of a linked table (connectors whose scanner cannot do COUNT(*) override this)."""
        return int(con.execute(f"SELECT COUNT(*) FROM {view_name}").fetchone()[0])

    def remote_profile(self, con, alias: str, name: str, columns: list[str]) -> dict[str, tuple[int, int]] | None:
        """Exact (nulls, distinct) per column computed by the source itself, so no rows travel; None = not supported."""
        return None

    @abstractmethod
    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        """Materialize the source into the analytics DuckDB as `target_table`.

        Returns {'row_count': int, 'columns': [{'name','dtype'}]}.
        """


def http_retry(call, attempts: int = 3, base_delay: float = 1.0):
    """Run an httpx call, retrying transient failures (network errors, 429/5xx) with backoff."""
    import time
    import httpx

    for i in range(attempts):
        last = i == attempts - 1
        try:
            resp = call()
        except httpx.TransportError:
            if last:
                raise
        else:
            if resp.status_code not in (429, 500, 502, 503, 504) or last:
                return resp
        time.sleep(base_delay * 2 ** i)
