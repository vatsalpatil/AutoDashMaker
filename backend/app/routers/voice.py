"""Voice typing: turn a short recording into text (used when the browser has no speech recognition of its own)."""
from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..services import voice

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_BYTES = 10 * 1024 * 1024   # ~10 minutes of opus audio; voice messages are seconds long


@router.post("/transcribe")
async def transcribe(file: UploadFile, language: str = Form("")):
    audio = await file.read(MAX_BYTES + 1)
    if not audio:
        raise HTTPException(400, "the recording is empty")
    if len(audio) > MAX_BYTES:
        raise HTTPException(413, "the recording is too long (10 MB max)")
    try:
        text = await run_in_threadpool(voice.transcribe, audio, language)   # CPU-bound: keep the event loop free
    except Exception as e:  # noqa: BLE001 - surfaced to the user
        if isinstance(e, ValueError) or "Invalid data" in str(e):   # PyAV raises an InvalidDataError (a ValueError) for non-audio
            raise HTTPException(400, "couldn't read that recording; try again")
        raise HTTPException(500, f"could not transcribe the recording: {str(e)[:200]}")
    return {"text": text}
