"""Exact values of low-cardinality text columns, for AI prompts.

Without them the model guesses spellings: `WHERE status = 'completed'` when the data says 'Completed' → 0 rows.
Columns with ≤ 5 distinct values already have every value in `columns_meta.sample_values`; up to MAX_DISTINCT
are read once with one DISTINCT query (through the engine, read-only) and cached per dataset version.
"""
from __future__ import annotations

import json
from typing import Any

from ..core import tenant
from ..core.security import quote_ident

MAX_DISTINCT = 15
_TEXT = ("VARCHAR", "TEXT", "STRING", "CHAR", "ENUM")
_cache: dict[tuple, list[str]] = {}


def _samples(c: dict[str, Any]) -> list[str]:
    raw = c.get("sample_values")
    if isinstance(raw, list):
        return [str(v) for v in raw]
    try:
        v = json.loads(raw or "[]")
        return [str(x) for x in v] if isinstance(v, list) else []
    except ValueError:
        return []


def values_for(dataset: dict[str, Any], c: dict[str, Any]) -> list[str] | None:
    """Every value of a text column with few distinct values, or None (not text / too many / unknown)."""
    dtype, n = str(c.get("dtype") or "").upper(), c.get("distinct_count")
    if not any(t in dtype for t in _TEXT) or not n or n > MAX_DISTINCT:
        return None
    samples = _samples(c)
    if len(samples) >= n:
        return samples[:n]
    key = (tenant.current(), dataset["id"], dataset.get("row_count"), c["name"])
    if key not in _cache:
        from .engine import engine
        q = quote_ident(c["name"])
        try:
            res = engine.execute(f"SELECT DISTINCT {q} AS v FROM {dataset['physical_name']} WHERE {q} IS NOT NULL ORDER BY 1",
                                 MAX_DISTINCT + 1)
            _cache[key] = [str(r["v"] if isinstance(r, dict) else r[0]) for r in res["rows"]][:MAX_DISTINCT]
        except Exception:  # noqa: BLE001  (a hint, never a failure)
            _cache[key] = []
        if len(_cache) > 2000:
            _cache.clear()
    return _cache[key] or None


def describe(dataset: dict[str, Any], c: dict[str, Any]) -> str:
    """'status VARCHAR' → "status VARCHAR = 'Completed'|'Returned'|'Cancelled'" when the values are known."""
    base = f"{c['name']} {c.get('dtype') or ''}".strip()
    vals = values_for(dataset, c)
    if not vals:
        return base
    return base + " = " + "|".join("'" + v.replace("'", "''")[:40] + "'" for v in vals)
