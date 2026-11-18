"""Rename a dataset, move it into a folder, list folders. Mounted before `datasets` so /folders isn't read as an id."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store
from ..services import audit, dataset_meta

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class MetaIn(BaseModel):
    name: str | None = None
    folder: str | None = None        # "" or null with the key present = remove from its folder
    description: str | None = None


@router.get("/folders")
def list_folders():
    return dataset_meta.folders()


@router.patch("/{dataset_id}")
def update_dataset(dataset_id: str, body: MetaIn):
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    try:
        out = dataset_meta.apply(dataset_id, name=body.name, folder=body.folder, description=body.description,
                                 folder_set="folder" in body.model_fields_set)
    except dataset_meta.MetaError as e:
        raise HTTPException(400, str(e))
    if body.name is not None and out.get("name") != ds["name"]:
        audit.record("dataset.rename", detail=f"{ds['name']} -> {out['name']}")
    return out
