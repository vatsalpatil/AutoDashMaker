"""Data tests (dbt-style): assertions on a dataset that run after every refresh.

Each test compiles to one read-only query counting the rows that break it (0 = pass). When an `error` test fails
right after a refresh, the dataset is rolled back to its previous version, so dashboards keep showing good data.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..core.store import store, DEFAULT_WS
from . import audit, versions
from .engine import engine

KINDS = {"not_null", "unique", "accepted_values", "range", "min_rows", "custom_sql"}


def _ident(name: str) -> str:
    return '"' + str(name).replace('"', '""') + '"'


def _lit(v: Any) -> str:
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def compile_sql(test: dict, table: str) -> str:
    """SQL returning one row {n}: how many rows break the test (for min_rows: 1 if too few rows)."""
    kind, cfg = test["kind"], test.get("config") or {}
    col = _ident(test.get("column_name") or "")
    if kind == "not_null":
        return f"SELECT count(*) AS n FROM {table} WHERE {col} IS NULL"
    if kind == "unique":
        return f"SELECT coalesce(sum(c - 1), 0) AS n FROM (SELECT count(*) AS c FROM {table} WHERE {col} IS NOT NULL GROUP BY {col} HAVING count(*) > 1)"
    if kind == "accepted_values":
        values = cfg.get("values") or []
        if not values:
            raise ValueError("accepted_values needs a list of values")
        return f"SELECT count(*) AS n FROM {table} WHERE {col} IS NOT NULL AND {col} NOT IN ({', '.join(_lit(v) for v in values)})"
    if kind == "range":
        conds = []
        if cfg.get("min") is not None:
            conds.append(f"{col} < {float(cfg['min'])!r}")
        if cfg.get("max") is not None:
            conds.append(f"{col} > {float(cfg['max'])!r}")
        if not conds:
            raise ValueError("range needs a min or a max")
        return f"SELECT count(*) AS n FROM {table} WHERE {' OR '.join(conds)}"
    if kind == "min_rows":
        return f"SELECT CASE WHEN count(*) < {int(cfg.get('rows', 1))} THEN 1 ELSE 0 END AS n FROM {table}"
    if kind == "custom_sql":
        sql = str(cfg.get("sql") or "").strip().rstrip(";")
        if not sql:
            raise ValueError("custom_sql needs a query that returns the bad rows")
        return f"SELECT count(*) AS n FROM ({sql}) AS bad"
    raise ValueError(f"unknown test kind: {kind}")


def describe(test: dict) -> str:
    cfg, col = test.get("config") or {}, test.get("column_name")
    return {
        "not_null": f"{col} is never empty",
        "unique": f"{col} has no duplicates",
        "accepted_values": f"{col} is one of {', '.join(map(str, cfg.get('values') or []))}",
        "range": f"{col} is between {cfg.get('min', '-∞')} and {cfg.get('max', '∞')}",
        "min_rows": f"at least {cfg.get('rows', 1)} rows",
        "custom_sql": "custom query returns no rows",
    }.get(test["kind"], test["kind"])


def run_test(test: dict, table: str) -> dict:
    try:
        n = int(engine.execute(compile_sql(test, table), row_limit=1, fresh=True)["rows"][0]["n"] or 0)
        status = "pass" if n == 0 else "fail"
        detail = "OK" if n == 0 else ("too few rows" if test["kind"] == "min_rows" else f"{n:,} bad rows")
    except Exception as e:  # a broken test (missing column, bad SQL) counts as a failure with its reason
        status, detail = "fail", f"could not run: {e}"
    store.update("dataset_tests", test["id"], {"last_status": status, "last_detail": detail, "last_run_at": datetime.now(timezone.utc)})
    return {**test, "last_status": status, "last_detail": detail, "label": describe(test)}


def run_all(ds: dict) -> list[dict]:
    tests = store.list("dataset_tests", where="dataset_id = ?", params=[ds["id"]], order=None)
    return [run_test(t, ds["physical_name"]) for t in tests]


def check_after_refresh(ds: dict) -> str | None:
    """Run the dataset's tests; if an error-level test fails, roll back to the previous version.
    Returns a message when the refresh was rejected (the caller reports it as a refresh error), else None."""
    failed = [r for r in run_all(ds) if r["last_status"] == "fail" and r.get("severity", "error") == "error"]
    if not failed:
        return None
    what = "; ".join(f"{r['label']} ({r['last_detail']})" for r in failed[:3])
    history = versions.list_versions(ds["physical_name"]) if not ds.get("remote_table") else []
    if history:
        versions.restore(ds, history[0]["version"])
        msg = f"Refresh of {ds['name']} rolled back: {what}"
    else:
        msg = f"{ds['name']} failed its tests after refresh: {what}"
    store.insert("notifications", {"workspace_id": DEFAULT_WS, "message": msg})
    audit.record("dataset.tests", entity_type="dataset", entity_id=ds["id"], detail=msg, status="error")
    return msg
