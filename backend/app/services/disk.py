"""Disk-space guard: refuse new data once the data disk passes `disk_usage_limit_pct` full."""
import shutil

from ..connectors.base import ConnectorError
from ..core.config import DATA_DIR, settings


class DiskFull(ConnectorError):
    """Raised instead of writing when the disk is over the configured limit."""


def usage_pct(path: str = str(DATA_DIR)) -> float:
    u = shutil.disk_usage(path)
    return round(100 * u.used / u.total, 1)


def ensure_room(incoming_bytes: int = 0) -> None:
    """Raise DiskFull if the disk is (or with `incoming_bytes` would be) over the limit."""
    limit = settings.disk_usage_limit_pct
    if limit <= 0:
        return
    u = shutil.disk_usage(str(DATA_DIR))
    pct = 100 * (u.used + incoming_bytes) / u.total
    if pct > limit:
        raise DiskFull(f"Storage is {pct:.0f}% full (limit {limit}%). Delete unused datasets or files to free space.")
