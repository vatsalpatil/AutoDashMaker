"""Dataset ingestion and refresh (§27, §42).

Shared by the datasets router and the background refresher. Raises plain domain
errors (ConnectorError / LookupError) — HTTP mapping belongs to the routers.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from ..connectors import get_connector, ConnectorError
from ..core.store import store, DEFAULT_ORG, DEFAULT_WS, DEFAULT_USER
from . import audit, disk
from .engine import engine


def safe_table_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", name.lower())[:30]
    return f"ds_{cleaned}_{uuid.uuid4().hex[:6]}"


def ingest_source(src: dict, friendly_name: str, discover_name: str | None = None,
                  target_table: str | None = None) -> dict[str, Any]:
    """Materialize `src` into the analytics DB. With `target_table`, overwrite that table
    and return its stats; otherwise register a new dataset and return it."""
    disk.ensure_room()
    table = target_table or safe_table_name(friendly_name)
    try:
        with engine.writer() as con:
            result = get_connector(src["type"], src["config"]).ingest(
                discover_name or friendly_name, table, con
            )
    except ConnectorError as e:
        audit.record("dataset.ingest", entity_type="source", entity_id=src["id"],
                     detail=f"{friendly_name}: {e}", status="error")
        raise
    audit.record("dataset.refresh" if target_table else "dataset.ingest", entity_type="source",
                 entity_id=src["id"], detail=f"{friendly_name} ({result['row_count']} rows)")

    if target_table:
        return {"physical_name": table, "row_count": result["row_count"], "columns": result["columns"]}

    ds = store.insert("datasets", {
        "organization_id": DEFAULT_ORG, "workspace_id": DEFAULT_WS,
        "created_by": DEFAULT_USER,
        "source_id": src["id"], "name": friendly_name,
        "kind": src["type"], "physical_name": table,
        "row_count": result["row_count"], "column_count": len(result["columns"]),
    })
    for c in result["columns"]:
        store.insert("columns_meta", {"dataset_id": ds["id"], **c})
    ds["columns"] = result["columns"]
    return ds


def refresh_dataset(dataset_id: str) -> dict[str, Any]:
    """Re-ingest from the source (or replay a derived dataset's pipeline) and stamp refreshed_at.

    Raises LookupError if the dataset is missing, ConnectorError if it cannot be refreshed.
    """
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise LookupError("dataset not found")
    if ds.get("remote_table"):  # linked (live) dataset: refresh the schema + row count, nothing is copied
        from .remote import refresh_remote
        return refresh_remote(ds)
    if ds.get("kind") == "derived" and ds.get("layers"):
        from .transforms import run_pipeline  # lazy: transforms imports heavy deps
        layers = ds["layers"] if isinstance(ds["layers"], list) else []
        base = store.get("datasets", ds["base_dataset_id"]) if ds.get("base_dataset_id") else None
        if not base:
            raise ConnectorError("base dataset no longer exists")
        df = run_pipeline(base["physical_name"], layers)
        with engine.writer() as con:
            con.register("refresh_df", df.to_arrow())
            con.execute(f"CREATE OR REPLACE TABLE {ds['physical_name']} AS SELECT * FROM refresh_df")
            con.unregister("refresh_df")
        rows, cols = df.height, df.width
    else:
        src = store.get("datasources", ds["source_id"]) if ds.get("source_id") else None
        if not src:
            raise ConnectorError("dataset has no source to refresh from")
        result = ingest_source(src, ds["name"], target_table=ds["physical_name"])
        rows, cols = result["row_count"], len(result["columns"])
    store.update("datasets", dataset_id, {
        "refreshed_at": datetime.now(timezone.utc), "row_count": rows, "column_count": cols,
    })
    return store.get("datasets", dataset_id)
