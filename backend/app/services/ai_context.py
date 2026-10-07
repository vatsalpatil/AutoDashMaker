"""Prompt context for the AI endpoints: what the model may see (tables, saved queries, semantic layer, notebook)."""
import re

from ..core.store import store
from . import names
from .engine import engine

FULL_SCHEMA_TABLES = 12   # up to this many tables every table lists its columns
TOP_FULL_TABLES = 8       # beyond it, only the most relevant tables do (schema linking)


def semantic_context(dataset_id: str | None) -> str:
    """Compact business context: metrics, dimensions, definitions, synonyms, verified query examples (§46)."""
    where, params = ("dataset_id = ?", [dataset_id]) if dataset_id else ("", None)

    parts = []
    for m in store.list("metrics", where=where, params=params, order=None)[:20]:
        line = f"- {m['label']} ({m['name']}): {m['expression']}"
        if m.get("filters"):
            f = m["filters"]
            line += f" WHERE {' AND '.join(f) if isinstance(f, list) else f}"
        if m.get("description"):
            line += f"  — {m['description']}"
        parts.append(line)
    metrics_txt = "\n".join(parts) or "none defined"

    dims = store.list("dimensions", where=where, params=params, order=None)[:20]
    dims_txt = "\n".join(f"- {d['label']}: column {d['column_name']}" for d in dims) or "none defined"
    defs = store.list("definitions", order=None)[:20]
    defs_txt = "\n".join(f"- {d['term']}: {d['definition']}" for d in defs) or "none defined"
    syns = store.list("synonyms", order=None)[:20]
    syns_txt = ", ".join(f"{s['term']} = {s['maps_to']}" for s in syns) or "none"
    verified = store.list("verified_queries", where=where, params=params, order=None)[:5]
    ver_txt = "\n".join(f"Q: {v['question']}\nSQL: {v['sql']}" for v in verified) or "none"

    return (f"METRICS:\n{metrics_txt}\n\nDIMENSIONS:\n{dims_txt}\n\n"
            f"BUSINESS DEFINITIONS:\n{defs_txt}\n\nSYNONYMS: {syns_txt}\n\n"
            f"VERIFIED EXAMPLE QUERIES:\n{ver_txt}")


def table_schema_text(dataset: dict) -> str:
    """One table's columns with sample values, for the single-table prompts."""
    schema = engine.describe_table(dataset["physical_name"])
    col_lines = "\n".join(f"- {c['name']} ({c['dtype']}) samples={c['sample_values'][:3]}" for c in schema["columns"][:40])
    return f'Table: {names.label(dataset)} ({schema["row_count"]} rows)\nColumns:\n{col_lines}\n'


def relevance(question: str, d: dict, col_names: list[str]) -> int:
    """How likely a table is needed for `question`: word overlap with its name (strong) and column names."""
    score = 0
    name = f"{d.get('physical_name', '')} {d.get('name', '')}".lower()
    cols = " ".join(col_names).lower()
    for w in set(re.findall(r"[a-z0-9]{3,}", (question or "").lower())):
        score += 3 if w in name else 0
        score += 1 if w in cols else 0
    return score


def workbench_context(selected_id: str | None, question: str | None = None) -> str:
    """What the workbench assistant can see: the tables with their columns, and the saved queries.

    Column lists come from metadata (no table scans). With many tables, only the selected one and the
    best matches for the question list their columns; the rest appear by name only, keeping the prompt small.
    """
    cols: dict[str, list[str]] = {}
    for c in store.list("columns_meta", order=None):
        cols.setdefault(c["dataset_id"], []).append(f"{c['name']} {c['dtype']}")
    datasets = [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    full_ids = {d["id"] for d in datasets}
    if len(datasets) > FULL_SCHEMA_TABLES:
        ranked = sorted(datasets, key=lambda d: (d["id"] != selected_id,
                                                 -relevance(question or "", d, [c.split()[0] for c in cols.get(d["id"], [])])))
        full_ids = {d["id"] for d in ranked[:TOP_FULL_TABLES]}
    table_lines = [
        f"- {names.label(d)}{' (selected)' if d['id'] == selected_id else ''} [{d.get('row_count', '?')} rows]"
        + (f": {', '.join(cols.get(d['id'], [])[:40])}" if d["id"] in full_ids else " (columns omitted: not relevant to this question)")
        for d in datasets
    ]
    text = "All tables you may query:\n" + "\n".join(table_lines)[:6000]

    saved, seen = [], set()
    for q in store.list("queries", order="created_at DESC"):
        sql = (q.get("sql") or "").strip()
        key = (str(q.get("name", "")).lower(), sql)  # users refer to queries by name, so keep distinct names
        if not sql or key in seen or q.get("status") not in (None, "ok"):
            continue
        seen.add(key)
        saved.append(f'- "{q.get("name")}": {sql[:350]}')
        if len(saved) >= 12:
            break
    if saved:
        text += ("\n\nThe user's saved queries (they may refer to them by name; to reuse one, inline its SQL "
                 "as a CTE):\n" + "\n".join(saved))
    return text


def with_notebook_steps(ctx: str, cells: list[dict]) -> str:
    """Append earlier notebook cells, which the model may query by name exactly like tables."""
    steps = [f"- {c.get('name')}: {str(c.get('sql', '')).strip()[:300]}" for c in cells[:12]
             if c.get("name") and str(c.get("sql", "")).strip()]
    if not steps:
        return ctx
    return ctx + ("\n\nNotebook steps (earlier cells; query any of them by name exactly like a table, e.g. "
                  "SELECT * FROM step_1):\n" + "\n".join(steps))
