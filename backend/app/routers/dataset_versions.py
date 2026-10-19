"""Dataset versions (time travel): list past refreshes, preview one, roll back to it."""
import duckdb
from fastapi import APIRouter, HTTPException

from ..core.store import store
from ..services import audit, columnar, versions
from ..services.engine import engine

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _dataset(dataset_id: str) -> dict:
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    if ds.get("remote_table") or not columnar.parquet_path(ds["physical_name"]).exists():
        raise HTTPException(400, "This dataset has no stored copy, so it has no versions.")
    return ds


def _version_path(ds: dict, version: str):
    try:
        return versions.path_of(ds["physical_name"], version)
    except LookupError:
        raise HTTPException(404, "version not found")


@router.get("/{dataset_id}/versions")
def list_versions(dataset_id: str):
    ds = _dataset(dataset_id)
    return {"current": {"row_count": ds.get("row_count"), "refreshed_at": ds.get("refreshed_at")},
            "versions": versions.list_versions(ds["physical_name"]), "keep": versions.KEEP}


@router.get("/{dataset_id}/versions/{version}/preview")
def preview_version(dataset_id: str, version: str, limit: int = 50):
    path = str(_version_path(_dataset(dataset_id), version)).replace("\\", "/").replace("'", "''")
    con = duckdb.connect()  # private in-memory connection over a server-chosen file; no user SQL runs here
    try:
        rel = con.sql(f"SELECT * FROM read_parquet('{path}')")
        rows = rel.limit(max(1, min(limit, 500))).fetchall()
        count = con.sql(f"SELECT count(*) FROM read_parquet('{path}')").fetchone()[0]
        return {"columns": list(rel.columns),
                "rows": [dict(zip(rel.columns, r)) for r in rows], "row_count": count}
    finally:
        con.close()


@router.post("/{dataset_id}/versions/{version}/restore")
def restore_version(dataset_id: str, version: str):
    ds = _dataset(dataset_id)
    table = ds["physical_name"]
    _version_path(ds, version)
    with engine.writer() as con:
        versions.restore_file(table, version, columnar.parquet_path(table))
        columnar.point_view(con, table)
        info = con.execute(f"PRAGMA table_info('{table}')").fetchall()
        count = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
    store.execute("DELETE FROM columns_meta WHERE dataset_id = ?", [dataset_id])
    for r in info:
        store.insert("columns_meta", {"dataset_id": dataset_id, "name": r[1], "dtype": r[2]})
    store.update("datasets", dataset_id, {"row_count": count, "column_count": len(info)})
    audit.record("dataset.restore", entity_type="dataset", entity_id=dataset_id, detail=f"{ds['name']} -> {version}")
    return store.get("datasets", dataset_id)
