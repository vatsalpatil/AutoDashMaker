"""Metric evaluation + suggestions for the Metrics hub.

A metric is `expression` (a SQL aggregate such as SUM("amount")) over one dataset with optional filter conditions.
Everything runs through the engine, so it is read-only validated, timed out and cached like any other query.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

from ..core.store import store
from .engine import engine

_NUMERIC = re.compile(r"INT|DOUBLE|FLOAT|DECIMAL|REAL|NUMERIC", re.I)
_DATE = re.compile(r"DATE|TIMESTAMP", re.I)
_ID = re.compile(r"(^|_)id$|^id$|uuid|key$", re.I)
TREND_POINTS = 12


def _q(col: str) -> str:
    return '"' + col.replace('"', '""') + '"'


def _filters(raw: Any) -> list[str]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except ValueError:
            raw = [raw]
    return [str(f).strip() for f in (raw or []) if str(f).strip()]


def _columns(dataset_id: str) -> list[dict[str, Any]]:
    return store.list("columns_meta", where="dataset_id = ?", params=[dataset_id], order=None)


def _where(filters: list[str]) -> str:
    return " WHERE " + " AND ".join(f"({f})" for f in filters) if filters else ""


def evaluate(dataset_id: str | None, expression: str, filters: Any = None) -> dict[str, Any]:
    """{value, sql, trend:[{period, value}], ms, error}: never raises, so one bad metric can't break the page."""
    started = time.perf_counter()
    out: dict[str, Any] = {"value": None, "sql": None, "trend": [], "ms": 0, "error": None}
    ds = store.get("datasets", dataset_id) if dataset_id else None
    if not ds or not ds.get("physical_name"):
        out["error"] = "Link this metric to a dataset so it can be calculated."
        return out
    if not (expression or "").strip():
        out["error"] = "The expression is empty."
        return out
    where = _where(_filters(filters))
    src = _q(ds["physical_name"])
    out["sql"] = f"SELECT {expression} AS value FROM {src}{where}"
    try:
        res = engine.execute(out["sql"], row_limit=1)
        out["value"] = res["rows"][0]["value"] if res["rows"] else None
    except Exception as e:  # noqa: BLE001 - surfaced to the user as text
        out["error"] = str(e).splitlines()[0][:200]
        return out
    date_col = next((c["name"] for c in _columns(ds["id"]) if _DATE.search(c.get("dtype") or "")), None)
    if date_col:
        try:
            t = engine.execute(
                f"SELECT date_trunc('month', {_q(date_col)}) AS period, {expression} AS value FROM {src}{where} "
                f"GROUP BY 1 HAVING period IS NOT NULL ORDER BY 1 DESC LIMIT {TREND_POINTS}", row_limit=TREND_POINTS)
            out["trend"] = [{"period": str(r["period"])[:7], "value": r["value"]} for r in reversed(t["rows"])]
        except Exception:  # noqa: BLE001 - the trend is a bonus, the headline value already worked
            pass
    out["ms"] = round((time.perf_counter() - started) * 1000)
    return out


def values() -> dict[str, dict[str, Any]]:
    return {m["id"]: evaluate(m.get("dataset_id"), m.get("expression", ""), m.get("filters")) for m in store.list("metrics", order=None)}


def suggestions(max_per_dataset: int = 6) -> dict[str, list[dict[str, Any]]]:
    """Starter metrics/dimensions read off each dataset's columns, minus what already exists."""
    have_m = {(m.get("dataset_id"), (m.get("expression") or "").lower()) for m in store.list("metrics", order=None)}
    have_d = {(d.get("dataset_id"), (d.get("column_name") or "").lower()) for d in store.list("dimensions", order=None)}
    metrics: list[dict[str, Any]] = []
    dims: list[dict[str, Any]] = []
    for ds in store.list("datasets", order=None)[:12]:
        cols = _columns(ds["id"])
        base = {"dataset_id": ds["id"], "dataset_name": ds["name"]}
        cand = [{"name": "row_count", "label": "Row count", "expression": "COUNT(*)", "description": f"Number of rows in {ds['name']}."}]
        for c in cols:
            n, dtype = c["name"], c.get("dtype") or ""
            if _NUMERIC.search(dtype) and not _ID.search(n):
                cand.append({"name": f"total_{n}", "label": f"Total {n}", "expression": f"SUM({_q(n)})", "description": f"Sum of {n}."})
                cand.append({"name": f"avg_{n}", "label": f"Average {n}", "expression": f"AVG({_q(n)})", "description": f"Average {n} per row."})
            elif _ID.search(n):
                cand.append({"name": f"unique_{n}", "label": f"Unique {n}", "expression": f"COUNT(DISTINCT {_q(n)})", "description": f"Distinct {n} values."})
            d = c.get("distinct_count") or 0
            if (_DATE.search(dtype) or (not _NUMERIC.search(dtype) and 2 <= d <= 50)) and (ds["id"], n.lower()) not in have_d:
                dims.append({**base, "name": n, "label": n.replace("_", " ").title(), "column_name": n,
                             "description": "Time axis" if _DATE.search(dtype) else f"{d} distinct values"})
        metrics += [{**base, **m} for m in cand if (ds["id"], m["expression"].lower()) not in have_m][:max_per_dataset]
    return {"metrics": metrics, "dimensions": dims[:24]}
