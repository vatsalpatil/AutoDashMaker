"""API Studio backend: proxy, records->dataset, REST (smart record path) and GraphQL connectors.
Run: backend/.venv/Scripts/python.exe tests/test_studio.py"""
import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
tmp = tempfile.mkdtemp()  # never touch the real databases
os.environ["ANALYTICS_DB"] = os.path.join(tmp, "analytics.duckdb")
os.environ["METADATA_DB"] = os.path.join(tmp, "metadata.duckdb")
os.environ["DUCKDB_TEMP_DIR"] = os.path.join(tmp, "spill")
os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")

ITEMS = [{"id": i, "name": f"n{i}", "meta": {"score": i * 1.5, "tags": ["a", "b"]}} for i in range(1, 6)]


class H(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/pg"):  # 3 pages of 2 records: /pg?page=N, with a `next` URL until the last page
            n = int(self.path.split("page=")[1]) if "page=" in self.path else 1
            nxt = f"/pg?page={n + 1}" if n < 3 else None
            return self._send({"data": ITEMS[(n - 1) * 2: n * 2], "next": nxt})
        if self.path.startswith("/sse"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Connection", "close")
            self.end_headers()
            for i in range(3):
                self.wfile.write(f"data: tick {i}\n\n".encode())
                self.wfile.flush()
            return
        if self.path.startswith("/cnt"):  # no next link: pages end when empty
            n = int(self.path.split("page=")[1]) if "page=" in self.path else 1
            return self._send({"items": ITEMS[(n - 1) * 2: n * 2] if n <= 3 else []})
        self._send({"page": 1, "payload": {"items": ITEMS}}) if self.path.startswith("/items") else self._send({"error": "nope"}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if self.path == "/graphql":
            if "boom" in body.get("query", ""):
                return self._send({"errors": [{"message": "Cannot query field boom"}]})
            return self._send({"data": {"products": ITEMS[:3]}})
        self._send({"echo": body, "auth": self.headers.get("Authorization")})

    def log_message(self, *a):
        pass


srv = HTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_port}"

from app.connectors import get_connector
from app.core.store import store
from app.services.engine import engine
from app.services.http_proxy import ProxyError, check_url, send
from app.services.ingest import ingest_source

# 1. proxy: status/timing/body, POST body + headers, 404 is a reply (not an error), bad URLs refused
r = send("GET", f"{base}/items")
assert r["status"] == 200 and r["ok"] and json.loads(r["body"])["page"] == 1 and r["elapsed_ms"] >= 0, r
r = send("POST", f"{base}/echo", {"Authorization": "Bearer x", "Content-Type": "application/json"}, '{"a": 1}')
assert json.loads(r["body"]) == {"echo": {"a": 1}, "auth": "Bearer x"}, r["body"]
assert send("GET", f"{base}/missing")["status"] == 404
for bad in ("file:///etc/passwd", "ftp://x", "http://169.254.169.254/latest/meta-data", "not a url"):
    try:
        check_url(bad)
        raise SystemExit(f"should refuse {bad}")
    except ProxyError:
        pass

# 2. REST connector without a record path finds the array itself; test_connection says what it found
src = {"id": "s1", "name": "api", "type": "rest", "config": {"url": f"{base}/items", "flatten_sep": "_"}}
t = get_connector("rest", src["config"]).test_connection()
assert t["ok"] and "5 records" in t["detail"] and "payload.items" in t["detail"], t
with engine.writer() as con:
    out = get_connector("rest", src["config"]).ingest("api", "t_rest", con)
cols = [c["name"] for c in out["columns"]]
assert out["row_count"] == 5 and "meta_score" in cols and "meta_tags" in cols, out

# 3. GraphQL connector: POST {query, variables}, records found under data, errors surfaced
gq = {"url": f"{base}/graphql", "query": "{ products { id name meta { score } } }", "variables": {}}
with engine.writer() as con:
    out = get_connector("graphql", {**gq, "flatten_sep": "_"}).ingest("gql", "t_gql", con)
assert out["row_count"] == 3 and "meta_score" in [c["name"] for c in out["columns"]], out
bad = get_connector("graphql", {**gq, "query": "{ boom }"}).test_connection()
assert not bad["ok"] and "Cannot query field boom" in bad["detail"], bad

# 4. a saved source ingests like any other and refreshes; records-to-dataset flattens and registers a file dataset
ds = ingest_source(store.insert("datasources", {"name": "api", "type": "rest", "config": src["config"]}), "api_items")
assert ds["row_count"] == 5, ds
from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
res = c.post("/api/studio/records-to-dataset", json={"name": "my records", "records": ITEMS})
assert res.status_code == 200, res.text
made = res.json()
assert made["row_count"] == 5 and "meta_score" in [x["name"] for x in made["columns"]], made
assert c.post("/api/studio/records-to-dataset", json={"name": "x", "records": []}).status_code == 400
assert c.post("/api/studio/request", json={"url": "ftp://x"}).status_code == 400
ok = c.post("/api/studio/request", json={"method": "GET", "url": f"{base}/items"}).json()
assert ok["status"] == 200 and ok["size"] > 10, ok
# 5. pagination: follow `next` URLs; or count a page parameter up until an empty page
pg = c.post("/api/studio/pages", json={"url": f"{base}/pg"}).json()
assert pg["pages"] == 3 and [r["id"] for r in pg["records"]] == [1, 2, 3, 4, 5], pg
cnt = c.post("/api/studio/pages", json={"url": f"{base}/cnt", "page_param": "page"}).json()
assert cnt["pages"] == 3 and len(cnt["records"]) == 5, cnt
assert len(c.post("/api/studio/pages", json={"url": f"{base}/pg", "max_pages": 2}).json()["records"]) == 4
# 6. SSE relay: events arrive through the proxy; bad URLs are refused
with c.stream("POST", "/api/studio/stream", json={"url": f"{base}/sse", "seconds": 5}) as r:
    got = "".join(r.iter_text())
assert "data: tick 0" in got and "data: tick 2" in got, got
assert c.post("/api/studio/stream", json={"url": "ftp://x"}).status_code == 400
print("studio tests OK")
