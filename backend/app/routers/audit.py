"""Read-only access to the audit trail (§58)."""
from fastapi import APIRouter

from ..core.store import store

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit(limit: int = 100, action: str | None = None, status: str | None = None):
    limit = max(1, min(limit, 1000))
    clauses, params = [], []
    if action:
        clauses.append("action LIKE ?")
        params.append(action.replace("%", "") + "%")  # prefix match: 'query', 'dataset.'
    if status:
        clauses.append("status = ?")
        params.append(status)
    rows = store.list("audit_log", where=" AND ".join(clauses), params=params,
                      order=f"created_at DESC LIMIT {limit}")
    return {"items": rows, "count": len(rows)}
