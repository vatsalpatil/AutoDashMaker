"""Data tests on a dataset: list, add, delete, run now."""
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.security import validate_readonly
from ..core.store import store
from ..services import data_tests

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class TestIn(BaseModel):
    kind: Literal["not_null", "unique", "accepted_values", "range", "min_rows", "custom_sql"]
    column_name: str | None = None
    config: dict[str, Any] = {}
    severity: Literal["error", "warn"] = "error"


def _dataset(dataset_id: str) -> dict:
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    return ds


def _view(t: dict) -> dict:
    return {**t, "label": data_tests.describe(t)}


@router.get("/{dataset_id}/tests")
def list_tests(dataset_id: str):
    _dataset(dataset_id)
    return [_view(t) for t in store.list("dataset_tests", where="dataset_id = ?", params=[dataset_id], order=None)]


@router.post("/{dataset_id}/tests")
def add_test(dataset_id: str, body: TestIn):
    ds = _dataset(dataset_id)
    if body.kind not in ("min_rows", "custom_sql") and not body.column_name:
        raise HTTPException(400, "Pick a column for this test.")
    row = {"dataset_id": dataset_id, **body.model_dump()}
    try:
        validate_readonly(data_tests.compile_sql(row, ds["physical_name"]), 1)
    except Exception as e:  # bad config or a query that is not a single SELECT
        raise HTTPException(400, str(e))
    t = store.insert("dataset_tests", row)
    return data_tests.run_test(store.get("dataset_tests", t["id"]), ds["physical_name"])


@router.delete("/{dataset_id}/tests/{test_id}")
def delete_test(dataset_id: str, test_id: str):
    t = store.get("dataset_tests", test_id)
    if t and t["dataset_id"] == dataset_id:
        store.delete("dataset_tests", test_id)
    return {"ok": True}


@router.post("/{dataset_id}/tests/run")
def run_tests(dataset_id: str):
    return data_tests.run_all(_dataset(dataset_id))
