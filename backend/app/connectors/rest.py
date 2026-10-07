"""REST / GraphQL connectors: fetch JSON, find the record array, flatten, ingest."""
from __future__ import annotations

import json
import os
import tempfile
from typing import Any

import httpx

from .base import DataConnector, ConnectorError, http_retry


def find_records(data: Any) -> tuple[str, list] | None:
    """The most table-like array of objects in a JSON reply and its dotted path ("" = the root)."""
    best: tuple[int, str, list] | None = None

    def visit(node: Any, path: list[str], depth: int) -> None:
        nonlocal best
        if isinstance(node, list):
            objs = [x for x in node if isinstance(x, dict)]
            if objs and len(objs) >= len(node) * 0.8:
                width = len({k for o in objs[:50] for k in o})
                score = len(objs) * min(width, 30) - depth
                if best is None or score > best[0]:
                    best = (score, ".".join(path), objs)
        elif isinstance(node, dict) and depth < 6:
            for k, v in node.items():
                visit(v, path + [k], depth + 1)

    visit(data, [], 0)
    return (best[1], best[2]) if best else None


class RestConnector(DataConnector):
    def _request(self) -> tuple[str, dict[str, Any]]:
        """(method, httpx kwargs) from the saved config; subclasses build the request differently."""
        c = self.config
        headers = dict(c.get("headers") or {})
        auth = c.get("auth") or {}
        if auth.get("type") == "bearer":
            headers["Authorization"] = f"Bearer {auth['token']}"
        elif auth.get("type") == "api_key":
            headers[auth["header"]] = auth["key"]
        kwargs: dict[str, Any] = {"params": c.get("params"), "headers": headers}
        body = c.get("body")
        if body not in (None, ""):
            if isinstance(body, (dict, list)):
                kwargs["json"] = body
            else:
                kwargs["content"] = str(body).encode()
        return c.get("method", "GET").upper(), kwargs

    def _fetch(self) -> Any:
        method, kwargs = self._request()
        try:
            resp = http_retry(lambda: httpx.request(method, self.config["url"], timeout=30, follow_redirects=True, **kwargs),
                              attempts=3 if method in ("GET", "HEAD") else 1)  # never replay a POST/PUT
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            raise ConnectorError(str(e)) from e

    def _extract(self, data: Any, path: str) -> list[dict]:
        sep = self.config.get("flatten_sep", ".")
        node = data
        if not (path or "").strip("."):
            found = find_records(data)  # smart default: no path given -> the best array in the reply
            node = found[1] if found else data
        for part in (path or "").strip(".").split("."):
            if not part:
                continue
            if isinstance(node, dict):
                node = node.get(part)
            elif isinstance(node, list):
                node = [item.get(part) for item in node if isinstance(item, dict)]
            if node is None:
                break
        if isinstance(node, dict):
            node = [node]
        if not isinstance(node, list):
            raise ConnectorError(f"record_path '{path}' did not resolve to an array")
        return [flatten(item, sep) for item in node if isinstance(item, dict)]

    def test_connection(self) -> dict[str, Any]:
        try:
            data = self._fetch()
            found = find_records(data)
            detail = f"request succeeded; found {len(found[1])} records" + (f" at '{found[0]}'" if found and found[0] else "") if found else "request succeeded"
            return {"ok": True, "detail": detail}
        except ConnectorError as e:
            return {"ok": False, "detail": str(e)}

    def discover(self) -> list[dict[str, Any]]:
        return [{"name": self.config.get("name", "api"), "kind": "api"}]

    def ingest(self, name: str, target_table: str, analytics_con) -> dict[str, Any]:
        rows = self._extract(self._fetch(), self.config.get("record_path", ""))
        if not rows:
            raise ConnectorError("API returned no rows for the given record_path")
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(rows, f)
            tmp = f.name
        try:
            analytics_con.execute(
                f"CREATE OR REPLACE TABLE {target_table} AS SELECT * FROM read_json_auto('{tmp.replace(chr(92), '/')}')"
            )
        finally:
            os.unlink(tmp)
        info = analytics_con.execute(f"PRAGMA table_info('{target_table}')").fetchall()
        count = analytics_con.execute(f"SELECT COUNT(*) FROM {target_table}").fetchone()[0]
        return {"row_count": count, "columns": [{"name": r[1], "dtype": r[2]} for r in info]}


class GraphQLConnector(RestConnector):
    """POST {query, variables} to a GraphQL endpoint; the records are found in `data` like any JSON reply."""

    def _request(self) -> tuple[str, dict[str, Any]]:
        _, kwargs = super()._request()
        kwargs.pop("content", None)
        variables = self.config.get("variables") or {}
        if isinstance(variables, str):
            variables = json.loads(variables or "{}")
        kwargs["json"] = {"query": self.config.get("query", ""), "variables": variables}
        kwargs["headers"] = {"Content-Type": "application/json", **kwargs["headers"]}
        return "POST", kwargs

    def _fetch(self) -> Any:
        data = super()._fetch()
        if isinstance(data, dict) and data.get("errors"):
            raise ConnectorError("GraphQL error: " + "; ".join(str(e.get("message", e)) for e in data["errors"])[:300])
        return data.get("data", data) if isinstance(data, dict) else data


def flatten(obj: dict, sep: str = ".", prefix: str = "") -> dict:
    """Nested objects become `a.b` (or `a_b`) columns; lists are kept as JSON text."""
    out: dict[str, Any] = {}
    for k, v in obj.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict) and v:
            out.update(flatten(v, sep, key + sep))
        else:
            out[key] = json.dumps(v) if isinstance(v, (list, dict)) else v
    return out
