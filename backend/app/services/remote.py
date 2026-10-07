"""Linked ("live") datasets: only the schema is imported; queries run against the remote table.

A linked dataset is a DuckDB VIEW in the analytics DB over an attached remote catalog
(`remote_<source id>`). The attachment is not stored in the file, so the engine attaches the source on
demand whenever a query mentions a linked dataset (see `attach_remotes`). Rows are never copied.

Why a rewrite and not just the view: DuckDB's MySQL scanner raises internal binder errors for aggregates
queried through a view over a remote table, while the same query against the attached table works. So the
view only exists to list the dataset and describe its schema; `rewrite_sql` points queries at the attached
table directly.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from ..connectors import ConnectorError, get_connector
from ..core.store import DEFAULT_ORG, DEFAULT_USER, DEFAULT_WS, store
from . import audit
from .ingest import safe_table_name

_lock = threading.Lock()
_linked: list[dict[str, Any]] | None = None  # cache: [{name (lowercase view name), source}]


def alias_for(source_id: str) -> str:
    return f"remote_{source_id}"


def invalidate() -> None:
    """Forget the cached list of linked datasets (call after link / unlink / editing a source)."""
    global _linked
    with _lock:
        _linked = None


def _load() -> list[dict[str, Any]]:
    global _linked
    with _lock:
        if _linked is None:
            try:
                rows = store.list("datasets", where="remote_table IS NOT NULL", order=None)
            except Exception:
                # database created before linked datasets existed: add the column now (idempotent), then retry once
                try:
                    store.execute("ALTER TABLE datasets ADD COLUMN IF NOT EXISTS remote_table TEXT")
                    rows = store.list("datasets", where="remote_table IS NOT NULL", order=None)
                except Exception:
                    return []  # never let a metadata problem block ordinary queries
            out = []
            for ds in rows:
                src = store.get("datasources", ds["source_id"]) if ds.get("source_id") else None
                if src:
                    out.append({"name": ds["physical_name"].lower(), "source": src, "remote": ds["remote_table"]})
            _linked = out
        return _linked


def attach_remotes(con, hint: str | None) -> None:
    """Attach every source whose linked dataset is mentioned in `hint` (a SQL text or table name)."""
    if not hint:
        return
    text = hint.lower()
    done: set[str] = set()
    for item in _load():
        src = item["source"]
        if item["name"] in text and src["id"] not in done:
            get_connector(src["type"], src["config"]).attach(con, alias_for(src["id"]))
            done.add(src["id"])


def _remote_table(item: dict[str, Any]):
    """sqlglot Table node for the attached remote table of a linked dataset (`schema.table` names supported)."""
    from sqlglot import exp

    parts = item["remote"].split(".")
    return exp.Table(
        this=exp.to_identifier(parts[-1], quoted=True),
        db=exp.to_identifier(parts[-2], quoted=True) if len(parts) > 1 else None,
        catalog=exp.to_identifier(alias_for(item["source"]["id"])),
    )


def mentions_linked(hint: str | None) -> bool:
    text = (hint or "").lower()
    return bool(text) and any(i["name"] in text for i in _load())


def is_linked(physical_name: str) -> bool:
    return any(i["name"] == physical_name.lower() for i in _load())


def table_ref(physical_name: str) -> str:
    """SQL text that reads the remote table behind a linked dataset (or the name itself for ordinary tables)."""
    for item in _load():
        if item["name"] == physical_name.lower():
            return _remote_table(item).sql(dialect="duckdb")
    return physical_name


def rewrite_sql(sql: str) -> str:
    """Point references to linked datasets at their attached remote tables (the user keeps writing the dataset name)."""
    items = {i["name"]: i for i in _load()}
    if not items or not any(n in sql.lower() for n in items):
        return sql
    import sqlglot
    from sqlglot import exp

    try:
        tree = sqlglot.parse_one(sql, read="duckdb")
    except Exception:
        return sql  # unparseable here: let DuckDB report the real error

    def swap(node):
        if isinstance(node, exp.Table) and not node.args.get("db") and not node.args.get("catalog"):
            item = items.get(node.name.lower())
            if item:
                new = _remote_table(item)
                new.set("alias", node.args.get("alias") or exp.TableAlias(this=exp.to_identifier(node.name)))
                return new
        return node

    return tree.transform(swap).sql(dialect="duckdb")


def link_source(src: dict, remote_name: str, friendly_name: str) -> dict[str, Any]:
    """Register `remote_name` of `src` as a linked dataset: create the view, read columns + row count."""
    from .engine import engine  # lazy: engine imports this module

    view = safe_table_name(friendly_name)
    try:
        with engine.writer() as con:
            connector = get_connector(src["type"], src["config"])
            connector.link(remote_name, view, con, alias_for(src["id"]))
            info = con.execute(f"PRAGMA table_info('{view}')").fetchall()
            count = connector.count_rows(con, alias_for(src["id"]), view, remote_name)
    except Exception as e:  # DuckDB/driver errors included: the UI shows the message instead of a bare 500
        audit.record("dataset.link", entity_type="source", entity_id=src["id"], detail=f"{friendly_name}: {e}", status="error")
        raise e if isinstance(e, ConnectorError) else ConnectorError(str(e)[:500]) from e
    columns = [{"name": r[1], "dtype": r[2]} for r in info]
    ds = store.insert("datasets", {
        "organization_id": DEFAULT_ORG, "workspace_id": DEFAULT_WS, "created_by": DEFAULT_USER,
        "source_id": src["id"], "name": friendly_name, "kind": src["type"], "physical_name": view,
        "row_count": count, "column_count": len(columns), "remote_table": remote_name,
        "refreshed_at": datetime.now(timezone.utc),
    })
    for c in columns:
        store.insert("columns_meta", {"dataset_id": ds["id"], **c})
    ds["columns"] = columns
    invalidate()
    audit.record("dataset.link", entity_type="source", entity_id=src["id"], detail=f"{friendly_name} ({count} rows, live)")
    return ds


def refresh_remote(ds: dict[str, Any]) -> dict[str, Any]:
    """Re-read the remote table's columns and row count (no data is copied)."""
    from .engine import engine

    with engine.writer() as con:
        attach_remotes(con, ds["physical_name"])
        src = store.get("datasources", ds["source_id"])
        info = con.execute(f"PRAGMA table_info('{ds['physical_name']}')").fetchall()
        count = get_connector(src["type"], src["config"]).count_rows(con, alias_for(src["id"]), ds["physical_name"], ds["remote_table"])
    store.execute("DELETE FROM columns_meta WHERE dataset_id = ?", [ds["id"]])
    for r in info:
        store.insert("columns_meta", {"dataset_id": ds["id"], "name": r[1], "dtype": r[2]})
    store.update("datasets", ds["id"], {"row_count": count, "column_count": len(info), "refreshed_at": datetime.now(timezone.utc)})
    return store.get("datasets", ds["id"])


