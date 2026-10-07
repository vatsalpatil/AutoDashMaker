"""'What needs my attention today?' endpoint (§99)."""
from fastapi import APIRouter

from ..services.attention import attention_report

router = APIRouter(prefix="/api/attention", tags=["attention"])


@router.get("")
def attention(deep: bool = True):
    """Ranked list of things worth a look. `deep=false` skips dashboard anomaly scans."""
    return attention_report(deep)
