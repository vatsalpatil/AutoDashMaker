"""Where a widget goes on a dashboard page: at the top, after the KPI row, after a named widget, or at the end.

Pure functions over the editor's index ({widget id: {"widget": row with page + position, "chart": {spec...}}}), so they are easy to test.
A new (or moved) widget fills a blank gap when it fits there; otherwise the widgets below it move down just far enough to make room.
"""
from __future__ import annotations

from typing import Any

KPI_BAND_ROWS = 6   # KPI widgets that start within the first rows count as "the KPI row"


def _excluded(wid: str, exclude: str | set[str] | None) -> bool:
    return wid == exclude if isinstance(exclude, str) or exclude is None else wid in exclude


def _page_items(index: dict[str, dict[str, Any]], page: str, exclude: str | set[str] | None) -> list[tuple[str, dict[str, int]]]:
    out = []
    for wid, e in index.items():
        if not _excluded(wid, exclude) and (e["widget"].get("page") or "main") == page:
            p = e["widget"].get("position") or {}
            out.append((wid, {"x": p.get("x", 0), "y": p.get("y", 0), "w": p.get("w", 6), "h": p.get("h", 4)}))
    return out


def anchor_y(index: dict[str, dict[str, Any]], page: str, place: Any, exclude: str | set[str] | None = None) -> int:
    """The row a widget should start at. `place`: 'top' | 'after_kpis' | {'after': widget id} | anything else = the end of the page."""
    items = _page_items(index, page, exclude)
    if place == "top":
        return 0
    if place == "after_kpis":
        bottoms = [p["y"] + p["h"] for wid, p in items if index[wid]["chart"].get("spec", {}).get("type") == "kpi" and p["y"] < KPI_BAND_ROWS]
        return max(bottoms) if bottoms else 0
    if isinstance(place, dict) and place.get("after") in index and not _excluded(place["after"], exclude):
        p = next((p for wid, p in items if wid == place["after"]), None)
        if p:
            return p["y"] + p["h"]
    return max([p["y"] + p["h"] for _, p in items] or [0])


def make_room(index: dict[str, dict[str, Any]], page: str, y: int, height: int, exclude: str | set[str] | None = None) -> list[tuple[str, int]]:
    """[(widget id, new y)] for the widgets that must move down so a widget of `height` rows fits at row `y`; empty when a gap already holds it."""
    below = [(wid, p) for wid, p in _page_items(index, page, exclude) if p["y"] >= y]
    if not below:
        return []
    gap = min(p["y"] for _, p in below) - y
    if gap >= height:
        return []
    return [(wid, p["y"] + (height - gap)) for wid, p in below]


def grid_positions(count: int, columns: int, start_y: int, height: int = 2) -> list[dict[str, int]]:
    """Positions for `count` widgets laid out `columns` per row on the 12-column grid, starting at row `start_y`."""
    columns = min(max(int(columns), 1), 6)
    width = 12 // columns
    return [{"x": (i % columns) * width, "y": start_y + (i // columns) * height, "w": width, "h": height} for i in range(count)]


def resolve_overlaps(index: dict[str, dict[str, Any]], page: str) -> list[tuple[str, int]]:
    """(widget id, new y) for widgets on `page` that overlap one placed above them: each moves down just below it."""
    placed: list[dict[str, int]] = []
    moves = []
    for wid, p in sorted(_page_items(index, page, None), key=lambda t: (t[1]["y"], t[1]["x"])):
        y = p["y"]
        while hit := [q for q in placed if q["x"] < p["x"] + p["w"] and p["x"] < q["x"] + q["w"] and q["y"] < y + p["h"] and y < q["y"] + q["h"]]:
            y = max(q["y"] + q["h"] for q in hit)
        if y != p["y"]:
            moves.append((wid, y))
        placed.append({**p, "y": y})
    return moves
