"""Opt-in background refresh of datasets (§54, §27).

A dataset is refreshed automatically only when it has `auto_refresh = TRUE`
and an `expected_interval_minutes`, and that interval has elapsed since its
last refresh. Failures back off exponentially so a dead source is not hammered,
and the last error is stored on the dataset for the health view.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from ..core.security import redact_secrets
from ..core.store import store
from .ingest import refresh_dataset

log = logging.getLogger("refresh")

MAX_BACKOFF_S = 6 * 3600
_backoff: dict[str, tuple[int, float]] = {}  # dataset_id -> (consecutive failures, retry-after epoch)


def age_minutes(ds: dict[str, Any], now: datetime | None = None) -> float | None:
    last = ds.get("refreshed_at") or ds.get("created_at")
    if last is None:
        return None
    if isinstance(last, str):
        last = datetime.fromisoformat(last)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    now = now or datetime.now(timezone.utc)
    return max(0.0, (now - last).total_seconds() / 60)


def is_overdue(ds: dict[str, Any]) -> bool:
    """True when an expected interval is set and the data is older than it."""
    interval, age = ds.get("expected_interval_minutes"), age_minutes(ds)
    return bool(interval) and age is not None and age > interval


def due_datasets(now_epoch: float | None = None) -> list[dict[str, Any]]:
    now_epoch = now_epoch if now_epoch is not None else time.time()
    due = []
    for ds in store.list("datasets", where="auto_refresh = TRUE", order=None):
        if not is_overdue(ds):
            continue
        if _backoff.get(ds["id"], (0, 0.0))[1] > now_epoch:
            continue
        due.append(ds)
    return due


def refresh_one(ds: dict[str, Any]) -> bool:
    """Refresh a single dataset; returns True on success. Source failures are recorded, not raised."""
    try:
        refresh_dataset(ds["id"])
    except Exception as e:  # connector, DuckDB or pipeline failure: record + back off, keep the loop alive
        detail = redact_secrets(str(e))
        fails = _backoff.get(ds["id"], (0, 0.0))[0] + 1
        _backoff[ds["id"]] = (fails, time.time() + min(MAX_BACKOFF_S, 300 * 2 ** (fails - 1)))
        store.update("datasets", ds["id"], {"last_refresh_error": detail[:500]})
        log.warning("auto-refresh of %s failed (%d in a row): %s", ds["id"], fails, detail)
        return False
    _backoff.pop(ds["id"], None)
    store.update("datasets", ds["id"], {"last_refresh_error": None})
    return True


async def refresh_loop(poll_seconds: int = 300) -> None:
    while True:
        try:
            for ds in due_datasets():
                await asyncio.to_thread(refresh_one, ds)  # one at a time: keeps memory flat
        except Exception as e:
            log.warning("refresh iteration failed: %s", redact_secrets(str(e)))
        await asyncio.sleep(poll_seconds)
