"""WebSocket connector: a live feed becomes a table by capturing a bounded window of messages.

A stream never "ends", so each import / refresh takes one snapshot: connect, optionally send a subscribe message,
collect messages until `max_messages` (default 1,000, cap 50,000) or `seconds` (default 10, cap 60), then disconnect.
JSON messages become rows (an array in a message becomes several rows); other text becomes a `message` column.
Every row gets `received_at`. Schedule refreshes (Data Sources -> freshness) to keep it current; each refresh
replaces the snapshot, so storage stays bounded. Only public ws:// / wss:// hosts are allowed when auth is on.

config: {url, subscribe?: str|object, headers?: {}, max_messages?, seconds?, record_path?}
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

from .base import ConnectorError, DataConnector
from .rest import find_records, flatten
from ..core.netguard import NetworkBlocked, ensure_public_host


def _caps(cfg: dict) -> tuple[int, float]:
    return max(1, min(int(cfg.get("max_messages") or 1000), 50_000)), max(1.0, min(float(cfg.get("seconds") or 10), 60.0))


def _rows(msg: str | bytes, record_path: str) -> list[dict]:
    try:
        data = json.loads(msg)
    except (ValueError, TypeError):
        return [{"message": msg.decode(errors="replace") if isinstance(msg, bytes) else msg}]
    if record_path:
        for part in record_path.strip(".").split("."):
            data = data.get(part) if isinstance(data, dict) else None
    elif isinstance(data, dict) and (found := find_records(data)) and found[0]:
        data = found[1]
    items = data if isinstance(data, list) else [data]
    return [flatten(x, "_") if isinstance(x, dict) else {"value": x} for x in items if x is not None]


class WebSocketConnector(DataConnector):
    def _check_url(self) -> str:
        url = (self.config.get("url") or "").strip()
        parts = urlsplit(url)
        if parts.scheme not in ("ws", "wss") or not parts.hostname:
            raise ConnectorError("a WebSocket URL starts with ws:// or wss://")
        try:
            ensure_public_host(parts.hostname)
        except NetworkBlocked as e:
            raise ConnectorError(str(e)) from e
        return url

    def capture(self, max_messages: int | None = None, seconds: float | None = None) -> list[dict]:
        from websockets.sync.client import connect
        cap_n, cap_s = _caps({**self.config, **({"max_messages": max_messages} if max_messages else {}),
                              **({"seconds": seconds} if seconds else {})})
        url, rows, deadline = self._check_url(), [], time.monotonic() + cap_s
        sub = self.config.get("subscribe")
        try:
            with connect(url, additional_headers=self.config.get("headers") or None, open_timeout=10,
                         max_size=4 * 1024 * 1024) as ws:
                if sub not in (None, ""):
                    ws.send(sub if isinstance(sub, str) else json.dumps(sub))
                count = 0
                while count < cap_n and (left := deadline - time.monotonic()) > 0:
                    try:
                        msg = ws.recv(timeout=left)
                    except TimeoutError:
                        break
                    count += 1
                    now = datetime.now(timezone.utc).isoformat()
                    rows += [{**r, "received_at": now} for r in _rows(msg, self.config.get("record_path", ""))]
        except ConnectorError:
            raise
        except Exception as e:  # handshake refused, DNS, TLS, closed early...
            if not rows:
                raise ConnectorError(f"websocket failed: {e}") from e
        return rows

    def test_connection(self) -> dict[str, Any]:
        try:
            rows = self.capture(max_messages=5, seconds=5)
        except ConnectorError as e:
            return {"ok": False, "detail": str(e)}
        if not rows:
            return {"ok": True, "detail": "connected, but no messages arrived in 5s (does the feed need a subscribe message?)"}
        return {"ok": True, "detail": f"connected; received {len(rows)} rows, columns: {', '.join(list(rows[0])[:8])}"}

    def discover(self) -> list[dict[str, Any]]:
        return [{"name": self.config.get("name") or "stream", "kind": "stream"}]

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        rows = self.capture()
        if not rows:
            raise ConnectorError("no messages arrived during the capture window; send a subscribe message or capture longer")
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(rows, f)
            tmp = f.name
        try:
            analytics_con.execute(f"CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM read_json_auto('{tmp.replace(chr(92), '/')}')")
        finally:
            os.unlink(tmp)
        cols = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {"row_count": count, "columns": [{"name": r[1], "dtype": r[2]} for r in cols]}
