"""Public auth bootstrap: tells the browser whether to show login and how to reach Supabase."""
from fastapi import APIRouter, Depends

from app.core.auth import require_user
from app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/config")
def auth_config():
    return {
        "enabled": settings.auth_enabled,
        "supabase_url": settings.supabase_url if settings.auth_enabled else "",
        "supabase_anon_key": settings.supabase_anon_key if settings.auth_enabled else "",
    }


@router.get("/me")
def me(user: dict = Depends(require_user)):
    return user
