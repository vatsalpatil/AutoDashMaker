"""Datasets: upload files, ingest from sources, schema discovery, preview."""
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from ..connectors import ConnectorError
from ..core.config import settings
from ..core.store import store
from ..services import audit, disk, refresh_jobs
from ..services.engine import engine
from ..services.ingest import ingest_source, refresh_dataset
from ..services.refresh import age_minutes, is_overdue

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class IngestIn(BaseModel):
    source_id: str
    name: str            # table/file name from discovery
    dataset_name: str | None = None
    mode: str = "copy"   # copy = import the rows · link = schema only, queries run live against the source


@router.get("")
def list_datasets():
    return store.list("datasets")


@router.post("/upload")
async def upload(file: UploadFile):
    """Upload a CSV/Excel/Parquet/JSON file and register it as a dataset."""
    filename = Path((file.filename or "").replace("\\", "/")).name  # strip any directory part (path traversal)
    if not filename:
        raise HTTPException(400, "missing file name")
    try:
        disk.ensure_room(file.size or 0)
    except ConnectorError as e:
        raise HTTPException(507, str(e))
    dest = Path(settings.upload_dir) / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    src = store.insert("datasources", {
        "name": filename, "type": "file", "config": {"path": str(dest)},
    })
    return _ingest(src, dest.stem)


@router.post("/ingest")
def ingest(body: IngestIn):
    src = store.get("datasources", body.source_id)
    if not src:
        raise HTTPException(404, "source not found")
    if body.mode == "link":
        from ..services.remote import link_source
        try:
            return link_source(src, body.name, body.dataset_name or body.name)
        except ConnectorError as e:
            raise HTTPException(400, str(e))
    return _ingest(src, body.dataset_name or body.name, discover_name=body.name)


def _ingest(src: dict, friendly_name: str, discover_name: str | None = None) -> dict:
    try:
        return ingest_source(src, friendly_name, discover_name)
    except ConnectorError as e:
        raise HTTPException(400, str(e))


@router.get("/columns")
def all_columns():
    """Column names per dataset, keyed by the dataset's own name (from stored metadata, no scans): feeds SQL editor completion."""
    by_id: dict[str, list[str]] = {}
    for c in store.list("columns_meta", order=None):
        by_id.setdefault(c["dataset_id"], []).append(c["name"])
    return {d["name"]: by_id.get(d["id"], []) for d in store.list("datasets", order=None) if d.get("physical_name")}


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str):
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    ds["columns"] = store.list("columns_meta",
                               where="dataset_id = ?", params=[dataset_id], order=None)
    return ds


_SCHEMA_CACHE: dict[str, tuple[tuple, dict]] = {}   # dataset id -> (data version, profile); profiling scans the whole table


@router.post("/{dataset_id}/to-linked")
def to_linked(dataset_id: str, remote_table: str | None = None):
    """Drop the stored copy of a database table and keep only a live link (schema + stats)."""
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    if ds.get("remote_table"):
        return ds
    from ..services.remote import convert_to_linked
    try:
        out = convert_to_linked(ds, remote_table)
    except ConnectorError as e:
        raise HTTPException(400, str(e))
    _SCHEMA_CACHE.pop(dataset_id, None)
    return out


@router.get("/{dataset_id}/schema")
def schema(dataset_id: str, fresh: bool = False):
    """Schema + per-column profile from the analytical engine, cached until the dataset changes (`?fresh=true` re-profiles)."""
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    version = (ds["physical_name"], str(ds.get("refreshed_at")), ds.get("row_count"), ds.get("column_count"))
    hit = _SCHEMA_CACHE.get(dataset_id)
    if hit and hit[0] == version and not fresh:
        return hit[1]
    try:
        out = engine.describe_table(ds["physical_name"])
    except Exception as e:  # e.g. a linked dataset whose source is unreachable: say so instead of a bare 500
        raise HTTPException(400, str(e)[:400])
    _SCHEMA_CACHE[dataset_id] = (version, out)
    return out


@router.get("/{dataset_id}/preview")
def preview(dataset_id: str, limit: int = 100):
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    return engine.execute(f'SELECT * FROM {ds["physical_name"]}', row_limit=min(limit, 1000))


class FreshnessIn(BaseModel):
    expected_interval_minutes: int | None = None
    auto_refresh: bool | None = None  # opt in: background re-ingest whenever the interval elapses


@router.patch("/{dataset_id}/freshness")
def set_freshness(dataset_id: str, body: FreshnessIn):
    """§27: declare the expected update interval; staleness shows in /freshness."""
    if not store.get("datasets", dataset_id):
        raise HTTPException(404, "dataset not found")
    store.update("datasets", dataset_id, body.model_dump(exclude_unset=True))
    return store.get("datasets", dataset_id)


@router.post("/{dataset_id}/refresh")
def refresh(dataset_id: str, background: bool = False):
    """Re-ingest from the source and stamp refreshed_at (§27); derived datasets replay their pipeline.

    `background=true` starts a job and returns at once (poll GET /{id}/refresh-status); big tables take a minute."""
    if background:
        if not store.get("datasets", dataset_id):
            raise HTTPException(404, "dataset not found")
        return refresh_jobs.start(dataset_id)
    try:
        return refresh_dataset(dataset_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ConnectorError as e:
        raise HTTPException(400, str(e))


@router.get("/{dataset_id}/refresh-status")
def refresh_status(dataset_id: str):
    return refresh_jobs.status(dataset_id)


@router.get("/{dataset_id}/freshness")
def get_freshness(dataset_id: str):
    from ..services.quality import _freshness
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    age = age_minutes(ds)
    expected = ds.get("expected_interval_minutes")
    return {
        "last_updated": _freshness(ds.get("refreshed_at") or ds.get("created_at")),
        "age_minutes": None if age is None else round(age, 1),
        "expected_interval_minutes": expected,
        "auto_refresh": bool(ds.get("auto_refresh")),
        "last_refresh_error": ds.get("last_refresh_error"),
        "status": "stale" if is_overdue(ds) else ("fresh" if expected else "unconfigured"),
    }


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str):
    ds = store.get("datasets", dataset_id)
    if ds:
        audit.record("dataset.delete", entity_type="dataset", entity_id=dataset_id, detail=ds["name"])
        engine.drop_table(ds["physical_name"])
        store.delete("datasets", dataset_id)
        if ds.get("remote_table"):
            from ..services.remote import invalidate
            invalidate()
        store.execute("DELETE FROM columns_meta WHERE dataset_id = ?", [dataset_id])
    return {"ok": True}
