"""Email / mobile verification endpoints. Signed-in users only; reachable even while blocked (that is how they unblock)."""
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from ..core.auth import require_user
from ..services import contact_change, verification

router = APIRouter(prefix="/api/verify", tags=["verify"])


class SendIn(BaseModel):
    channel: str
    phone: str | None = None


class ConfirmIn(BaseModel):
    channel: str
    code: str


class ChangeStartIn(BaseModel):
    channel: str
    new_value: str


class ChangeConfirmIn(BaseModel):
    channel: str
    proof_code: str   # code sent to the account's other verified contact
    new_code: str     # code sent to the new email / number


@router.post("/change/start")
async def change_start(body: ChangeStartIn, user: dict = Depends(require_user)):
    return await run_in_threadpool(contact_change.start, user, body.channel, body.new_value)


@router.post("/change/confirm")
async def change_confirm(body: ChangeConfirmIn, user: dict = Depends(require_user)):
    return await run_in_threadpool(contact_change.finish, user, body.channel, body.proof_code, body.new_code)


@router.get("/status")
async def verify_status(user: dict = Depends(require_user)):
    return await run_in_threadpool(verification.status, user)


@router.post("/send")
async def verify_send(body: SendIn, user: dict = Depends(require_user)):
    return await run_in_threadpool(verification.send_code, user, body.channel, body.phone)


@router.post("/confirm")
async def verify_confirm(body: ConfirmIn, user: dict = Depends(require_user)):
    return await run_in_threadpool(verification.confirm_code, user, body.channel, body.code)
