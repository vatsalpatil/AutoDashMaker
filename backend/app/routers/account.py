"""Delete my account. Signed-in users only, and never in local mode."""
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ..core.auth import require_user
from ..services import account_delete

router = APIRouter(prefix="/api/account", tags=["account"])


class DeleteIn(BaseModel):
    code: str
    email: str  # the account's email, typed back by the user


@router.post("/delete/start")
async def delete_start(user: dict = Depends(require_user)):
    return await run_in_threadpool(account_delete.start, user)


@router.post("/delete/confirm")
async def delete_confirm(body: DeleteIn, user: dict = Depends(require_user)):
    return await run_in_threadpool(account_delete.finish, user, body.code, body.email)
