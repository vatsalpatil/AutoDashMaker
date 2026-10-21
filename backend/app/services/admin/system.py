"""Backoffice system view: process + server health, database sizes, configuration (no secrets), recent server logs.

`LogBuffer` keeps the last warnings/errors of this process in memory so the backoffice can show them without
shell access to the container (Dokploy logs still have everything).
"""
from __future__ import annotations

import collections
import logging
import os
import platform
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from ...core.config import DATA_DIR, settings

STARTED = time.time()
_PUBLIC_CONFIG = ("app_name", "auth_enabled", "auth_confirms_email", "allow_user_python", "verification_required",
                  "verification_email", "verification_phone", "disk_usage_limit_pct", "duckdb_memory_limit", "duckdb_threads",
                  "max_upload_mb", "user_quota_mb", "max_rows_per_dataset", "max_datasets", "default_ai_provider",
                  "default_ai_model", "cors_origins", "app_url", "admin_emails")


class LogBuffer(logging.Handler):
    def __init__(self, size: int = 500):
        super().__init__(level=logging.WARNING)
        self.records: collections.deque = collections.deque(maxlen=size)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.records.append({"at": datetime.fromtimestamp(record.created, timezone.utc).isoformat(), "level": record.levelname,
                                 "logger": record.name, "message": self.format(record)[:2000]})
        except Exception:
            pass


logs = LogBuffer()
logging.getLogger().addHandler(logs)


def _rss_bytes() -> int | None:
    try:  # Linux (the server): resident memory from /proc
        for line in Path("/proc/self/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) * 1024
    except OSError:
        pass
    return None


def _size(p: str | Path) -> int:
    p = Path(p)
    if p.is_file():
        return p.stat().st_size
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) if p.exists() else 0


def info() -> dict:
    disk = shutil.disk_usage(str(DATA_DIR))
    load = os.getloadavg() if hasattr(os, "getloadavg") else None
    return {
        "process": {"python": sys.version.split()[0], "platform": platform.platform(), "pid": os.getpid(),
                    "uptime_s": round(time.time() - STARTED), "memory_bytes": _rss_bytes(), "cpus": os.cpu_count(),
                    "load_avg": load},
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free, "limit_pct": settings.disk_usage_limit_pct},
        "files": {"metadata_db": _size(settings.metadata_db), "analytics_dir": _size(Path(settings.analytics_db).parent),
                  "uploads": _size(settings.upload_dir)},
        "config": {k: getattr(settings, k, None) for k in _PUBLIC_CONFIG},
        "secrets_set": {k: bool(getattr(settings, k, "")) for k in ("supabase_service_key", "supabase_jwt_secret", "smtp_password",
                                                                     "verification_secret", "twilio_auth_token")},
    }


def recent_logs(level: str | None = None, limit: int = 300) -> list[dict]:
    rows = [r for r in logs.records if not level or r["level"] == level.upper()]
    return rows[-limit:][::-1]
