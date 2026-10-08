"""System info, cache control and config export for the Settings page."""
import json
from datetime import date

from fastapi import APIRouter
from fastapi.responses import Response

from ..services import system

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("")
def system_info():
    return system.info()


@router.post("/cache/clear")
def clear_cache():
    return {"cleared": system.clear_cache()}


@router.get("/export")
def export_config():
    body = json.dumps(system.export_config(), default=str, indent=2)
    return Response(body, media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="dashtor-config-{date.today()}.json"'})
