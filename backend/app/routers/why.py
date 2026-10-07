"""The "Why did this change?" endpoint (§66)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store
from ..services.why import why_changed

router = APIRouter(prefix="/api/why", tags=["why"])


class WhyIn(BaseModel):
    dataset_id: str
    date_column: str
    metric_column: str
    days: int = 30
    agg: str = "SUM"


@router.post("")
def why(body: WhyIn):
    ds = store.get("datasets", body.dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    if body.agg.upper() not in ("SUM", "AVG", "COUNT", "MIN", "MAX"):
        raise HTTPException(400, "agg must be SUM|AVG|COUNT|MIN|MAX")
    try:
        return why_changed(ds, body.date_column, body.metric_column, body.days, body.agg.upper())
    except ValueError as e:
        raise HTTPException(400, str(e))
