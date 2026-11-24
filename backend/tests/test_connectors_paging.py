"""Connectors: REST pagination (skip/limit, next link, cursor; stops on repeats and caps), WebSocket capture,
unknown source types are a 400, httpx's docs-link noise is trimmed from errors.
Run: backend/.venv/Scripts/python.exe tests/test_connectors_paging.py"""
from helpers import isolated
isolated()

import asyncio
import json
import threading

from app.connectors import paging
from app.connectors.base import ConnectorError
from app.connectors.stream import WebSocketConnector

DATA = [{"id": i} for i in range(23)]


def offset_api(url, extra):   # DummyJSON shape: {items, total, skip, limit}
    skip, lim = extra.get("skip", 0), extra.get("limit", 10)
    return {"items": DATA[skip:skip + lim], "total": 23, "skip": skip, "limit": lim}, None


ext = lambda d: d["items"]  # noqa: E731
rows, info = paging.fetch_all(offset_api, ext, {"mode": "auto"})
assert len(rows) == 23 and info["mode"] == "offset" and info["pages"] == 3, info


def link_api(url, extra):   # body next link
    page = int((url or "?p=0").split("=")[1])
    return {"items": DATA[page * 10:page * 10 + 10], "next": f"?p={page + 1}" if page < 2 else None}, None


rows, info = paging.fetch_all(link_api, ext, None)
assert len(rows) == 23 and info["mode"] == "next_link", info


def cursor_api(url, extra):
    c = int(extra.get("next_cursor", 0))
    return {"items": DATA[c:c + 10], "meta": {"next_cursor": str(c + 10) if c + 10 < 23 else None}}, None


rows, info = paging.fetch_all(cursor_api, ext, {})
assert len(rows) == 23 and info["mode"] == "cursor", info

stubborn = lambda url, extra: ({"items": DATA[:10], "next": "?again"}, None)   # ignores paging: stop, don't loop  # noqa: E731
rows, info = paging.fetch_all(stubborn, ext, {})
assert len(rows) == 10 and info["pages"] == 1, info

rows, info = paging.fetch_all(offset_api, ext, {"mode": "auto", "max_pages": 2})
assert len(rows) == 20 and info["truncated"], info

assert paging.fetch_all(lambda u, e: ({"items": DATA[:5]}, None), ext, {})[1]["mode"] == "none"   # complete reply

assert "For more information" not in str(ConnectorError("Client error '404'\nFor more information check: https://x"))

# WebSocket: a local echo-ish server pushing JSON ticks
from websockets.sync.server import serve


def handler(ws):
    from websockets.exceptions import ConnectionClosed
    try:
        sub = ws.recv()
        for i in range(7):
            ws.send(json.dumps({"seq": i, "channel": json.loads(sub)["channel"], "px": {"bid": i * 1.5}}))
        ws.send("plain text")
    except ConnectionClosed:   # the client stops early at its max_messages cap
        pass


srv = serve(handler, "127.0.0.1", 0)
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.socket.getsockname()[1]
c = WebSocketConnector({"url": f"ws://127.0.0.1:{port}", "subscribe": {"channel": "trades"}, "seconds": 3, "max_messages": 100})
rows = c.capture()
assert len(rows) == 8 and rows[0]["channel"] == "trades" and rows[2]["px_bid"] == 3.0 and rows[-1]["message"] == "plain text", rows
assert "received_at" in rows[0]
assert len(WebSocketConnector({**c.config, "max_messages": 3}).capture()) == 3
assert not WebSocketConnector({"url": "https://x"}).test_connection()["ok"]
srv.shutdown()

from starlette.testclient import TestClient
import Main
r = TestClient(Main.app).post("/api/sources/test", json={"name": "x", "type": "kafka", "config": {}})
assert r.status_code == 400 and "websocket" in r.json()["detail"], r.json()
print("test_connectors_paging OK")
