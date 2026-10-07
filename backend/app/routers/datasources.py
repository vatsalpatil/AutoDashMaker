"""Data source CRUD + connection testing + discovery."""
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from ..connectors import get_connector, ConnectorError
from ..connectors.tls import CERT_EXTENSIONS, MAX_CERT_BYTES, cert_dir
from ..core.store import store
from ..services import audit
from ..core import tenant

router = APIRouter(prefix="/api/sources", tags=["sources"])


class SourceIn(BaseModel):
    name: str
    type: str  # file | postgres | rest
    config: dict[str, Any] = {}


@router.get("")
def list_sources():
    return store.list("datasources")


@router.post("")
def create_source(body: SourceIn):
    if body.type not in ("file", "postgres", "mysql", "sqlite", "rest", "graphql", "url", "gsheets"):
        raise HTTPException(400, f"unsupported type {body.type}")
    src = store.insert("datasources", body.model_dump())
    audit.record("source.create", entity_type="source", entity_id=src["id"], detail=f"{body.name} ({body.type})")
    return src


@router.post("/files")
async def upload_cert(file: UploadFile):
    """Store a certificate/key file (.pem, .crt, .key …) for a database connection and return its server path."""
    name = Path((file.filename or "").replace("\\", "/")).name
    if Path(name).suffix.lower() not in CERT_EXTENSIONS:
        raise HTTPException(400, f"unsupported file type; allowed: {', '.join(sorted(CERT_EXTENSIONS))}")
    data = await file.read(MAX_CERT_BYTES + 1)
    if not data or len(data) > MAX_CERT_BYTES:
        raise HTTPException(400, "certificate file is empty or larger than 64 KB")
    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)
    dest = cert_dir() / f"{uuid.uuid4().hex[:8]}_{safe}"
    dest.write_bytes(data)
    audit.record("source.cert", detail=f"uploaded {name}")
    return {"path": str(dest), "name": name}


@router.get("/health")
def sources_health(check: bool = True):
    """One-glance connectivity view: live-tests every source (in parallel, 10s cap each)
    and joins it with its datasets' freshness / last refresh error."""
    sources = store.list("datasources", order="name")
    datasets = store.list("datasets", order=None)

    def probe(src: dict) -> dict[str, Any]:
        t0 = time.perf_counter()
        try:
            res = get_connector(src["type"], src["config"]).test_connection()
        except Exception as e:
            res = {"ok": False, "detail": str(e)[:300]}
        return {**res, "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}

    results: dict[str, dict[str, Any]] = {}
    if check and sources:
        pool = ThreadPoolExecutor(max_workers=4)
        run_probe = tenant.bind(probe)  # worker threads don't inherit the caller's workspace
        futures = {s["id"]: pool.submit(run_probe, s) for s in sources}
        for sid, fut in futures.items():
            try:
                results[sid] = fut.result(timeout=10)
            except FuturesTimeout:
                results[sid] = {"ok": False, "detail": "timed out after 10s", "latency_ms": 10000.0}
        pool.shutdown(wait=False)

    out = []
    for s in sources:
        dss = [d for d in datasets if d.get("source_id") == s["id"]]
        errors = [d["last_refresh_error"] for d in dss if d.get("last_refresh_error")]
        out.append({
            "id": s["id"], "name": s["name"], "type": s["type"],
            "connection": results.get(s["id"]),  # None when check=false
            "dataset_count": len(dss),
            "auto_refresh_datasets": sum(1 for d in dss if d.get("auto_refresh")),
            "last_refresh_error": errors[0] if errors else None,
        })
    return {"sources": out}


@router.post("/test")
def test_connection(body: SourceIn):
    return get_connector(body.type, body.config).test_connection()


@router.get("/{source_id}/discover")
def discover(source_id: str):
    src = store.get("datasources", source_id)
    if not src:
        raise HTTPException(404, "source not found")
    try:
        return {"items": get_connector(src["type"], src["config"]).discover()}
    except ConnectorError as e:
        raise HTTPException(400, str(e))


@router.patch("/{source_id}")
def update_source(source_id: str, body: SourceIn):
    """Edit a source — including rotating credentials."""
    src = store.get("datasources", source_id)
    if not src:
        raise HTTPException(404, "source not found")
    store.update("datasources", source_id, {"name": body.name, "config": body.config})
    from ..services.remote import invalidate  # linked datasets read the source's config on every query
    invalidate()
    audit.record("source.update", entity_type="source", entity_id=source_id, detail=body.name)
    return store.get("datasources", source_id)


@router.post("/{source_id}/test-saved")
def test_saved(source_id: str):
    """Re-test a saved source with its current credentials."""
    src = store.get("datasources", source_id)
    if not src:
        raise HTTPException(404, "source not found")
    return get_connector(src["type"], src["config"]).test_connection()


@router.delete("/{source_id}")
def delete_source(source_id: str):
    store.delete("datasources", source_id)
    audit.record("source.delete", entity_type="source", entity_id=source_id)
    return {"ok": True}
