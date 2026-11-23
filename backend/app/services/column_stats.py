"""Full column statistics in `columns_meta` (null %, distinct count, sample values) for every dataset.

Connectors only report name + type. The AI prompts (exact text values), the value guard, starter questions and key number
suggestions all need distinct counts and samples, so imports call `refresh`, and `ensure` back-fills older datasets
once (per dataset version, per process) the first time something needs them.
"""
from __future__ import annotations

import logging
from typing import Any

from ..core import tenant
from ..core.store import store

log = logging.getLogger(__name__)
_tried: set[tuple] = set()
MAX_PER_CALL = 8   # bound the one-off back-fill work done inside a single request


def refresh(ds: dict[str, Any]) -> bool:
    """Re-read the dataset's columns with statistics and replace its columns_meta rows. False if it could not."""
    from .engine import engine
    try:
        cols = engine.describe_table(ds["physical_name"])["columns"]
    except Exception as e:  # noqa: BLE001  (statistics are a bonus; never fail an import over them)
        log.info("column stats for %s skipped: %s", ds.get("name"), e)
        return False
    store.execute("DELETE FROM columns_meta WHERE dataset_id = ?", [ds["id"]])
    for c in cols:
        store.insert("columns_meta", {"dataset_id": ds["id"], **c})
    return True


def ensure(datasets: list[dict[str, Any]] | None = None) -> None:
    """Back-fill statistics for datasets that only have names + types (each tried once per version per process)."""
    datasets = datasets if datasets is not None else [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    have = {c["dataset_id"] for c in store.list("columns_meta", order=None) if c.get("distinct_count") is not None}
    done = 0
    for d in datasets:
        key = (tenant.current(), d["id"], d.get("row_count"))
        if d["id"] in have or key in _tried or not d.get("physical_name"):
            continue
        _tried.add(key)
        refresh(d)
        done += 1
        if done >= MAX_PER_CALL:
            break
