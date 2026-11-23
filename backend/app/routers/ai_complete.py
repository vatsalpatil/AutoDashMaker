"""POST /api/ai/complete — inline SQL ghost-text completion on a fast model (services/complete.py)."""
from fastapi import APIRouter
from pydantic import BaseModel

from ..services import complete as svc
from ..services.ai_errors import friendly

router = APIRouter()


class CompleteIn(BaseModel):
    prefix: str
    suffix: str = ""
    cells: list[dict] = []
    examples: list[str] = []   # the user's recent successful queries (newest first)


@router.post("/complete")
def complete(body: CompleteIn):
    # never an HTTP error: autocomplete fails quietly and the editor just shows no suggestion
    try:
        return svc.complete(body.prefix[-4000:], body.suffix[:1000], body.cells[-10:], body.examples[:5])
    except Exception as e:  # noqa: BLE001
        return {"completion": "", "model": None, "ms": 0, "cached": False, "error": friendly(e)}
