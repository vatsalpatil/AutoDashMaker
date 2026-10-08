"""Live metric values, preview-before-save and starter suggestions.

Mounted BEFORE `semantic` (see main.py) so these static paths are not captured by its dynamic /{entity} routes.
"""
from pydantic import BaseModel
from fastapi import APIRouter

from ..services import metrics

router = APIRouter(prefix="/api/semantic", tags=["metrics"])


class PreviewIn(BaseModel):
    dataset_id: str | None = None
    expression: str
    filters: list[str] = []


@router.get("/metrics/values")
def metric_values():
    return metrics.values()


@router.post("/metrics/preview")
def metric_preview(body: PreviewIn):
    return metrics.evaluate(body.dataset_id, body.expression, body.filters)


@router.get("/suggestions")
def metric_suggestions():
    return metrics.suggestions()
