"""A compact, factual profile of one dataset for the dashboard generator: column roles, ranges, top values, time grain.

Roles are decided here (not by the model): time, id, measure, dimension, text. Extra statistics come from a few small
aggregate queries that run through the engine (read-only validated, linked tables rewritten).
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from ..core.security import quote_ident
from .engine import engine

_DECIMAL = ("DOUBLE", "FLOAT", "DECIMAL", "REAL")


def _num(dtype: str) -> bool:
    return any(t in dtype.upper() for t in ("INT", "NUMERIC") + _DECIMAL)


def _date(dtype: str) -> bool:
    return any(t in dtype.upper() for t in ("DATE", "TIME"))


def _role(c: dict, rows: int) -> str:
    n, dt, distinct = c["name"].lower(), c["dtype"], c["distinct_count"]
    if _date(dt):
        return "time"
    near_unique = rows and distinct >= rows * 0.98 and not any(t in dt.upper() for t in _DECIMAL)
    if n == "id" or n.endswith(("_id", "_key", "_uuid")) or near_unique:
        return "id"
    if _num(dt):
        return "measure"
    return "dimension" if 1 < distinct <= max(50, rows * 0.05) else "text"


def _grain(lo: Any, hi: Any) -> str | None:
    if not isinstance(lo, (date, datetime)) or not isinstance(hi, (date, datetime)):
        return None
    days = (hi - lo).days
    return "day" if days <= 62 else "week" if days <= 240 else "month" if days <= 365 * 4 else "quarter" if days <= 365 * 12 else "year"


def _first_row(res: dict) -> list:
    row = res["rows"][0]
    return list(row.values()) if isinstance(row, dict) else list(row)


def profile(dataset: dict[str, Any]) -> dict[str, Any]:
    table = dataset["physical_name"]
    schema = engine.describe_table(table)
    rows, cols = schema["row_count"], schema["columns"]
    for c in cols:
        c["role"] = _role(c, rows)

    ranges: dict[str, list] = {}
    typed = [c for c in cols if c["role"] in ("time", "measure")][:12]
    if typed and rows:
        aggs = ", ".join(
            f"MIN({quote_ident(c['name'])}), MAX({quote_ident(c['name'])}), "
            + (f"ROUND(AVG({quote_ident(c['name'])}), 2)" if c["role"] == "measure" else "NULL") for c in typed)
        try:
            vals = _first_row(engine.execute(f"SELECT {aggs} FROM {table}", 1))
            ranges = {c["name"]: vals[3 * i:3 * i + 3] for i, c in enumerate(typed)}
        except Exception:
            pass  # the profile still works from the schema alone

    tops: dict[str, list[str]] = {}
    for c in [c for c in cols if c["role"] == "dimension"][:5]:
        q = quote_ident(c["name"])
        try:
            res = engine.execute(f"SELECT {q} AS v, COUNT(*) AS n FROM {table} WHERE {q} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 6", 6)
            tops[c["name"]] = [f"{r['v']} ({r['n']})" if isinstance(r, dict) else f"{r[0]} ({r[1]})" for r in res["rows"]]
        except Exception:
            pass

    grain = next((_grain(*ranges[c["name"]][:2]) for c in cols if c["role"] == "time" and c["name"] in ranges), None)
    lines = [f"Table `{table}` ({dataset.get('name', table)}): {rows:,} rows, {len(cols)} columns."
             + (" (profile sampled: live source)" if schema.get("sampled") else "")]
    for c in cols:
        bits = [f"{c['name']} {c['dtype']} [{c['role']}]", f"{c['null_pct']}% empty", f"{c['distinct_count']:,} distinct"]
        if c["name"] in ranges:
            lo, hi, avg = ranges[c["name"]]
            bits.append(f"range {lo} to {hi}" + (f", avg {avg}" if avg is not None else ""))
        if c["name"] in tops:
            bits.append("top: " + ", ".join(tops[c["name"]]))
        elif c["sample_values"] and c["role"] in ("dimension", "text", "id"):
            bits.append("e.g. " + ", ".join(c["sample_values"][:3]))
        lines.append("- " + "; ".join(bits))
    if grain:
        lines.append(f"Suggested time grain for trends: {grain}.")
    return {"table": table, "rows": rows, "columns": cols, "grain": grain, "text": "\n".join(lines)}
