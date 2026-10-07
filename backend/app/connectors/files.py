"""File connector: CSV / Excel / Parquet / JSON, read via DuckDB."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .base import DataConnector, ConnectorError
from ..core.netguard import NetworkBlocked, confine_path


class FileConnector(DataConnector):
    READERS = {
        ".csv": "read_csv_auto('{path}')",
        ".tsv": "read_csv_auto('{path}', delim='\\t')",
        ".parquet": "read_parquet('{path}')",
        ".json": "read_json_auto('{path}')",
        ".ndjson": "read_json_auto('{path}')",
        ".xlsx": "read_xlsx('{path}')",
        ".xls": "read_xlsx('{path}')",
    }

    def _reader(self, path: Path) -> str:
        ext = path.suffix.lower()
        if ext not in self.READERS:
            raise ConnectorError(f"Unsupported file type: {ext}")
        return self.READERS[ext].format(path=str(path).replace("\\", "/"))

    def _path(self) -> Path:
        try:
            return confine_path(self.config["path"])
        except NetworkBlocked as e:
            raise ConnectorError(str(e)) from e

    def test_connection(self) -> dict[str, Any]:
        p = self._path()
        ok = p.exists()
        return {"ok": ok, "detail": f"{p.name} found" if ok else f"file missing: {p}"}

    def discover(self) -> list[dict[str, Any]]:
        p = self._path()
        return [{"name": p.stem, "kind": p.suffix.lstrip(".").lower()}] if p.exists() else []

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        path = self._path()
        if not path.exists():
            raise ConnectorError(f"file missing: {path}")
        reader = self._reader(path)
        analytics_con.execute(f"CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM {reader}")
        info = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {
            "row_count": count,
            "columns": [{"name": r[1], "dtype": r[2]} for r in info],
        }
