"""Friendly dataset names in SQL: `SELECT * FROM Chocolate_Sales` works like `... FROM ds_chocolate_sales_2325ab`.

Datasets are stored under a physical table name with an id suffix; people think in the dataset's own name. Queries may use
either: this rewrites friendly table names to the physical ones before validation and execution. Names that are CTEs /
notebook steps, that are ambiguous, or that already are a physical table name are left alone."""
from __future__ import annotations

import re
import threading
import time

from ..core import tenant
from ..core.store import store

_TTL = 5.0
_lock = threading.Lock()
_cache: dict[str, tuple[float, int, dict[str, str]]] = {}  # workspace -> (time, datasets version, mapping)


def _map() -> dict[str, str]:
    """friendly name (lower-case) -> physical table, for unambiguous names only."""
    ws = tenant.current()
    with _lock:
        version = store.version("datasets")  # any dataset insert/rename/delete invalidates immediately
        hit = _cache.get(ws)
        if hit and hit[1] == version and time.monotonic() - hit[0] < _TTL:
            return hit[2]
        rows = store.list("datasets", order=None)
        physical = {(r.get("physical_name") or "").lower() for r in rows}
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["name"].lower()] = counts.get(r["name"].lower(), 0) + 1
        out = {r["name"].lower(): r["physical_name"] for r in rows
               if r.get("physical_name") and counts[r["name"].lower()] == 1 and r["name"].lower() not in physical}
        _cache[ws] = (time.monotonic(), version, out)
        return out


def invalidate() -> None:
    with _lock:
        _cache.clear()


def resolve(sql: str) -> str:
    """Rewrite friendly dataset names used as tables to their physical tables (a no-op when none is used)."""
    try:
        names = _map()
        low = sql.lower()
        if not names or not any(n in low for n in names):
            return sql
        import sqlglot
        from sqlglot import exp
        tree = sqlglot.parse_one(sql, read="duckdb")
        ctes = {c.alias.lower() for c in tree.find_all(exp.CTE) if c.alias}

        def swap(node):
            if isinstance(node, exp.Table) and not node.args.get("db") and not node.args.get("catalog"):
                key = node.name.lower()
                if key in names and key not in ctes:
                    new = exp.to_table(names[key])
                    new.set("alias", node.args.get("alias") or exp.TableAlias(this=exp.to_identifier(node.name)))
                    return new
            return node

        return tree.transform(swap).sql(dialect="duckdb")
    except Exception:
        return sql  # unparseable here: let the normal path report the real error


def label(d: dict) -> str:
    """The name to show / put in prompts for a dataset: its own name when SQL resolves it, else the physical table."""
    return d["name"] if _map().get(d["name"].lower()) == d.get("physical_name") else (d.get("physical_name") or d["name"])
