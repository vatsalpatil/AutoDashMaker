"""REST pagination: follow an API's pages until the data ends, with hard caps so one source can't fetch forever.

config["pagination"] = {"mode": "auto" | "none" | "offset" | "page" | "cursor" | "next_link", "max_pages": 50, ...}

  auto       detect from the first reply: a next link (body `next` / `links.next` / Link header), a cursor
             (`next_cursor`, `meta.next_cursor`...), or total+skip/limit counters (DummyJSON-style). Nothing found = 1 page.
  offset     ?<offset_param>=0,N,2N...   (offset_param "offset"/"skip", limit_param "limit", page_size)
  page       ?<page_param>=1,2,3...
  cursor     ?<cursor_param>=<value found at cursor_path in the previous reply>
  next_link  follow the URL at next_path (or the Link: rel="next" header)
Stops at an empty page, a repeated page, max_pages (default 50, cap 500) or MAX_ROWS records.
"""
from __future__ import annotations

from typing import Any, Callable

MAX_ROWS = 1_000_000
_NEXT_PATHS = ("next", "links.next", "paging.next", "_links.next.href", "next_page_url", "@odata.nextLink")
_CURSOR_PATHS = ("next_cursor", "nextCursor", "meta.next_cursor", "response_metadata.next_cursor", "cursor.next", "nextPageToken")


def dig(data: Any, path: str) -> Any:
    for part in path.split("."):
        if not isinstance(data, dict):
            return None
        data = data.get(part)
    return data


def _first(data: Any, paths) -> tuple[str, Any] | None:
    for p in paths:
        v = dig(data, p)
        if isinstance(v, (str, int)) and v not in ("", 0):
            return p, v
    return None


def detect(first: Any, link_next: str | None) -> dict:
    """The pagination a first reply implies (mode 'none' when it looks complete)."""
    if link_next:
        return {"mode": "next_link"}
    if (n := _first(first, _NEXT_PATHS)) and isinstance(n[1], str) and n[1].startswith(("http://", "https://", "/", "?")):
        return {"mode": "next_link", "next_path": n[0]}
    if c := _first(first, _CURSOR_PATHS):
        return {"mode": "cursor", "cursor_path": c[0], "cursor_param": c[0].split(".")[-1]}
    if isinstance(first, dict) and isinstance(first.get("total"), int):
        for off in ("skip", "offset"):
            if isinstance(first.get(off), int) and isinstance(first.get("limit"), int) and first["limit"] > 0:
                if first["total"] > first[off] + first["limit"]:
                    return {"mode": "offset", "offset_param": off, "limit_param": "limit", "page_size": first["limit"]}
    return {"mode": "none"}


def fetch_all(fetch: Callable[[str | None, dict], tuple[Any, str | None]], extract: Callable[[Any], list[dict]],
              cfg: dict | None) -> tuple[list[dict], dict]:
    """fetch(url_or_None, extra_params) -> (json, link_next). Returns (records, info{mode, pages, truncated})."""
    cfg = dict(cfg or {})
    mode = cfg.get("mode", "auto")
    max_pages = max(1, min(int(cfg.get("max_pages") or 50), 500))
    data, link_next = fetch(None, {})
    rows = extract(data)
    if mode == "auto":
        cfg.update(detect(data, link_next))
        mode = cfg["mode"]
    pages, seen = 1, {_sig(rows)}
    size = int(cfg.get("page_size") or len(rows) or 1)
    while mode != "none" and pages < max_pages and len(rows) < MAX_ROWS:
        url, params = None, {}
        if mode == "offset":
            params = {cfg.get("offset_param", "offset"): pages * size, cfg.get("limit_param", "limit"): size}
        elif mode == "page":
            params = {cfg.get("page_param", "page"): pages + int(cfg.get("first_page", 1))}
        elif mode == "cursor":
            cur = dig(data, cfg.get("cursor_path", "next_cursor"))
            if not cur:
                break
            params = {cfg.get("cursor_param", "cursor"): cur}
        elif mode == "next_link":
            url = link_next or dig(data, cfg.get("next_path", "next"))
            if not url or not isinstance(url, str):
                break
        data, link_next = fetch(url, params)
        page = extract(data)
        if not page or _sig(page) in seen:   # empty, or the API ignores our parameter and repeats page 1
            break
        seen.add(_sig(page))
        rows += page
        pages += 1
    truncated = pages >= max_pages or len(rows) >= MAX_ROWS
    return rows[:MAX_ROWS], {"mode": mode, "pages": pages, "truncated": truncated}


def _sig(rows: list[dict]) -> str:
    return repr(rows[:1] + rows[-1:]) if rows else ""
