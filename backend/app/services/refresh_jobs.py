"""Background dataset refreshes: re-importing a big table can take a minute, so the UI starts a job and polls it.

The old table keeps serving queries while a refresh runs (the import replaces it atomically at the end).
"""
from __future__ import annotations

import threading
import time
from typing import Any

from .ingest import refresh_dataset

_lock = threading.Lock()
_jobs: dict[str, dict[str, Any]] = {}


def _run(dataset_id: str, job: dict[str, Any]) -> None:
    try:
        ds = refresh_dataset(dataset_id)
        job.update(status="done", row_count=ds.get("row_count"))
    except Exception as e:  # reported to the UI through status(); never raised into the worker thread
        job.update(status="error", error=str(e)[:400])
    finally:
        job["ended"] = time.time()


def start(dataset_id: str) -> dict[str, Any]:
    """Start a refresh unless one is already running for this dataset (then report that one)."""
    with _lock:
        job = _jobs.get(dataset_id)
        if not (job and job["status"] == "running"):
            job = {"status": "running", "started": time.time()}
            _jobs[dataset_id] = job
            threading.Thread(target=_run, args=(dataset_id, job), daemon=True, name=f"refresh-{dataset_id}").start()
    return status(dataset_id)


def status(dataset_id: str) -> dict[str, Any]:
    job = _jobs.get(dataset_id)
    if not job:
        return {"status": "idle"}
    end = job.get("ended") or time.time()
    return {"status": job["status"], "elapsed_s": round(end - job["started"], 1),
            "error": job.get("error"), "row_count": job.get("row_count")}
