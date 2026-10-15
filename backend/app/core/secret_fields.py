"""Keep stored credentials out of API responses.

Source configs leave the server with every secret value replaced by MASK; when an edit or a connection test sends MASK
back (the form was not touched), the stored value is put back in its place.
"""
import re
from typing import Any

MASK = "••••••••"
_SECRET_KEY = re.compile(r"pass(word|wd)?$|pwd$|secret|token|api[_-]?key|private[_-]?key|authorization|credentials?$", re.I)


def mask(value: Any, key: str = "") -> Any:
    if isinstance(value, dict):
        return {k: mask(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [mask(v, key) for v in value]
    if _SECRET_KEY.search(key) and value not in (None, ""):
        return MASK
    return value


def restore(new: Any, old: Any) -> Any:
    """`new` with every MASK swapped back for the matching value in `old` (the stored config)."""
    if new == MASK:
        return old
    if isinstance(new, dict):
        prev = old if isinstance(old, dict) else {}
        return {k: restore(v, prev.get(k)) for k, v in new.items()}
    if isinstance(new, list):
        prev = old if isinstance(old, list) else []
        return [restore(v, prev[i] if i < len(prev) else None) for i, v in enumerate(new)]
    return new


def public_source(src: dict | None) -> dict | None:
    return src and {**src, "config": mask(src.get("config") or {})}
