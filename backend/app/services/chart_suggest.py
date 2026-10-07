"""Pick a sensible chart for a query result (deterministic — no model call)."""
import re
from typing import Any

_DATE_NAME = re.compile(r"(date|day|month|week|year|quarter|time|period|_at$)", re.IGNORECASE)
_DATE_VALUE = re.compile(r"^\d{4}-\d{2}(-\d{2})?")


def _is_number(v: Any) -> bool:
    if isinstance(v, bool):
        return False
    if isinstance(v, (int, float)):
        return True
    try:
        float(str(v))
        return str(v).strip() != ""
    except ValueError:
        return False


def column_roles(columns: list[str], rows: list[dict]) -> dict[str, list[str]]:
    """Split columns into 'time', 'measure' and 'category' by looking at up to 30 sample values."""
    roles: dict[str, list[str]] = {"time": [], "measure": [], "category": []}
    for c in columns:
        sample = [r.get(c) for r in rows[:30] if r.get(c) not in (None, "")]
        if sample and all(_DATE_VALUE.match(str(v)) for v in sample) or _DATE_NAME.search(c) and not all(_is_number(v) for v in sample):
            roles["time"].append(c)
        elif sample and all(_is_number(v) for v in sample):
            roles["measure"].append(c)
        else:
            roles["category"].append(c)
    return roles


def suggest_chart(columns: list[str], rows: list[dict]) -> dict[str, Any]:
    """A chart spec `{type, encoding, options}` that fits the result's shape; falls back to a table."""
    if not rows:
        return {"type": "table", "encoding": {"x": "", "y": ""}, "options": {}}
    r = column_roles(columns, rows)
    time, measure, cat = r["time"], r["measure"], r["category"]
    if len(rows) == 1 and len(columns) <= 2 and measure:
        return {"type": "kpi", "encoding": {"x": "", "y": measure[0]}, "options": {"numberFormat": "compact"}}
    if time and measure:
        enc: dict[str, Any] = {"x": time[0], "y": measure[0]}
        if len(measure) > 1:
            enc["ys"] = measure[:3]
        elif cat and len({str(x.get(cat[0])) for x in rows}) <= 6:
            enc["color"] = cat[0]
        return {"type": "area" if len(rows) > 12 else "line", "encoding": enc, "options": {"showLegend": "color" in enc or "ys" in enc}}
    if cat and measure:
        distinct = len({str(x.get(cat[0])) for x in rows})
        if len(cat) >= 2 and distinct <= 12 and len(rows) <= 60:
            return {"type": "bar", "encoding": {"x": cat[0], "y": measure[0], "color": cat[1]}, "options": {"stacked": True, "barRadius": 0}}
        if distinct <= 6 and len(measure) == 1 and len(rows) == distinct:
            return {"type": "pie", "encoding": {"x": cat[0], "y": measure[0]}, "options": {"donut": True, "pieLabels": "percent"}}
        opts: dict[str, Any] = {"showLegend": False, "barRadius": 6}
        if distinct > 8:
            opts.update(horizontal=True, sortBy="value", sortDir="desc", limit=15, showDataLabels=True, grid="none")
        return {"type": "bar", "encoding": {"x": cat[0], "y": measure[0]}, "options": opts}
    if len(measure) >= 2 and not cat:
        return {"type": "scatter", "encoding": {"x": measure[0], "y": measure[1]}, "options": {"trendline": True}}
    return {"type": "table", "encoding": {"x": "", "y": ""}, "options": {}}


def encode(chart_type: str, columns: list[str], rows: list[dict]) -> dict[str, Any]:
    """Which result columns feed a chart of `chart_type` (mirrors the studio's auto-assignment)."""
    r = column_roles(columns, rows)
    measures = r["measure"]
    dims = r["time"] + r["category"]
    x = dims[0] if dims else (columns[0] if columns else "")
    ys = [m for m in measures if m != x]
    y = ys[0] if ys else (next((c for c in columns if c != x), x))
    if chart_type == "kpi":
        return {"x": y, "y": y}
    if chart_type == "scatter":
        nums = measures + [c for c in columns if c not in measures]
        return {"x": nums[0], "y": nums[1] if len(nums) > 1 else nums[0], **({"color": dims[0]} if dims else {})}
    enc: dict[str, Any] = {"x": x, "y": y}
    if chart_type in ("line", "area", "bar", "composed", "radar") and len(ys) > 1:
        enc["ys"] = ys[:4]
    if chart_type == "pivot":
        enc["color"] = dims[1] if len(dims) > 1 else None
        if enc["color"] is None:
            del enc["color"]
    return enc
