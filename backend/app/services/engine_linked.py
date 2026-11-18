"""Schema profiling of linked (live) datasets, split out of engine.py to keep it small."""
from __future__ import annotations

from typing import Any


def describe_linked(eng, table: str) -> dict[str, Any]:
    """Schema of a linked (live) dataset: stored row count + stats from a 100-row sample.

    Profiling a whole remote table (distinct counts over millions of rows) would hammer the source."""
    from . import remote
    from ..core.store import store
    ref = remote.table_ref(table)
    with eng._session(hint=table) as con:
        rel = con.execute(f"SELECT * FROM {ref} LIMIT 100")
        names = [d[0] for d in rel.description]
        types = [str(d[1]) for d in rel.description]
        rows = rel.fetchall()
    meta = store.list("datasets", where="physical_name = ?", params=[table], order=None)
    total = int(meta[0].get("row_count") or len(rows)) if meta else len(rows)
    exact = _remote_stats(eng, meta[0], names) if meta else None
    columns = []
    for i, name in enumerate(names):
        vals = [r[i] for r in rows]
        present = [v for v in vals if v is not None]
        nulls, distinct = exact[name] if exact else (None, None)
        columns.append({
            "name": name, "dtype": types[i],
            "null_pct": round(nulls / total * 100, 2) if exact and total else round((len(vals) - len(present)) / len(vals) * 100, 2) if vals else 0,
            "distinct_count": distinct if exact else len({str(v) for v in present}),
            "sample_values": list(dict.fromkeys(str(v)[:60] for v in present))[:5],
        })
    return {"table": table, "row_count": total, "columns": columns, "sampled": not exact}

def _remote_stats(eng, ds: dict[str, Any], names: list[str]) -> dict[str, tuple[int, int]] | None:
    """Exact null/distinct counts computed inside the source database (one aggregate query, one row back)."""
    from ..connectors import get_connector
    from ..core.store import store
    from . import remote
    src = store.get("datasources", ds["source_id"]) if ds.get("source_id") else None
    if not src or not ds.get("remote_table"):
        return None
    try:
        with eng._session(hint=ds["physical_name"]) as con:
            return get_connector(src["type"], src["config"]).remote_profile(con, remote.alias_for(src["id"]), ds["remote_table"], names)
    except Exception:
        return None  # the sample-based profile is the fallback
