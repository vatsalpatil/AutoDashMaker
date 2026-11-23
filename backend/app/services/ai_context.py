"""Prompt context for the AI endpoints: what the model may see (tables, saved queries, semantic layer, notebook)."""
import re

from ..core.store import store
from . import column_stats, column_values, names, semantic
from .engine import engine

FULL_SCHEMA_TABLES = 12   # up to this many tables every table lists its columns
TOP_FULL_TABLES = 8       # beyond it, only the most relevant tables do (schema linking)


def semantic_context(dataset_id: str | None) -> str:
    """Compact business context: metrics, dimensions, definitions, synonyms, verified query examples (§46)."""
    where, params = ("dataset_id = ?", [dataset_id]) if dataset_id else ("", None)

    metrics_txt = "\n".join(semantic.metric_lines(dataset_id)) or "none defined"

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
    datasets = [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    column_stats.ensure(datasets)   # older imports only stored names + types
    by_id = {d["id"]: d for d in datasets}
    cols: dict[str, list[str]] = {}
    for c in store.list("columns_meta", order=None):
        d = by_id.get(c["dataset_id"])   # text columns with few values list them, so filters use the exact spelling
        cols.setdefault(c["dataset_id"], []).append(column_values.describe(d, c) if d else f"{c['name']} {c['dtype']}")
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
    text = ("All tables you may query (`col TYPE = 'a'|'b'` lists every value of that column; text comparisons are "
            "case-sensitive, so use those exact values):\n" + "\n".join(table_lines)[:7000])

    text += relationships_text(datasets)

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


def relationships_text(datasets: list[dict] | None = None) -> str:
    """The user's saved relationships, with how many rows match on each side, so the model joins the way the user defined
    and knows when a join repeats rows (aggregate the 'many' side first). '' when there are none."""
    datasets = datasets if datasets is not None else [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    by_id = {d["id"]: d for d in datasets}
    rels = [r for r in store.list("relationships", order=None) if r["left_dataset_id"] in by_id and r["right_dataset_id"] in by_id]
    if not rels:
        return ""
    meta = {(c["dataset_id"], c["name"].lower()): c for c in store.list("columns_meta", order=None)}

    def unique(ds_id: str, col: str) -> bool | None:
        c, rows = meta.get((ds_id, col.lower())), by_id[ds_id].get("row_count")
        return None if not c or not c.get("distinct_count") or not rows else c["distinct_count"] >= rows

    lines = []
    for r in rels[:25]:
        l, rt = by_id[r["left_dataset_id"]], by_id[r["right_dataset_id"]]
        lu, ru = unique(l["id"], r["left_column"]), unique(rt["id"], r["right_column"])
        kind = {(True, True): "one-to-one", (True, False): f"one {names.label(l)} row ↔ many {names.label(rt)} rows",
                (False, True): f"many {names.label(l)} rows ↔ one {names.label(rt)} row"}.get((lu, ru), "many-to-many: aggregate one side before joining")
        lines.append(f"- {names.label(l)}.{r['left_column']} = {names.label(rt)}.{r['right_column']} ({kind})")
    return ("\n\nHow the tables join (saved by the user; use these join keys. When a join is one-to-many, totals from the "
            "'one' side repeat: aggregate the 'many' side in a CTE first):\n" + "\n".join(lines))
