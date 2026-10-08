"""Workspace system facts (health, storage, limits, cache) and a config export, for the Settings page."""
from __future__ import annotations

import platform
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..core import tenant
from ..core.config import DATA_DIR, settings
from ..core.store import store
from .engine import engine

STARTED = time.time()
COUNTED = ("datasets", "datasources", "queries", "charts", "dashboards", "alerts", "metrics", "dimensions")
# Everything that defines how the workspace looks and behaves. Data tables and AI keys are deliberately not exported.
EXPORTED = ("queries", "charts", "dashboards", "dashboard_widgets", "metrics", "dimensions", "definitions",
            "synonyms", "verified_queries", "alerts")


def _size(path: str | Path) -> int:
    try:
        return Path(path).stat().st_size
    except OSError:
        return 0


def _dir_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) if path.exists() else 0


def info() -> dict[str, Any]:
    ws = tenant.current()
    disk = shutil.disk_usage(str(DATA_DIR))
    eng = engine.for_workspace(ws)
    with eng._cache_lock:  # noqa: SLF001 - read-only size check
        cache_entries = len(eng._cache)
    counts = {t: store.execute(f"SELECT COUNT(*) AS n FROM {t} WHERE workspace_id = ?", [ws])[0]["n"] for t in COUNTED}
    return {
        "app": settings.app_name,
        "version": "2.0.0",
        "python": platform.python_version(),
        "uptime_s": int(time.time() - STARTED),
        "auth_enabled": settings.auth_enabled,
        "workspace": ws,
        "disk": {
            "used_pct": round(100 * disk.used / disk.total, 1),
            "limit_pct": settings.disk_usage_limit_pct,
            "free_gb": round(disk.free / 1e9, 1),
            "total_gb": round(disk.total / 1e9, 1),
        },
        "files": {
            "analytics_mb": round(_size(tenant.analytics_path(ws)) / 1e6, 1),
            "metadata_mb": round(_size(settings.metadata_db) / 1e6, 1),
            "uploads_mb": round(_dir_size(tenant.upload_dir(ws)) / 1e6, 1),
        },
        "limits": {
            "memory": settings.duckdb_memory_limit,
            "threads": settings.duckdb_threads,
            "query_timeout_s": settings.query_timeout_s,
            "max_upload_mb": settings.max_upload_mb,
            "default_row_limit": settings.default_row_limit,
        },
        "cache": {"entries": cache_entries, "max": settings.result_cache_entries, "ttl_s": settings.result_cache_ttl_s},
        "counts": counts,
    }


def clear_cache() -> int:
    eng = engine.for_workspace(tenant.current())
    with eng._cache_lock:  # noqa: SLF001
        n = len(eng._cache)
    eng.invalidate()
    return n


def export_config() -> dict[str, Any]:
    """Portable JSON of the workspace's definitions (no datasets' rows, no connection secrets, no AI keys)."""
    return {
        "format": "dashtor-config/1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tables": {t: store.list(t, order=None) for t in EXPORTED},
    }
