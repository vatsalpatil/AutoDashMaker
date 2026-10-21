"""Backoffice data control: every workspace's sources, datasets, dashboards and share links, with owner emails.

Actions run INSIDE the owner's workspace (tenant.run_as) through the same code the app uses, so engine files,
Parquet, columns and widgets are cleaned up exactly as when the user does it themselves.
"""
from __future__ import annotations

from fastapi import HTTPException

from ...core import tenant
from ...core.store import store
from .users import owner_map

_LISTS = {
    "datasets": "SELECT id, workspace_id, name, kind, row_count, column_count, auto_refresh, last_refresh_error, "
                "remote_table IS NOT NULL AS live, created_at, refreshed_at FROM datasets",
    "dashboards": "SELECT d.id, d.workspace_id, d.name, d.created_at, d.updated_at, "
                  "(SELECT COUNT(*) FROM dashboard_widgets w WHERE w.dashboard_id = d.id) AS widgets FROM dashboards d",
    "sources": "SELECT id, workspace_id, name, type, status, created_at, updated_at FROM datasources",
    "shares": "SELECT id, workspace_id, dashboard_id, expires_at, revoked, views, last_viewed_at, created_at FROM dashboard_shares",
}


def _rows(kind: str) -> list[dict]:
    if kind not in _LISTS:
        raise HTTPException(404, f"Unknown data kind {kind}")
    rows = store.execute(_LISTS[kind] + " ORDER BY created_at DESC LIMIT 2000")
    owners = owner_map()
    for r in rows:
        r["owner"] = owners.get(r["workspace_id"], r["workspace_id"])
    return rows


def list_data(kind: str) -> list[dict]:
    return _rows(kind)


def _owner_ws(table: str, row_id: str) -> str:
    rows = store.execute(f"SELECT workspace_id FROM {table} WHERE id = ?", [row_id])
    if not rows:
        raise HTTPException(404, "Not found")
    return rows[0]["workspace_id"]


def delete(kind: str, row_id: str) -> dict:
    if kind == "datasets":
        from ...routers.datasets import delete_dataset as fn
    elif kind == "dashboards":
        from ...routers.dashboards import delete_dashboard as fn
    elif kind == "sources":
        from ...routers.datasources import delete_source as fn
    else:
        raise HTTPException(400, f"{kind} cannot be deleted here")
    table = {"sources": "datasources"}.get(kind, kind)
    return tenant.run_as(_owner_ws(table, row_id), fn, row_id)


def refresh(dataset_id: str) -> dict:
    from .. import refresh_jobs
    return tenant.run_as(_owner_ws("datasets", dataset_id), refresh_jobs.start, dataset_id)


def revoke_share(share_id: str) -> dict:
    _owner_ws("dashboard_shares", share_id)
    store.execute("UPDATE dashboard_shares SET revoked = TRUE WHERE id = ?", [share_id])
    return {"revoked": True}


def storage() -> list[dict]:
    """Disk used per workspace (analytics DB + Parquet + uploads), biggest first."""
    from .users import _dir_bytes
    owners = owner_map()
    out = []
    for ws in {r["workspace_id"] for r in store.execute("SELECT DISTINCT workspace_id FROM datasets")}:
        try:
            out.append({"workspace_id": ws, "owner": owners.get(ws, ws), "bytes": _dir_bytes(ws)})
        except ValueError:
            continue
    return sorted(out, key=lambda r: -r["bytes"])
