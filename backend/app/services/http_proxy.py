"""Server-side HTTP requests for the API Studio (the browser cannot call arbitrary APIs because of CORS).

Local single-user tool, so localhost targets are allowed; only obviously dangerous destinations are refused.
"""
from __future__ import annotations

import ipaddress
import time
from typing import Any
from urllib.parse import urlsplit

import httpx
from ..core.netguard import NetworkBlocked, ensure_public_url, safe_client

MAX_BODY = 5 * 1024 * 1024        # response bytes kept
ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}


class ProxyError(Exception):
    pass


def check_url(url: str) -> str:
    """http(s) only; refuse link-local / cloud-metadata addresses."""
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ProxyError("only http:// and https:// URLs are supported")
    try:
        ip = ipaddress.ip_address(parts.hostname)
        if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            raise ProxyError("that address is not allowed")
    except ValueError:
        pass  # a hostname, not an IP literal
    try:
        ensure_public_url(url)  # multi-user servers: no internal/private targets (no-op in local mode)
    except NetworkBlocked as e:
        raise ProxyError(str(e)) from e
    return url.strip()


def send(method: str, url: str, headers: dict[str, str] | None = None, body: str | None = None,
         params: dict[str, str] | None = None, timeout: float = 30) -> dict[str, Any]:
    method = method.upper()
    if method not in ALLOWED_METHODS:
        raise ProxyError(f"unsupported method {method}")
    url = check_url(url)
    t0 = time.perf_counter()
    try:
        with safe_client(follow_redirects=True, timeout=timeout) as client:
            with client.stream(method, url, headers=headers or {}, params=params or None,
                               content=(body.encode() if body else None)) as resp:
                chunks, size, truncated = [], 0, False
                for chunk in resp.iter_bytes():
                    size += len(chunk)
                    if size > MAX_BODY:
                        truncated = True
                        break
                    chunks.append(chunk)
                raw = b"".join(chunks)
                status, reason, final = resp.status_code, resp.reason_phrase, str(resp.url)
                resp_headers = dict(resp.headers)
    except httpx.HTTPError as e:
        raise ProxyError(str(e) or type(e).__name__) from e
    text = raw.decode("utf-8", errors="replace")  # httpx has already undone any content-encoding
    return {
        "status": status, "status_text": reason, "ok": 200 <= status < 400,
        "elapsed_ms": round((time.perf_counter() - t0) * 1000), "size": size, "truncated": truncated,
        "headers": resp_headers, "body": text, "url": final,
    }


def _next_url(resp: dict[str, Any], data: Any, current: str, next_path: str | None) -> str | None:
    """Where the next page lives: a JSON path holding a URL/cursor, a `Link: <…>; rel="next"` header, or a `next` field."""
    from urllib.parse import urljoin
    link = {k.lower(): v for k, v in resp["headers"].items()}.get("link", "")
    for part in link.split(","):
        if 'rel="next"' in part and "<" in part:
            return urljoin(current, part.split("<", 1)[1].split(">", 1)[0])
    node: Any = data
    for key in (next_path or "next").split("."):
        node = node.get(key) if isinstance(node, dict) else None
    return urljoin(current, node) if isinstance(node, str) and node else None


def fetch_pages(method: str, url: str, headers: dict[str, str] | None, body: str | None, params: dict[str, str] | None,
                next_path: str | None = None, page_param: str | None = None, max_pages: int = 20) -> dict[str, Any]:
    """Follow pagination and return every page's records merged. Links (Link header / `next` URL) are followed first;
    `page_param` (e.g. `page`) falls back to counting pages up until one comes back empty."""
    from ..connectors.rest import find_records
    import json as _json
    merged: list = []
    pages, current, page = 0, url, 1
    q = dict(params or {})
    t0 = time.perf_counter()
    while pages < max_pages:
        if page_param:
            q[page_param] = str(page)
        resp = send(method, current, headers, body, q if (page_param or current == url) else None)
        try:
            data = _json.loads(resp["body"])
        except ValueError:
            raise ProxyError("a page was not JSON, so pages cannot be merged")
        found = find_records(data)
        records = found[1] if found else (data if isinstance(data, list) else [])
        if not records:
            break
        merged.extend(records)
        pages += 1
        nxt = _next_url(resp, data, current, next_path)
        if nxt:
            current, page = nxt, page + 1
        elif page_param:
            page += 1
        else:
            break
    return {"records": merged, "pages": pages, "elapsed_ms": round((time.perf_counter() - t0) * 1000)}
