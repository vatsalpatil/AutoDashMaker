"""Per-user storage limits. Enforced only on hosted servers (AUTH_ENABLED); local mode is unlimited.

Usage = the user's Parquet dataset files + their upload folder, so the quota counts the *compressed* size.
"""
from __future__ import annotations

from pathlib import Path

from ..connectors.base import ConnectorError
from ..core import tenant
from ..core.config import settings


class QuotaExceeded(ConnectorError):
    """Raised instead of storing data that would put the user over a limit."""


def enforced() -> bool:
    return settings.auth_enabled


def _dir_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) if path.exists() else 0


def used_bytes() -> int:
    return _dir_size(tenant.parquet_dir()) + _dir_size(tenant.upload_dir())


def _limit(name: str) -> int:
    from .admin.controls import limit  # backoffice overrides (per user, then platform), else .env
    return limit(name)


def limit_bytes() -> int:
    return _limit("user_quota_mb") * 1_000_000


def ensure_fits(extra_bytes: int = 0) -> None:
    if enforced() and used_bytes() + max(extra_bytes, 0) > limit_bytes():
        raise QuotaExceeded(f"Storage limit reached ({_limit('user_quota_mb')} MB per account). Delete a dataset to free space.")


def check_rows(rows: int) -> None:
    if enforced() and rows > _limit("max_rows_per_dataset"):
        raise QuotaExceeded(f"This dataset has {rows:,} rows; the limit is {_limit('max_rows_per_dataset'):,} per dataset.")


def check_dataset_count() -> None:
    if not enforced():
        return
    from ..core.store import store
    if len(store.list("datasets", order=None)) >= _limit("max_datasets"):
        raise QuotaExceeded(f"Dataset limit reached ({_limit('max_datasets')} per account). Delete one to add another.")


def usage() -> dict:
    return {"enforced": enforced(), "used_mb": round(used_bytes() / 1e6, 1), "limit_mb": _limit("user_quota_mb"),
            "max_upload_mb": _limit("max_upload_mb"), "max_rows": _limit("max_rows_per_dataset"),
            "max_datasets": _limit("max_datasets")}
