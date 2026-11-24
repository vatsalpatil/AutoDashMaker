"""Typed, batched reads of the data catalog (datasets + their columns). Use this instead of raw `store.list(...)`.

    from .catalog import catalog
    ds = catalog.dataset(id)                    # Dataset | None
    cols = catalog.columns(id)                  # list[ColumnMeta]
    by_ds = catalog.columns_of([id1, id2, ...]) # ONE query for many datasets (no per-dataset loop)

The records are TypedDicts: plain dicts at runtime (every existing caller keeps working) with real field names and types
for the editor and type checker. Everything stays tenant-scoped because it goes through `store`.
"""
from __future__ import annotations

from typing import Any, Iterable, TypedDict

from ..core.store import store


class ColumnMeta(TypedDict, total=False):
    dataset_id: str
    name: str
    dtype: str
    description: str
    null_pct: float
    distinct_count: int
    sample_values: Any
    min_value: Any
    max_value: Any


class Dataset(TypedDict, total=False):
    id: str
    name: str
    physical_name: str
    kind: str
    folder: str | None
    description: str
    row_count: int
    column_count: int
    source_id: str | None
    created_at: Any
    refreshed_at: Any


class _Catalog:
    def dataset(self, dataset_id: str) -> Dataset | None:
        return store.get("datasets", dataset_id)  # type: ignore[return-value]

    def datasets(self, *, queryable: bool = False, include_blends: bool = True) -> list[Dataset]:
        """All datasets of the workspace. `queryable` = has a table; `include_blends=False` skips combined datasets."""
        out = store.list("datasets", order=None)
        return [d for d in out if (not queryable or d.get("physical_name")) and (include_blends or d.get("kind") != "blend")]  # type: ignore[misc]

    def columns(self, dataset_id: str) -> list[ColumnMeta]:
        return store.list("columns_meta", where="dataset_id = ?", params=[dataset_id], order=None)  # type: ignore[return-value]

    def columns_of(self, dataset_ids: Iterable[str]) -> dict[str, list[ColumnMeta]]:
        """Columns of many datasets in one query, keyed by dataset id (ids with no columns map to [])."""
        ids = list(dict.fromkeys(dataset_ids))
        out: dict[str, list[ColumnMeta]] = {i: [] for i in ids}
        if not ids:
            return out
        rows = store.list("columns_meta", where=f"dataset_id IN ({', '.join('?' * len(ids))})", params=ids, order=None)
        for r in rows:
            out[r["dataset_id"]].append(r)  # type: ignore[arg-type]
        return out


catalog = _Catalog()
