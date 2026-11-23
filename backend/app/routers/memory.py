"""/api/memory — the user's AI memory as Markdown files (services/memory.py): list, read, write, rename, delete, remember."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import audit, memory

router = APIRouter(prefix="/api/memory", tags=["memory"])


class FileIn(BaseModel):
    content: str


class RenameIn(BaseModel):
    name: str


class RememberIn(BaseModel):
    note: str
    file: str = memory.MAIN


class SettingsIn(BaseModel):
    enabled: bool


def _guard(fn, *a):
    try:
        return fn(*a)
    except memory.MemoryError as e:
        raise HTTPException(400, str(e))


@router.get("")
def overview():
    return {"enabled": memory.enabled(), "files": memory.list_files(), "prompt_chars": len(memory.prompt_text()),
            "prompt_limit": memory.PROMPT_CHARS}


@router.put("/settings")
def settings(body: SettingsIn):
    memory.set_enabled(body.enabled)
    return {"enabled": body.enabled}


@router.get("/files/{name}")
def read(name: str):
    return {"name": name, "content": _guard(memory.read, name)}


@router.put("/files/{name}")
def write(name: str, body: FileIn):
    out = _guard(memory.write, name, body.content)
    audit.record("memory.write", detail=out["name"])
    return out


@router.post("/files/{name}/rename")
def rename(name: str, body: RenameIn):
    return _guard(memory.rename, name, body.name)


@router.delete("/files/{name}")
def delete(name: str):
    _guard(memory.delete, name)
    audit.record("memory.delete", detail=name)
    return {"ok": True}


@router.post("/remember")
def remember(body: RememberIn):
    return _guard(memory.remember, body.note, body.file)
