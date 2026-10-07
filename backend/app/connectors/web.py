"""Web file connectors: direct file URLs and Google Sheets.

Google Sheets: paste a sharing link; we convert it to the CSV export URL.
The sheet must be shared as 'Anyone with the link can view' (public sheets
are the common self-serve case; service-account auth can come later).

Direct URL: any HTTP(S) link to a CSV / TSV / Parquet / JSON / Excel file.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import httpx

from ..core.config import settings
from .base import DataConnector, ConnectorError, http_retry
from .files import FileConnector
from ..core import tenant
from ..core.netguard import safe_client


def _gsheet_csv_url(url: str) -> str | None:
    m = re.search(r"docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if not m:
        return None
    gid_m = re.search(r"[#&?]gid=(\d+)", url)
    gid = gid_m.group(1) if gid_m else "0"
    return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv&gid={gid}"


class UrlConnector(DataConnector):
    """Downloads a file from a URL into uploads/, then reads it like a file."""

    def _download(self) -> Path:
        url = self.config["url"]
        if self.config.get("type_hint") == "gsheets" or "docs.google.com" in url:
            url = _gsheet_csv_url(url) or url
        try:
            def get():
                with safe_client(follow_redirects=True, timeout=60) as client:
                    return client.get(url)
            resp = http_retry(get)
            resp.raise_for_status()
        except Exception as e:
            raise ConnectorError(f"download failed: {e}") from e

        # infer extension
        ext = Path(url.split("?")[0]).suffix.lower()
        if "format=csv" in url:
            ext = ".csv"
        if ext not in FileConnector.READERS:
            ctype = resp.headers.get("content-type", "")
            ext = {  # fall back to content-type sniffing
                "text/csv": ".csv", "application/json": ".json",
                "application/vnd.apache.parquet": ".parquet",
                "application/octet-stream": ".parquet",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            }.get(ctype.split(";")[0], ".csv")

        name = re.sub(r"[^a-zA-Z0-9_-]", "_", self.config.get("name", "download"))[:40]
        dest = tenant.upload_dir() / f"{name}{ext}"
        dest.write_bytes(resp.content)
        return dest

    def _file_connector(self) -> FileConnector:
        return FileConnector({"path": str(self._download())})

    def test_connection(self) -> dict[str, Any]:
        try:
            p = self._download()
            return {"ok": True, "detail": f"downloaded {p.name} ({p.stat().st_size:,} bytes)"}
        except ConnectorError as e:
            return {"ok": False, "detail": str(e)}

    def discover(self) -> list[dict[str, Any]]:
        return self._file_connector().discover()

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        return self._file_connector().ingest(name, target_table, analytics_con)
