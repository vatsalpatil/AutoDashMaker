"""Audit trail (§58): who/what/when for queries, AI questions, data and source changes.

`record()` never raises and never blocks the caller: writes go to one background thread
(ordered, so the trail keeps request order). Each metadata write costs ~50 ms because the
store opens a connection per call, which must not be added to every query request.
Never pass secrets in `detail` (e.g. source configs hold passwords: log name/type only).
"""
from __future__ import annotations

import itertools
import logging
from concurrent.futures import ThreadPoolExecutor

from ..core.security import redact_secrets
from ..core.store import store, DEFAULT_WS, DEFAULT_USER

log = logging.getLogger("audit")

MAX_ROWS = 20_000
_PRUNE_EVERY = 200
_counter = itertools.count(1)
_writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="audit")


def record(action: str, *, entity_type: str | None = None, entity_id: str | None = None,
           detail: str | None = None, status: str = "ok", duration_ms: float | None = None) -> None:
    row = {
        "workspace_id": DEFAULT_WS, "actor": DEFAULT_USER, "action": action,
        "entity_type": entity_type, "entity_id": entity_id,
        "detail": redact_secrets(detail or "")[:500], "status": status, "duration_ms": duration_ms,
    }
    try:
        _writer.submit(_write, row)
    except Exception as e:  # e.g. interpreter shutting down
        log.warning("audit enqueue failed: %s", e)


def flush() -> None:
    """Block until queued audit rows are written (tests, shutdown)."""
    _writer.submit(lambda: None).result()


def _write(row: dict) -> None:
    try:
        store.insert("audit_log", row)
        if next(_counter) % _PRUNE_EVERY == 0:  # keep the table bounded
            store.execute(
                "DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log "
                "ORDER BY created_at DESC OFFSET ?)", [MAX_ROWS])
    except Exception as e:
        log.warning("audit write failed: %s", e)
