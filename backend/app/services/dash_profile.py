"""What the dashboard generator knows about a dataset: roles, DESCRIBE-style statistics, correlations, the top 100 rows.

Roles are decided here (not by the model): time, id, measure, dimension, text. Statistics come from a few small
aggregate queries that run through the engine (read-only validated, linked tables rewritten). The same facts go to the
model (as text) and to the user (as tables), so both look at the same evidence.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from ..core.security import quote_ident
from .engine import engine

_DECIMAL = ("DOUBLE", "FLOAT", "DECIMAL", "REAL")
SAMPLE_ROWS = 100        # rows read for the sample (shown to the user)
PROMPT_ROWS = 12         # rows of that sample that go into the model prompt
STAT_COLS = 12


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


def _row(res: dict) -> list:
    r = res["rows"][0]
    return list(r.values()) if isinstance(r, dict) else list(r)


def _describe(table: str, cols: list[dict]) -> dict[str, dict[str, Any]]:
    """Per column: min / p25 / median / p75 / max / mean / std for measures, min / max for dates."""
    typed = [c for c in cols if c["role"] in ("time", "measure")][:STAT_COLS]
    if not typed:
        return {}
    keys = ("min", "p25", "median", "p75", "max", "mean", "std")
    parts = []
    for i, c in enumerate(typed):
        q = quote_ident(c["name"])
        exprs = ([f"MIN({q})", f"QUANTILE_CONT({q}, 0.25)", f"QUANTILE_CONT({q}, 0.5)", f"QUANTILE_CONT({q}, 0.75)", f"MAX({q})",
                  f"ROUND(AVG({q}), 2)", f"ROUND(STDDEV_SAMP({q}), 2)"] if c["role"] == "measure"
                 else [f"MIN({q})", "NULL", "NULL", "NULL", f"MAX({q})", "NULL", "NULL"])
        parts += [f"{e} AS s{i}_{k}" for e, k in zip(exprs, keys)]   # unique aliases: result rows are dicts keyed by name
    try:
        vals = _row(engine.execute(f"SELECT {', '.join(parts)} FROM {table}", 1))
    except Exception:
        return {}  # the profile still works from the schema alone
    return {c["name"]: dict(zip(keys, vals[7 * i:7 * i + 7])) for i, c in enumerate(typed)}


def _correlations(table: str, measures: list[str]) -> list[dict[str, Any]]:
    pairs = [(a, b) for i, a in enumerate(measures[:4]) for b in measures[i + 1:4]]
    if not pairs:
        return []
    sel = ", ".join(f"ROUND(CORR({quote_ident(a)}, {quote_ident(b)}), 2)" for a, b in pairs)
    try:
        vals = _row(engine.execute(f"SELECT {sel} FROM {table}", 1))
    except Exception:
        return []
    return [{"a": a, "b": b, "r": v} for (a, b), v in zip(pairs, vals) if v is not None]


def _top_values(table: str, cols: list[dict]) -> dict[str, list[str]]:
    tops: dict[str, list[str]] = {}
    for c in [c for c in cols if c["role"] == "dimension"][:5]:
        q = quote_ident(c["name"])
        try:
            res = engine.execute(f"SELECT {q} AS v, COUNT(*) AS n FROM {table} WHERE {q} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 6", 6)
            tops[c["name"]] = [f"{r['v']} ({r['n']})" if isinstance(r, dict) else f"{r[0]} ({r[1]})" for r in res["rows"]]
        except Exception:
            pass
    return tops


def _cell(v: Any) -> str:
    return str(v)[:24] if v is not None else ""


def profile(dataset: dict[str, Any]) -> dict[str, Any]:
    table = dataset["physical_name"]
    schema = engine.describe_table(table)
    rows, cols = schema["row_count"], schema["columns"]
    for c in cols:
        c["role"] = _role(c, rows)
    stats = _describe(table, cols) if rows else {}
    tops = _top_values(table, cols) if rows else {}
    corr = _correlations(table, [c["name"] for c in cols if c["role"] == "measure"]) if rows else []
    try:
        s = engine.execute(f"SELECT * FROM {table}", SAMPLE_ROWS)
        sample = {"columns": s["columns"], "rows": [dict(r) if isinstance(r, dict) else dict(zip(s["columns"], r)) for r in s["rows"]]}
    except Exception:
        sample = {"columns": [c["name"] for c in cols], "rows": []}
    grain = next((_grain(stats[c["name"]]["min"], stats[c["name"]]["max"]) for c in cols if c["role"] == "time" and c["name"] in stats), None)

    lines = [f"Table `{table}` ({dataset.get('name', table)}): {rows:,} rows, {len(cols)} columns."
             + (" (profile sampled: live source)" if schema.get("sampled") else "")]
    for c in cols:
        bits = [f"{c['name']} {c['dtype']} [{c['role']}]", f"{c['null_pct']}% empty", f"{c['distinct_count']:,} distinct"]
        st = stats.get(c["name"])
        if st and c["role"] == "measure":
            bits.append(f"min {st['min']}, p25 {st['p25']}, median {st['median']}, p75 {st['p75']}, max {st['max']}, mean {st['mean']}, std {st['std']}")
        elif st:
            bits.append(f"range {st['min']} to {st['max']}")
        if c["name"] in tops:
            bits.append("top: " + ", ".join(tops[c["name"]]))
        elif c["sample_values"] and c["role"] in ("dimension", "text", "id"):
            bits.append("e.g. " + ", ".join(c["sample_values"][:3]))
        lines.append("- " + "; ".join(bits))
    if corr:
        lines.append("Correlations (Pearson r): " + ", ".join(f"{x['a']}~{x['b']} {x['r']}" for x in corr))
    if grain:
        lines.append(f"Suggested time grain for trends: {grain}.")
    if sample["rows"]:
        head = sample["rows"][:PROMPT_ROWS]
        lines.append(f"First {len(head)} of the top {len(sample['rows'])} rows:")
        lines.append(" | ".join(sample["columns"]))
        lines += [" | ".join(_cell(r.get(k)) for k in sample["columns"]) for r in head]

    describe = [{"column": c["name"], "type": c["dtype"], "role": c["role"], "empty_pct": c["null_pct"], "distinct": c["distinct_count"],
                 **{k: (stats.get(c["name"]) or {}).get(k) for k in ("min", "p25", "median", "p75", "max", "mean", "std")}} for c in cols]
    return {"table": table, "rows": rows, "columns": cols, "grain": grain, "text": "\n".join(lines),
            "describe": describe, "sample": sample, "correlations": corr}
