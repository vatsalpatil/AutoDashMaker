"""Open a DuckDB file, waiting while another process still holds its lock.

During a redeploy the new container can start before the old one has stopped; DuckDB allows one process per file, so
instead of crashing on "Could not set lock" we retry until the old process exits (up to LOCK_WAIT_S seconds)."""
from __future__ import annotations

import logging
import time

import duckdb

LOCK_WAIT_S = 120
log = logging.getLogger(__name__)


def connect(path: str, **kwargs) -> duckdb.DuckDBPyConnection:
    deadline = time.monotonic() + LOCK_WAIT_S
    while True:
        try:
            return duckdb.connect(path, **kwargs)
        except duckdb.IOException as e:
            if "lock" not in str(e).lower() or time.monotonic() > deadline:
                raise
            log.warning("database %s is locked by another process (old container still stopping?); retrying", path)
            time.sleep(2)
