"""Dataset display name, folder and description: what people call and how they group a dataset.

The physical table never changes, so renaming is safe for saved queries/charts (they store the physical SQL). The
friendly-name map (services/names.py) follows store.version('datasets'), so the new name works in SQL at once."""
from __future__ import annotations

import re

from ..core.store import store

MAX_NAME = 80
MAX_FOLDER = 60


class MetaError(ValueError):
    pass


def clean_name(name: str, dataset_id: str | None = None) -> str:
    name = re.sub(r"\s+", " ", (name or "")).strip()
    if not name:
        raise MetaError("Name can't be empty.")
    if len(name) > MAX_NAME:
        raise MetaError(f"Name is too long (max {MAX_NAME} characters).")
    for d in store.list("datasets", order=None):
        if d["id"] == dataset_id:
            continue
        if d["name"].lower() == name.lower():
            raise MetaError(f"Another dataset is already called '{d['name']}'. Pick a different name.")
        if (d.get("physical_name") or "").lower() == name.lower():
            raise MetaError("That name is reserved for an internal table. Pick a different name.")
    return name


def clean_folder(folder: str | None) -> str | None:
    """'' / None = no folder. Nested folders use '/', e.g. 'Finance/2026'."""
    if folder is None:
        return None
    parts = [re.sub(r"\s+", " ", p).strip() for p in folder.replace("\\", "/").split("/")]
    folder = "/".join(p for p in parts if p)
    if len(folder) > MAX_FOLDER:
        raise MetaError(f"Folder name is too long (max {MAX_FOLDER} characters).")
    return folder or None


def apply(dataset_id: str, *, name: str | None = None, folder: str | None = None,
          description: str | None = None, folder_set: bool = False) -> dict:
    """Update the given fields; `folder_set` distinguishes 'clear the folder' from 'leave it as is'."""
    changes: dict = {}
    if name is not None:
        changes["name"] = clean_name(name, dataset_id)
    if folder_set or folder is not None:
        changes["folder"] = clean_folder(folder)
    if description is not None:
        changes["description"] = description.strip()[:500]
    if changes:
        store.update("datasets", dataset_id, changes)
    return store.get("datasets", dataset_id) or {}


def folders() -> list[dict]:
    """Every folder in use with its dataset count (for pickers and the grouped list)."""
    counts: dict[str, int] = {}
    for d in store.list("datasets", order=None):
        if d.get("folder"):
            counts[d["folder"]] = counts.get(d["folder"], 0) + 1
    return [{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda kv: kv[0].lower())]
