"""Background "copy this live table into the app" jobs, one per dataset.

Copying a big remote table can take minutes, longer than a browser request survives behind a proxy (Cloudflare gives up after
about 100 s). The router starts the job and returns at once; the UI polls `state()` until it is done or failed.
"""
from __future__ import annotations

import contextvars
import threading
from typing import Any

from ..core import tenant
from . import remote

_jobs: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def _key(dataset_id: str) -> str:
    return f"{tenant.current()}:{dataset_id}"


def state(dataset_id: str) -> dict[str, Any]:
    return dict(_jobs.get(_key(dataset_id), {"state": "idle"}))


def start(ds: dict[str, Any]) -> dict[str, Any]:
    key = _key(ds["id"])
    with _lock:
        if _jobs.get(key, {}).get("state") == "running":
            return dict(_jobs[key])
        _jobs[key] = {"state": "running"}
    ctx = contextvars.copy_context()   # the worker belongs to this user's workspace

    def work() -> None:
        try:
            remote.convert_to_copy(ds)
            _jobs[key] = {"state": "done"}
        except Exception as e:
            _jobs[key] = {"state": "error", "error": str(e)[:300]}

    threading.Thread(target=lambda: ctx.run(work), daemon=True).start()
    return {"state": "running"}
