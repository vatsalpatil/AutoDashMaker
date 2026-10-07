"""Semantic layer: metrics, dimensions, definitions, synonyms,
verified query library, and human feedback (§15, §47–49).

Route order matters: static paths (/verified, /feedback) are declared
BEFORE the dynamic /{entity} routes so they are not captured by them.
"""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store, DEFAULT_WS

router = APIRouter(prefix="/api/semantic", tags=["semantic"])

ENTITIES = {
    "metrics": {"name", "label", "expression", "filters", "description", "dataset_id"},
    "dimensions": {"name", "label", "column_name", "description", "dataset_id"},
    "definitions": {"term", "definition"},
    "synonyms": {"term", "maps_to"},
}


# -- verified query library (§48) ----------------------------------------

class VerifyIn(BaseModel):
    question: str
    sql: str
    dataset_id: str | None = None
    metric_refs: list[str] = []
    note: str = ""


@router.get("/verified/list")
def list_verified():
    return store.list("verified_queries")


@router.post("/verified")
def verify(body: VerifyIn):
    return store.insert("verified_queries",
                        {"workspace_id": DEFAULT_WS, **body.model_dump()})


@router.delete("/verified/{row_id}")
def unverify(row_id: str):
    store.delete("verified_queries", row_id)
    return {"ok": True}


# -- human feedback (§49) -------------------------------------------------

class FeedbackIn(BaseModel):
    question: str
    sql: str = ""
    verdict: str          # correct | incorrect
    reason: str = ""      # wrong_metric | wrong_table | wrong_filter | wrong_time | wrong_interpretation | other
    detail: str = ""


@router.post("/feedback")
def submit_feedback(body: FeedbackIn):
    if body.verdict not in ("correct", "incorrect"):
        raise HTTPException(400, "verdict must be correct|incorrect")
    return store.insert("feedback", {"workspace_id": DEFAULT_WS, **body.model_dump()})


@router.get("/feedback/list")
def list_feedback():
    return store.list("feedback")


# -- dynamic entity CRUD (metrics/dimensions/definitions/synonyms) ---------

@router.get("/{entity}")
def list_entity(entity: str, dataset_id: str | None = None):
    if entity not in ENTITIES:
        raise HTTPException(404, "unknown entity")
    where, params = ("dataset_id = ?", [dataset_id]) if dataset_id else ("", None)
    return store.list(entity, where=where, params=params)


@router.post("/{entity}")
def create_entity(entity: str, body: dict[str, Any]):
    if entity not in ENTITIES:
        raise HTTPException(404, "unknown entity")
    row = {k: v for k, v in body.items() if k in ENTITIES[entity]}
    row["workspace_id"] = DEFAULT_WS
    return store.insert(entity, row)


@router.put("/{entity}/{row_id}")
def update_entity(entity: str, row_id: str, body: dict[str, Any]):
    if entity not in ENTITIES:
        raise HTTPException(404, "unknown entity")
    row = {k: v for k, v in body.items() if k in ENTITIES[entity]}
    store.update(entity, row_id, row)
    return store.get(entity, row_id)


@router.delete("/{entity}/{row_id}")
def delete_entity(entity: str, row_id: str):
    if entity not in ENTITIES:
        raise HTTPException(404, "unknown entity")
    store.delete(entity, row_id)
    return {"ok": True}
