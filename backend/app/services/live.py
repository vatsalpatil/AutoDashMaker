"""A side channel for live progress text while a generation runs.

The SSE route sets `sink` (inside its worker thread's context) to the queue's `put`; code deep in the AI call chain calls
`push()` to show the model's thinking and answer as they arrive, without every function having to yield events.
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import Callable

sink: ContextVar[Callable[[dict], None] | None] = ContextVar("generation_live_sink", default=None)


def push(step: int, kind: str, text: str = "", lane: str | None = None, label: str | None = None) -> None:
    """kind: 'reasoning' | 'answer' (append `text` to that lane's live box) | 'reset' (a retry starts: clear it).
    A step can run several model calls at once (one lane each, e.g. one per dashboard page); `label` names the lane."""
    out = sink.get()
    if out is not None and (text or kind == "reset"):
        out({"type": "think", "n": step, "kind": kind, "text": text, "lane": lane or "main", "label": label or ""})
