"""Validity rules for Data Quality: concrete problems a person would fix, each with a row count and an example.

Checked on a sample (the same 100k rows the duplicate check uses):
- mixed date formats in a text column ('2025-03-04' next to '04/03/2025')
- numbers stored as text, with the values that are not numbers
- negative values where they make no sense (qty, stock, price, cost, age ...)
- sentinel values used as "missing" (-999, -9999, 9999, 99999)
- one category spelled in different upper/lower case ('Present' / 'present')
"""
from __future__ import annotations

import re
from typing import Any

from ..core.security import quote_ident

NON_NEGATIVE = re.compile(r"(qty|quantity|stock|on_hand|price|cost|amount_paid|age|count|units|capacity|duration|hours|km|weight)", re.I)
SENTINELS = (-999, -9999, 9999, 99999, -1e9)
_DATE_SHAPES = {"YYYY-MM-DD": r"^\d{4}-\d{2}-\d{2}", "DD/MM/YYYY or MM/DD/YYYY": r"^\d{1,2}/\d{1,2}/\d{4}",
                "DD-MM-YYYY": r"^\d{1,2}-\d{1,2}-\d{4}", "YYYY/MM/DD": r"^\d{4}/\d{2}/\d{2}"}


def _one(con, sql: str):
    return con.execute(sql).fetchone()


def check(con, src: str, cols: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Problems found in the sample `src` (a SQL relation). Each: {column, problem, rows, example}."""
    issues: list[dict[str, Any]] = []
    for c in cols[:60]:
        name, dtype = c["name"], (c.get("dtype") or "").upper()
        q = quote_ident(name)
        try:
            if "CHAR" in dtype or dtype == "TEXT":
                issues += _text_checks(con, src, name, q)
            elif re.search(r"INT|DOUBLE|DECIMAL|FLOAT|REAL|NUMERIC", dtype):
                issues += _number_checks(con, src, name, q)
        except Exception:  # noqa: BLE001 - one odd column must not break the whole check
            continue
    return issues


def _text_checks(con, src: str, name: str, q: str) -> list[dict[str, Any]]:
    out = []
    shapes = {label: _one(con, f"SELECT count(*), any_value({q}) FROM {src} WHERE regexp_matches({q}, '{rx}')")
              for label, rx in _DATE_SHAPES.items()}
    used = {k: v for k, v in shapes.items() if v[0]}
    if len(used) > 1:
        minority = min(used.items(), key=lambda kv: kv[1][0])
        out.append({"column": name, "problem": f"mixed date formats ({', '.join(used)}): dates stay text and can't be sorted or grouped by month",
                    "rows": int(minority[1][0]), "example": str(minority[1][1])})
    total, numeric, bad = _one(con, f"SELECT count({q}), count(TRY_CAST(replace({q}, ',', '') AS DOUBLE)), "
                                    f"any_value({q}) FILTER (WHERE TRY_CAST(replace({q}, ',', '') AS DOUBLE) IS NULL) FROM {src}")
    if total and 0.9 <= numeric / total < 1:
        out.append({"column": name, "problem": "numbers stored as text: some values are not numbers",
                    "rows": int(total - numeric), "example": str(bad)})
    variants = _one(con, f"SELECT count(*), any_value(v) FROM (SELECT lower(trim({q})) AS k, count(DISTINCT {q}) AS n, "
                         f"string_agg(DISTINCT {q}, ' / ') AS v FROM {src} WHERE {q} IS NOT NULL GROUP BY 1 HAVING n > 1) t")
    distinct = _one(con, f"SELECT count(DISTINCT {q}) FROM {src}")[0]
    if variants[0] and distinct <= 200:   # categories only: free text (names) legitimately varies
        out.append({"column": name, "problem": "same value spelled with different case or spaces",
                    "rows": int(variants[0]), "example": str(variants[1])[:80]})
    return out


def _number_checks(con, src: str, name: str, q: str) -> list[dict[str, Any]]:
    out = []
    if NON_NEGATIVE.search(name):
        neg = _one(con, f"SELECT count(*), min({q}) FROM {src} WHERE {q} < 0")
        if neg[0]:
            out.append({"column": name, "problem": "negative values where only zero or more makes sense", "rows": int(neg[0]), "example": str(neg[1])})
    marks = ", ".join(str(s) for s in SENTINELS)
    sen = _one(con, f"SELECT count(*), any_value({q}) FROM {src} WHERE {q} IN ({marks})")
    if sen[0]:
        out.append({"column": name, "problem": "placeholder numbers (like -999) used for missing values: they distort totals and averages",
                    "rows": int(sen[0]), "example": str(sen[1])})
    return out


def score(issues: list[dict[str, Any]], rows: int, n_cols: int) -> float:
    """100 = no problems. Each column's share of bad rows lowers the score, averaged over all columns."""
    if not rows or not n_cols:
        return 100.0
    bad_share = sum(min(1.0, i["rows"] / rows) for i in issues)
    return round(max(0.0, 100 - bad_share / n_cols * 100 * 3), 1)   # x3: a single broken column must be visible
