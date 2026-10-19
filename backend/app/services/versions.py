"""Dataset versions — Delta/Iceberg-style time travel for Parquet-backed datasets.

Every refresh keeps the previous Parquet file under `parquet/versions/<table>/<stamp>.parquet` (newest KEEP only),
so a bad refresh can be inspected (`SELECT ... FROM read_parquet(version)`) and rolled back in one call.
Versions count toward the user's quota; if they would not fit, the oldest are dropped first.
"""
from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from ..core import tenant

KEEP = 3


def _dir(table: str) -> Path:
    return tenant.parquet_dir() / "versions" / table


def snapshot(final: Path, table: str) -> None:
    """Move the current file of `table` into its version history (called just before it is replaced)."""
    if not final.exists():
        return
    d = _dir(table)
    d.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    shutil.copy2(final, d / f"{stamp}.parquet")
    prune(table, KEEP)


def prune(table: str, keep: int) -> None:
    files = sorted(_dir(table).glob("*.parquet"), reverse=True)
    for f in files[keep:]:
        f.unlink(missing_ok=True)


def list_versions(table: str) -> list[dict]:
    out = []
    for f in sorted(_dir(table).glob("*.parquet"), reverse=True):
        st = f.stat()
        ts = datetime.strptime(f.stem, "%Y%m%dT%H%M%S%fZ").replace(tzinfo=timezone.utc)
        out.append({"version": f.stem, "created_at": ts.isoformat(), "bytes": st.st_size})
    return out


def path_of(table: str, version: str) -> Path:
    p = _dir(table) / f"{version}.parquet"
    if not version.replace("T", "").replace("Z", "").isdigit() or not p.exists():
        raise LookupError("version not found")
    return p


def restore_file(table: str, version: str, final: Path) -> None:
    """Make `version` the current file again; the file it replaces becomes a version itself (restore is undoable)."""
    src = path_of(table, version)
    tmp = final.with_name(final.name + ".restore")
    shutil.copy2(src, tmp)
    snapshot(final, table)
    os.replace(tmp, final)


def remove_all(table: str) -> None:
    shutil.rmtree(_dir(table), ignore_errors=True)
