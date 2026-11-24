"""Join several datasets into one analysis table along the saved relationships (for the dashboard generator & co).
Tables with no saved relationship are linked by their obvious keys (rel_suggest: same key name, overlapping values) and
those links are reported as `auto_links`.

Start from the biggest selected table (usually the facts, e.g. order_items) and walk the relationship graph outward,
LEFT JOINing each neighbour **only if its join key is unique** on that side (many-to-one). A one-to-many neighbour
(e.g. 12 monthly targets per region) would repeat every fact row and inflate every total, so it is left out and
reported instead. Clashing column names get the dataset name as prefix.
"""
from __future__ import annotations

from typing import Any

from ..core.security import quote_ident
from ..core.store import store
from .engine import engine


class BlendError(ValueError):
    pass


def _unique(table: str, col: str) -> bool:
    q = quote_ident(col)
    res = engine.execute(f"SELECT COUNT(*) AS n, COUNT(DISTINCT {q}) AS d FROM {table}", 1)
    row = res["rows"][0]
    n, d = (row["n"], row["d"]) if isinstance(row, dict) else (row[0], row[1])
    return n == d


def plan(dataset_ids: list[str]) -> dict[str, Any]:
    """{sql, used: [names], skipped: [{name, reason}]} for the selected datasets."""
    ds = [d for d in (store.get("datasets", i) for i in dict.fromkeys(dataset_ids)) if d and d.get("physical_name")]
    if len(ds) < 2:
        raise BlendError("pick at least two datasets to combine")
    by_id = {d["id"]: d for d in ds}
    edges = [r for r in store.list("relationships", order=None)
             if r["left_dataset_id"] in by_id and r["right_dataset_id"] in by_id]
    linked = {i for r in edges for i in (r["left_dataset_id"], r["right_dataset_id"])}
    auto: list[str] = []
    if len(linked) < len(ds):   # tables nobody linked yet: use the obvious keys (same key name, values that match)
        from .rel_suggest import suggest
        for s in suggest(set(by_id)):
            if s["left_dataset_id"] not in linked or s["right_dataset_id"] not in linked:
                edges.append(s)
                auto.append(f"{s['left_dataset']}.{s['left_column']} = {s['right_dataset']}.{s['right_column']}")
    links = {d["id"]: sum(d["id"] in (r["left_dataset_id"], r["right_dataset_id"]) for r in edges) for d in ds}
    base = max(ds, key=lambda d: (links[d["id"]] > 0, d.get("row_count") or 0, links[d["id"]]))   # a linked facts table
    alias = {base["id"]: "t0"}
    cols_seen = {c["name"].lower() for c in store.list("columns_meta", where="dataset_id = ?", params=[base["id"]], order=None)}
    selects = [f"t0.{quote_ident(c['name'])}" for c in store.list("columns_meta", where="dataset_id = ?", params=[base["id"]], order=None)]
    joins: list[str] = []
    skipped: dict[str, str] = {}
    frontier = [base["id"]]
    while frontier:
        cur = frontier.pop(0)
        for r in edges:
            for here, there, here_col, there_col in ((r["left_dataset_id"], r["right_dataset_id"], r["left_column"], r["right_column"]),
                                                     (r["right_dataset_id"], r["left_dataset_id"], r["right_column"], r["left_column"])):
                if here != cur or there in alias:
                    continue
                other = by_id[there]
                if not _unique(other["physical_name"], there_col):
                    skipped.setdefault(other["name"], f"several rows per {there_col}: joining it would repeat rows and inflate totals")
                    continue
                a = f"t{len(alias)}"
                alias[there] = a
                skipped.pop(other["name"], None)
                joins.append(f"LEFT JOIN {other['physical_name']} AS {a} ON {alias[cur]}.{quote_ident(here_col)} = {a}.{quote_ident(there_col)}")
                for c in store.list("columns_meta", where="dataset_id = ?", params=[there], order=None):
                    n = c["name"]
                    if n.lower() == there_col.lower() and n.lower() in cols_seen:
                        continue   # the join key is already there
                    out = n if n.lower() not in cols_seen else f"{other['name']}_{n}"
                    cols_seen.add(out.lower())
                    selects.append(f"{a}.{quote_ident(n)} AS {quote_ident(out)}")
                frontier.append(there)
    for d in ds:
        if d["id"] not in alias and d["name"] not in skipped:
            skipped[d["name"]] = "no shared key links it to the others (add a relationship in Data Sources → Relationships)"
    used = [by_id[i]["name"] for i in alias]
    if len(used) < 2:
        raise BlendError("these datasets can't be combined row by row: " + "; ".join(f"{k}: {v}" for k, v in skipped.items()))
    sql = f"SELECT {', '.join(selects)} FROM {base['physical_name']} AS t0 " + " ".join(joins)
    return {"sql": sql, "used": used, "skipped": [{"name": k, "reason": v} for k, v in skipped.items()], "auto_links": auto}
