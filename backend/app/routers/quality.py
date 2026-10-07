"""Data-quality runs: score datasets, list history."""
from ..core import tenant
from fastapi import APIRouter, HTTPException

from ..core.store import store
from ..services.quality import run_quality_check

router = APIRouter(prefix="/api/quality", tags=["quality"])


@router.post("/run/{dataset_id}")
def run(dataset_id: str):
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    return run_quality_check(ds)


@router.get("/dataset/{dataset_id}")
def history(dataset_id: str):
    return store.list("quality_runs", where="dataset_id = ?", params=[dataset_id])


@router.get("/overview")
def overview():
    """Latest quality run per dataset, joined with dataset names."""
    rows = store.execute("""
        SELECT q.*, d.name AS dataset_name, d.row_count AS dataset_rows
        FROM quality_runs q
        JOIN datasets d ON d.id = q.dataset_id
        WHERE d.workspace_id = ?
        QUALIFY row_number() OVER (PARTITION BY q.dataset_id ORDER BY q.created_at DESC) = 1
    """, [tenant.current()])
    return rows
