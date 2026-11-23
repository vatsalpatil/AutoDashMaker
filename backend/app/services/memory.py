"""AI memory: Markdown files the user can read and edit, given to the AI on every request (like CLAUDE.md / AGENTS.md).

Each workspace has its own folder of `.md` files next to its data:
  MEMORY.md      — the main file; "remember …" notes are added here as bullets
  <topic>.md     — any other files the user creates (e.g. business-terms.md, style.md)
  .settings.json — {"enabled": bool}

Every request to the AI gets the files' text (MEMORY.md first, then A→Z) as part of its system prompt, capped so a huge
file can't crowd out the data context. Nothing here runs a model.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from ..core import tenant
from ..core.config import settings

MAIN = "MEMORY.md"
MAX_FILES = 30
MAX_FILE_CHARS = 20_000
PROMPT_CHARS = 6_000      # total memory text sent to the model
_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,59}\.md$")
STARTER = """# Memory

Things the AI should always know about you and your data. Edit freely — it's plain Markdown.

## Preferences
-

## Business terms
-
"""


class MemoryError(ValueError):
    pass


def folder(ws: str | None = None) -> Path:
    """uploads/memory/<workspace>/ — on the same persistent volume as the user's uploads."""
    ws = tenant._checked(ws or tenant.current())   # also blocks path tricks
    d = Path(settings.upload_dir) / "memory" / ws
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path(name: str) -> Path:
    name = name.strip()
    if not name.lower().endswith(".md"):
        name += ".md"
    if not _NAME.match(name) or ".." in name:
        raise MemoryError("file names: letters, digits, space, _ . - and ending in .md")
    return folder() / name


def _settings_file() -> Path:
    return folder() / ".settings.json"


def enabled() -> bool:
    try:
        return bool(json.loads(_settings_file().read_text("utf-8")).get("enabled", True))
    except (OSError, ValueError):
        return True


def set_enabled(on: bool) -> None:
    _settings_file().write_text(json.dumps({"enabled": bool(on)}), "utf-8")


def _ordered() -> list[Path]:
    files = [p for p in folder().glob("*.md") if p.is_file()]
    return sorted(files, key=lambda p: (p.name != MAIN, p.name.lower()))


def list_files() -> list[dict]:
    if not (folder() / MAIN).exists():
        (folder() / MAIN).write_text(STARTER, "utf-8")
    out = []
    for p in _ordered():
        st = p.stat()
        text = p.read_text("utf-8", errors="replace")
        out.append({"name": p.name, "size": st.st_size, "updated_at": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
                    "lines": text.count("\n") + 1, "preview": " ".join(text.split())[:140], "main": p.name == MAIN})
    return out


def read(name: str) -> str:
    p = _path(name)
    if p.name == MAIN and not p.exists():   # first visit: the page may ask for it before listing (which creates it)
        p.write_text(STARTER, "utf-8")
    if not p.exists():
        raise MemoryError(f"no memory file {p.name}")
    return p.read_text("utf-8", errors="replace")


def write(name: str, content: str) -> dict:
    p = _path(name)
    if len(content) > MAX_FILE_CHARS:
        raise MemoryError(f"a memory file can hold up to {MAX_FILE_CHARS:,} characters")
    if not p.exists() and len(_ordered()) >= MAX_FILES:
        raise MemoryError(f"up to {MAX_FILES} memory files")
    p.write_text(content.replace("\r\n", "\n"), "utf-8")
    return {"name": p.name, "size": p.stat().st_size}


def rename(old: str, new: str) -> dict:
    src, dst = _path(old), _path(new)
    if not src.exists():
        raise MemoryError(f"no memory file {src.name}")
    if dst.exists():
        raise MemoryError(f"{dst.name} already exists")
    if src.name == MAIN:
        raise MemoryError(f"{MAIN} is the main file and keeps its name")
    src.rename(dst)
    return {"name": dst.name}


def delete(name: str) -> None:
    p = _path(name)
    if p.name == MAIN:
        p.write_text(STARTER, "utf-8")   # the main file is reset, never removed
    elif p.exists():
        p.unlink()


def remember(note: str, file: str = MAIN) -> dict:
    """Add one bullet to a memory file (MEMORY.md by default), under '## Notes'."""
    note = " ".join(note.split()).strip(" -")
    if not note:
        raise MemoryError("nothing to remember")
    p = _path(file)
    text = p.read_text("utf-8") if p.exists() else (STARTER if p.name == MAIN else f"# {p.stem}\n")
    if note.lower() in text.lower():
        return {"name": p.name, "note": note, "duplicate": True}
    if "\n## Notes" not in text:
        text = text.rstrip() + "\n\n## Notes\n"
    text = text.rstrip() + f"\n- {note}\n"
    write(p.name, text)
    return {"name": p.name, "note": note, "duplicate": False}


_REMEMBER = re.compile(r"^\s*(?:please\s+)?(?:remember|memorize|note|save to memory)(?:\s+that)?\s*[:,-]?\s+(.+)$", re.I | re.S)


def remember_command(text: str) -> str | None:
    """'remember that revenue means net revenue' → the note, else None."""
    m = _REMEMBER.match(text or "")
    return m.group(1).strip() if m else None


def _meaningful(text: str) -> str:
    """Drop the starter template's empty bullets and the intro line, so an untouched file adds nothing to prompts."""
    lines = [ln for ln in text.splitlines() if ln.strip() not in ("-", "- ") and not ln.startswith("Things the AI should always know")]
    body = [ln for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]
    return "\n".join(lines).strip() if body else ""


def prompt_text() -> str:
    """All memory files as one block for the system prompt ('' when off or empty)."""
    try:
        if not tenant.is_scoped() or not enabled():
            return ""
        parts = []
        for p in _ordered():
            body = _meaningful(p.read_text("utf-8", errors="replace"))
            if body:
                parts.append(f"### {p.name}\n{body}")
    except OSError:
        return ""
    text = "\n\n".join(parts)
    return text[:PROMPT_CHARS]


HEADER = ("The user's memory (preferences, definitions and facts they asked you to remember). Follow it unless the "
          "current request says otherwise; never contradict the data:\n")


def inject(messages: list[dict]) -> list[dict]:
    """Add the memory to the first system message (or a new one) of a model request."""
    mem = prompt_text()
    if not mem:
        return messages
    block = HEADER + mem
    if messages and messages[0].get("role") == "system" and isinstance(messages[0].get("content"), str):
        return [{**messages[0], "content": messages[0]["content"] + "\n\n" + block}, *messages[1:]]
    return [{"role": "system", "content": block}, *messages]
