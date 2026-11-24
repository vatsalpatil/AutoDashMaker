"""Semantic layer: the ONE canonical expansion of a defined metric, and the deterministic undefined-metric guard.

`metric_sql` is shared by the Metrics hub (metrics.evaluate), the AI prompt context and Ask lineage, so a metric
means the same thing everywhere. `undefined_metric` stops the AI from inventing a formula for a business metric
(profit, churn, ...) that the workspace never defined and no column provides: Ask asks the user instead.
"""
from __future__ import annotations

import json
import re
from typing import Any

from ..core.security import quote_ident
from ..core.store import store

# Business metrics whose formula varies by company; inventing one silently gives wrong numbers.
# (Plain measures such as revenue/sales/amount are left out: they normally exist as a column.)
AMBIGUOUS_METRICS: dict[str, str] = {
    "profit": r"\bprofits?\b|\bprofitability\b", "margin": r"\b(?:gross |net |profit )?margins?\b",
    "net income": r"\bnet income\b", "ebitda": r"\bebitda\b", "churn": r"\bchurn(?:ed| rate)?\b",
    "retention": r"\bretention(?: rate)?\b", "lifetime value": r"\b(?:ltv|clv|cltv|lifetime value)\b",
    "cac": r"\b(?:cac|customer acquisition cost)\b", "arpu": r"\barpu\b", "aov": r"\b(?:aov|average order value)\b",
    "mrr": r"\bmrr\b", "arr": r"\barr\b", "roi": r"\b(?:roi|return on investment)\b",
    "conversion rate": r"\bconversion(?: rate)?s?\b", "burn rate": r"\bburn rate\b",
}
_ALIASES = {"lifetime value": ("ltv", "clv", "cltv"), "cac": ("acquisition",), "aov": ("order_value",),
            "conversion rate": ("conversion", "converted")}


def filters_of(metric: dict) -> list[str]:
    raw = metric.get("filters")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except ValueError:
            raw = [raw]
    return [str(f).strip() for f in (raw or []) if str(f).strip()]


def metric_sql(metric: dict, table: str | None = None) -> str:
    """Canonical SQL for a metric: `SELECT <expression> AS value FROM <table> [WHERE f1 AND f2]`."""
    fs = filters_of(metric)
    where = " WHERE " + " AND ".join(f"({f})" for f in fs) if fs else ""
    src = quote_ident(table) if table else "<table>"
    return f"SELECT {metric.get('expression') or ''} AS value FROM {src}{where}"


def _table_of(metric: dict) -> str | None:
    ds = store.get("datasets", metric["dataset_id"]) if metric.get("dataset_id") else None
    return ds.get("physical_name") if ds else None


def applicable_metric_lines(dataset_id: str, table: str) -> list[str]:
    """Defined key numbers that also fit this dataset (every column they use exists here), e.g. one defined on
    sales_combined applies to a fresh combine of the same tables. Rewritten against `table`."""
    def cols_of(ds_id: str | None) -> set[str]:
        return {c["name"].lower() for c in store.list("columns_meta", where="dataset_id = ?", params=[ds_id], order=None)}
    cols = cols_of(dataset_id)
    out = []
    for m in store.list("metrics", order=None):
        if m.get("dataset_id") != dataset_id:
            text = " ".join([m.get("expression") or ""] + filters_of(m))
            idents = {w.lower() for w in re.findall(r"[A-Za-z_]\w*", re.sub(r"'[^']*'", "", text))}
            used = idents & cols_of(m.get("dataset_id"))
            if not used or not used <= cols:
                continue
        line = f"- {m.get('label') or m['name']}: {metric_sql(m, table)}"
        out.append(line + (f"  -- {m['description']}" if m.get("description") else ""))
    return out[:20]


def metrics_in_scope(dataset_id: str | None) -> list[dict]:
    where, params = ("dataset_id = ?", [dataset_id]) if dataset_id else ("", None)
    return store.list("metrics", where=where, params=params, order=None)


def metric_lines(dataset_id: str | None, limit: int = 20) -> list[str]:
    """Prompt lines: every defined metric with its canonical SQL, which the model must reuse verbatim."""
    out = []
    for m in metrics_in_scope(dataset_id)[:limit]:
        line = f"- {m.get('label') or m['name']} ({m['name']}): {metric_sql(m, _table_of(m))}"
        out.append(line + (f"  -- {m['description']}" if m.get("description") else ""))
    return out


def _words(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9]+", " ", (text or "").lower()) + " "


def _known_vocab(dataset_id: str | None) -> str:
    """Everything that may legitimately answer a metric word: metrics, definitions, synonyms, column names."""
    bits = [f"{m.get('name')} {m.get('label')}" for m in metrics_in_scope(dataset_id)]
    bits += [d.get("term", "") for d in store.list("definitions", order=None)]
    bits += [f"{s.get('term')} {s.get('maps_to')}" for s in store.list("synonyms", order=None)]
    where, params = ("dataset_id = ?", [dataset_id]) if dataset_id else ("", None)
    bits += [c["name"] for c in store.list("columns_meta", where=where, params=params, order=None)]
    return _words(" ".join(str(b) for b in bits))


def undefined_metric(question: str, dataset_id: str | None = None) -> str | None:
    """The first ambiguous business metric the question names that nothing defines, else None (deterministic)."""
    q = (question or "").lower()
    asked = [k for k, pat in AMBIGUOUS_METRICS.items() if re.search(pat, q)]
    if not asked:
        return None
    vocab = _known_vocab(dataset_id)
    for key in asked:
        stem = key if " " in key else key[:6]   # 'profit' matches net_profit, profit_usd, profitability ...
        if not any(" " + s.replace("_", " ") in vocab for s in (stem, *_ALIASES.get(key, ()))):
            return key
    return None


def clarify_text(term: str) -> str:
    return (f"\"{term}\" isn't defined in your semantic layer and no column provides it, so I won't guess a formula. "
            f"How should {term} be calculated (e.g. which columns)? You can also define it once under Metrics.")


def metrics_used(sql: str, dataset_id: str | None = None) -> list[dict[str, Any]]:
    """Defined metrics whose expression appears in the executed SQL (whitespace/case-insensitive)."""
    norm = re.sub(r"\s+", "", (sql or "").lower())
    used = []
    for m in metrics_in_scope(dataset_id):
        expr = re.sub(r"\s+", "", (m.get("expression") or "").lower())
        if expr and expr in norm:
            used.append({"id": m.get("id"), "name": m.get("name"), "label": m.get("label"),
                         "expression": m.get("expression"), "filters": filters_of(m),
                         "definition_sql": metric_sql(m, _table_of(m))})
    return used
