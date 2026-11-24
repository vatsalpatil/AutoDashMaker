"""Relationship suggestions: only real join keys, not every column that happens to share a name.

A pair is suggested when the column is key-like (an id/code/sku name, or unique on one side), is not a measure or a
date, the types match, and the values actually overlap. Pairs inside the same folder come first. Blends are skipped:
they already contain the tables they were joined from.
"""
from __future__ import annotations

import re
from typing import Any

from ..core.security import quote_ident
from ..core.store import store
from .engine import engine

_KEYNAME = re.compile(r"(^|_)(id|uuid|key|code|sku|no|number)$", re.I)
_SKIP_TYPE = re.compile(r"DATE|TIME|DOUBLE|FLOAT|DECIMAL|REAL|BOOL", re.I)


def _unique(col: dict, rows: int | None) -> bool:
    d = col.get("distinct_count") or 0
    return bool(rows) and d >= 0.98 * rows and d > 1


_NUMBER = re.compile(r"INT|NUMERIC", re.I)


def _keyish(col: dict, rows: int | None) -> bool:
    if _NUMBER.search(col.get("dtype") or "") and not _KEYNAME.search(col["name"]):
        return False   # a unique price or amount is not a key: numbers need an id-like name
    # in a tiny table every column looks unique (2 regions in 2 rows): uniqueness alone needs some size to mean "key"
    return bool(_KEYNAME.search(col["name"])) or (_unique(col, rows) and (col.get("distinct_count") or 0) >= 20)


def _overlap(a: dict, b: dict, col_a: str, col_b: str) -> bool:
    """Do some values of a.col_a appear in b.col_b? (sampled, so it stays fast on big tables)"""
    ta, tb = quote_ident(a["physical_name"]), quote_ident(b["physical_name"])
    sql = (f"SELECT count(*) AS n FROM (SELECT DISTINCT {quote_ident(col_a)} AS v FROM {ta} WHERE {quote_ident(col_a)} IS NOT NULL LIMIT 200) s "
           f"WHERE v IN (SELECT {quote_ident(col_b)} FROM {tb})")
    try:
        return engine.execute(sql, 1)["rows"][0]["n"] > 0
    except Exception:  # noqa: BLE001 - a table that can't be read just isn't suggested
        return False


def suggest(only: set[str] | None = None) -> list[dict[str, Any]]:
    """All suggestions, or only between the datasets in `only` (ids)."""
    datasets = [d for d in store.list("datasets", order=None) if d.get("kind") != "blend" and d.get("physical_name")
                and (only is None or d["id"] in only)]
    cols = {d["id"]: store.list("columns_meta", where="dataset_id = ?", params=[d["id"]], order=None) for d in datasets}
    existing = {(r["left_dataset_id"], r["left_column"], r["right_dataset_id"], r["right_column"])
                for r in store.list("relationships", order=None)}
    out = []
    for i, a in enumerate(datasets):
        for b in datasets[i + 1:]:
            b_by_name = {c["name"]: c for c in cols[b["id"]]}
            for ca in cols[a["id"]]:
                cb = b_by_name.get(ca["name"])
                if not cb or ca["dtype"] != cb["dtype"] or _SKIP_TYPE.search(ca["dtype"] or ""):
                    continue
                if not (_keyish(ca, a.get("row_count")) or _keyish(cb, b.get("row_count"))):
                    continue
                if (a["id"], ca["name"], b["id"], cb["name"]) in existing or (b["id"], cb["name"], a["id"], ca["name"]) in existing:
                    continue
                # the unique (one) side goes left, so the default left join keeps every row of the many side's partner
                left, right = (a, b) if _unique(ca, a.get("row_count")) or not _unique(cb, b.get("row_count")) else (b, a)
                if not _overlap(left, right, ca["name"], cb["name"]):
                    continue
                out.append({"left_dataset_id": left["id"], "left_dataset": left["name"], "left_column": ca["name"],
                            "right_dataset_id": right["id"], "right_dataset": right["name"], "right_column": cb["name"],
                            "dtype": ca["dtype"], "same_folder": bool(a.get("folder")) and a.get("folder") == b.get("folder")})
    return sorted(out, key=lambda s: not s["same_folder"])
