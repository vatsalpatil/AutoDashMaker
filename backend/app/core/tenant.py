"""Per-user isolation: each signed-in user is one workspace.

A workspace owns its metadata rows (`workspace_id`), its own DuckDB analytics file and its upload
folder. The current workspace lives in a ContextVar set once per request (see core/auth.py), so the
store and the engine scope themselves without every router passing an id around.

  - Local mode (auth off)  -> DEFAULT_WS, the legacy files, exactly as before.
  - Background jobs         -> read rows under `all_workspaces()`, then `run_as(row.workspace_id, ...)`.
"""
import re
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from pathlib import Path
from typing import Any, Callable

from .config import settings

DEFAULT_WS = "ws_default"
ALL = "*"  # system code only: store sees every workspace's rows; the engine refuses (it needs a real workspace)

_current: ContextVar[str] = ContextVar("workspace", default=DEFAULT_WS)
_VALID = re.compile(r"^ws_[A-Za-z0-9_-]{1,64}$")


def current() -> str:
    return _current.get()


def set_workspace(ws: str) -> None:
    """Pin the current request to one workspace. Requests run in their own context, so no reset is needed."""
    _current.set(_checked(ws))


def is_scoped() -> bool:
    return _current.get() != ALL


@contextmanager
def use(ws: str):
    token = _current.set(ws)
    try:
        yield
    finally:
        _current.reset(token)


def all_workspaces():
    return use(ALL)


def run_as(ws: str, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    with use(ws):
        return fn(*args, **kwargs)


def bind(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Wrap fn so it runs in the caller's workspace even from a plain thread / executor (those don't inherit context)."""
    ctx = copy_context()
    return lambda *a, **k: ctx.run(fn, *a, **k)


def workspace_for_user(user_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]", "", user_id)[:64]
    if not safe:
        raise ValueError("empty user id")
    return f"ws_{safe}"


def _checked(ws: str) -> str:
    if ws != DEFAULT_WS and not _VALID.match(ws):  # also blocks path traversal in the folder names below
        raise ValueError(f"invalid workspace {ws!r}")
    return ws


def analytics_path(ws: str) -> str:
    if _checked(ws) == DEFAULT_WS:
        return settings.analytics_db  # legacy single-user file
    d = Path(settings.analytics_db).parent / "ws" / ws  # next to the legacy file, so ANALYTICS_DB relocates everything
    d.mkdir(parents=True, exist_ok=True)
    return str(d / "analytics.duckdb")


def upload_dir(ws: str | None = None) -> Path:
    ws = _checked(ws or current())
    root = Path(settings.upload_dir)
    d = root if ws == DEFAULT_WS else root / "ws" / ws
    d.mkdir(parents=True, exist_ok=True)
    return d
