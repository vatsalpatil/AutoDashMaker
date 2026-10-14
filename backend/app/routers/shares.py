"""Dashboard share links.

`router` (signed in): create / list / revoke links for your own dashboards.
`public_router` (no login): view a shared dashboard and its chart data by token — read-only, that dashboard only.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..core import tenant
from ..core.auth import require_verified
from ..services import audit, dash_data, shares, throttle

router = APIRouter(prefix="/api/dashboards", tags=["shares"])
public_router = APIRouter(prefix="/api/public/shares", tags=["public"])


class ShareIn(BaseModel):
    days: int | None = 30      # None / 0 = never expires


@router.get("/{dashboard_id}/shares")
def list_shares(dashboard_id: str):
    return shares.list_for(dashboard_id)


@router.post("/{dashboard_id}/shares")
def create_share(dashboard_id: str, body: ShareIn, user: dict = Depends(require_verified)):
    try:
        s = shares.create(dashboard_id, body.days, user.get("email", ""))
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    audit.record("dashboard.share", entity_type="dashboard", entity_id=dashboard_id, detail=f"expires {s['expires_at'] or 'never'}")
    return {**s, "active": True}


@router.delete("/{dashboard_id}/shares/{share_id}")
def revoke_share(dashboard_id: str, share_id: str):
    shares.revoke(share_id)
    audit.record("dashboard.unshare", entity_type="dashboard", entity_id=dashboard_id)
    return {"ok": True}


def _open(token: str, request: Request) -> dict:
    """The active share for a token. Wrong guesses count toward the brute-force lockout of the caller's IP."""
    key = f"share:ip:{request.client.host if request.client else '?'}"
    throttle.check(key)
    s = shares.resolve(token)
    if not s:
        throttle.fail(key)
        raise HTTPException(404, "This link is invalid, expired or was turned off.")
    tenant.set_workspace(s["workspace_id"])   # everything below reads only the owner's workspace
    return s


@public_router.get("/{token}")
def public_dashboard(token: str, request: Request):
    s = _open(token, request)
    d = dash_data.load(s["dashboard_id"])
    if not d:
        raise HTTPException(404, "The shared dashboard no longer exists.")
    shares.record_view(s)
    out = {k: d.get(k) for k in shares.PUBLIC_FIELDS}
    out["widgets"] = [{k: w.get(k) for k in ("id", "chart_id", "kind", "title", "settings", "page", "position")} for w in d["widgets"]]
    out["expires_at"] = s.get("expires_at")
    return out


@public_router.post("/{token}/data")
def public_data(token: str, request: Request):
    s = _open(token, request)
    data = dash_data.bundle(s["dashboard_id"])
    for r in data.values():   # viewers get the chart's look, not its query
        if r.get("chart"):
            r["chart"] = {k: r["chart"].get(k) for k in ("id", "name", "spec", "description")}
    return data
