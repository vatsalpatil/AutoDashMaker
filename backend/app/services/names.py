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


_PHYSICAL = re.compile(r"\bds_(\w+?)_([0-9a-f]{6})\b", re.IGNORECASE)


def restale(sql: str) -> str:
    """A saved query can name a dataset's old table (`ds_sales_75c35d`) after the file was re-uploaded under a new id
    (`ds_sales_bda92d`): point it at the current table when exactly one dataset table has that base name."""
    if not _PHYSICAL.search(sql):
        return sql
    tables = {(r.get("physical_name") or "").lower() for r in store.list("datasets", order=None)} - {""}
    by_base: dict[str, list[str]] = {}
    for t in tables:
        m = _PHYSICAL.fullmatch(t)
        if m:
            by_base.setdefault(m.group(1), []).append(t)

    def fix(m: re.Match) -> str:
        name, base = m.group(0).lower(), m.group(1).lower()
        if name in tables or len(by_base.get(base, [])) != 1:
            return m.group(0)
        return by_base[base][0]
    return _PHYSICAL.sub(fix, sql)


def resolve(sql: str) -> str:
    """Rewrite friendly dataset names used as tables to their physical tables (a no-op when none is used)."""
    try:
        sql = restale(sql)
        names = _map()
        low = sql.lower()
        if not names or not any(n in low for n in names):
            return sql
        import sqlglot
        from sqlglot import exp
        tree = sqlglot.parse_one(sql, read="duckdb")
        ctes = {c.alias.lower() for c in tree.find_all(exp.CTE) if c.alias}

        def swap(node):
            if isinstance(node, exp.Table) and not node.args.get("catalog"):
                db = node.args.get("db")
                # a dataset named like `test.Chocolate_Sales` parses as schema.table: match the whole dotted name
                key = f"{db.name}.{node.name}".lower() if db else node.name.lower()
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