def convert_to_linked(ds: dict[str, Any], remote_name: str | None = None) -> dict[str, Any]:
    """Turn a copied database dataset into a live link in place: the local rows are dropped, the same table name becomes
    a view over the source table (charts, queries and dashboards keep working) and only schema + stats are kept."""
    from .engine import engine

    src = store.get("datasources", ds["source_id"]) if ds.get("source_id") else None
    if not src or src["type"] not in ("mysql", "postgres", "sqlite"):
        raise ConnectorError("only datasets copied from a database can be switched to a live link")
    remote = remote_name or ds["name"]
    table = ds["physical_name"]
    try:
        with engine.writer() as con:
            connector = get_connector(src["type"], src["config"])
            connector.link(remote, f"{table}__live", con, alias_for(src["id"]))   # proves the table exists before the copy is dropped
            con.execute(f"DROP TABLE IF EXISTS {table}")
            con.execute(f"ALTER VIEW {table}__live RENAME TO {table}")
            info = con.execute(f"PRAGMA table_info('{table}')").fetchall()
            count = connector.count_rows(con, alias_for(src["id"]), table, remote)
    except Exception as e:
        raise e if isinstance(e, ConnectorError) else ConnectorError(str(e)[:500]) from e
    store.update("datasets", ds["id"], {"remote_table": remote, "row_count": count, "column_count": len(info), "refreshed_at": datetime.now(timezone.utc)})
    invalidate()
    audit.record("dataset.link", entity_type="dataset", entity_id=ds["id"], detail=f"{ds['name']} switched to a live link ({count} rows, nothing stored)")
    return store.get("datasets", ds["id"])
