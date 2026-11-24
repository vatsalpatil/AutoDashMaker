"""Transform pipelines (SQL + Python layers), dataset blending,
and relationship management."""
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.store import store, DEFAULT_ORG, DEFAULT_WS, DEFAULT_USER
from ..services.engine import engine
from ..services.transforms import (
    frame,
    run_pipeline, preview_transform, SNIPPETS, SandboxError,
)

router = APIRouter(prefix="/api/transforms", tags=["transforms"])


def _safe_name(name: str) -> str:
    return "ds_" + re.sub(r"[^a-zA-Z0-9_]", "_", name.lower())[:40]


def _materialize(df, name: str, kind: str, source_id: str | None,
                 parents: list[str], layers: list[dict] | None,
                 base_dataset_id: str | None = None) -> dict:
    """Write a Polars frame into the analytics DB and register the dataset."""
    table = _safe_name(name)
    with engine.writer() as con:
        con.register("new_df", df.to_arrow())
        con.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT * FROM new_df")
        con.unregister("new_df")
    ds = store.insert("datasets", {
        "organization_id": DEFAULT_ORG, "workspace_id": DEFAULT_WS,
        "created_by": DEFAULT_USER,
        "source_id": source_id, "name": name, "kind": kind,
        "physical_name": table,
        "description": f"Derived from: {', '.join(parents)}" if parents else "",
        "row_count": df.height, "column_count": df.width,
        "layers": layers or [], "base_dataset_id": base_dataset_id,
    })
    for col, dtype in zip(df.columns, df.dtypes):
        store.insert("columns_meta", {"dataset_id": ds["id"],
                                      "name": col, "dtype": str(dtype)})
    return ds


def _materialize_sql(sql: str, name: str, kind: str, parents: list[str]) -> dict:
    """Run a (validated, read-only) SELECT straight into a new table inside DuckDB and register it as a dataset.
    Nothing passes through Python, so it is fast and independent of DuckDB's Python result API."""
    from ..core.security import validate_readonly
    table = _safe_name(name)
    select = validate_readonly(sql, 5_000_000)
    with engine.writer() as con:
        con.execute(f"CREATE OR REPLACE TABLE {table} AS {select}")
    schema = engine.describe_table(table)
    ds = store.insert("datasets", {
        "organization_id": DEFAULT_ORG, "workspace_id": DEFAULT_WS, "created_by": DEFAULT_USER,
        "source_id": None, "name": name, "kind": kind, "physical_name": table,
        "description": f"Derived from: {', '.join(parents)}" if parents else "",
        "row_count": schema["row_count"], "column_count": len(schema["columns"]), "layers": [],
    })
    for c in schema["columns"]:   # with distinct counts + samples, so the AI sees exact values here too
        store.insert("columns_meta", {"dataset_id": ds["id"], **c})
    return ds


# ------------------------------------------------------------- single layer

class PreviewIn(BaseModel):
    dataset_id: str
    kind: str               # sql | python
    sql: str | None = None
    code: str | None = None
    limit: int = 200


@router.post("/preview")
def preview(body: PreviewIn):
    ds = store.get("datasets", body.dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    payload = {"code": body.code} if body.kind == "python" else {"sql": body.sql}
    try:
        return preview_transform(ds["physical_name"], body.kind, payload, body.limit)
    except SandboxError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, str(e)[:400])


# ---------------------------------------------------------------- pipelines

class LayerIn(BaseModel):
    type: str               # sql | python
    sql: str | None = None
    code: str | None = None


class DeriveIn(BaseModel):
    name: str
    base_dataset_id: str
    layers: list[LayerIn]


@router.post("/derive")
def derive(body: DeriveIn):
    """Run a chained SQL/Python pipeline and save the result as a new dataset."""
    base = store.get("datasets", body.base_dataset_id)
    if not base:
        raise HTTPException(404, "base dataset not found")
    layers = [l.model_dump() for l in body.layers]
    try:
        df = run_pipeline(base["physical_name"], layers)
    except SandboxError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, str(e)[:400])
    ds = _materialize(df, body.name, kind="derived",
                      source_id=base.get("source_id"),
                      parents=[base["name"]], layers=layers,
                      base_dataset_id=base["id"])
    return ds


# ------------------------------------------------------------------ blending

class BlendIn(BaseModel):
    name: str
    left_dataset_id: str
    right_dataset_id: str
    left_column: str
    right_column: str
    join_type: str = "left"     # left | inner | full


@router.post("/blend")
def blend(body: BlendIn):
    """Join two datasets (any sources) into a new derived dataset (§45)."""
    left = store.get("datasets", body.left_dataset_id)
    right = store.get("datasets", body.right_dataset_id)
    if not left or not right:
        raise HTTPException(404, "dataset not found")
    join_sql = {"left": "LEFT JOIN", "inner": "INNER JOIN", "full": "FULL OUTER JOIN"}.get(body.join_type)
    if not join_sql:
        raise HTTPException(400, "join_type must be left|inner|full")
    left_cols = {c["name"] for c in store.list("columns_meta", where="dataset_id = ?",
                                               params=[left["id"]], order=None)}
    right_cols_meta = store.list("columns_meta", where="dataset_id = ?",
                                 params=[right["id"]], order=None)
    right_selects = []
    for c in right_cols_meta:
        if c["name"] == body.right_column and body.right_column == body.left_column:
            continue  # join key already present from the left side
        if c["name"] in left_cols:
            right_selects.append(f'r."{c["name"]}" AS "{right["name"]}_{c["name"]}"')
        else:
            right_selects.append(f'r."{c["name"]}"')
    sql = f'''
        SELECT l.*, {", ".join(right_selects) if right_selects else "r.*"}
        FROM {left["physical_name"]} l
        {join_sql} {right["physical_name"]} r
            ON l."{body.left_column}" = r."{body.right_column}"
    '''
    from ..core.security import validate_readonly
    try:
        ds = _materialize_sql(sql, body.name, "blend", [left["name"], right["name"]])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, str(e)[:400])
    store.insert("relationships", {
        "workspace_id": DEFAULT_WS,
        "left_dataset_id": left["id"], "left_column": body.left_column,
        "right_dataset_id": right["id"], "right_column": body.right_column,
        "join_type": body.join_type, "source": "manual",
    })
    return ds


class BlendManyIn(BaseModel):
    name: str | None = None
    dataset_ids: list[str]


def _free_name(base: str) -> str:
    """A readable dataset name not taken yet: orders_combined, orders_combined_2, ..."""
    taken = {d["name"] for d in store.list("datasets", order=None)}
    return next(n for n in (base if i == 1 else f"{base}_{i}" for i in range(1, 999)) if n not in taken)


@router.post("/blend-many")
def blend_many(body: BlendManyIn):
    """Combine several datasets along their saved relationships into one analysis dataset (services/blend_many.py)."""
    from ..core.security import validate_readonly
    from ..services import blend_many as bm
    try:
        p = bm.plan(body.dataset_ids)
        ds = _materialize_sql(p["sql"], body.name or _free_name(f"{p['used'][0]}_combined"), "blend", p["used"])
    except bm.BlendError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, str(e)[:400])
    return {**ds, "used": p["used"], "skipped": p["skipped"], "auto_links": p.get("auto_links", [])}


# ------------------------------------------------------------- relationships

class RelationshipIn(BaseModel):
    left_dataset_id: str
    left_column: str
    right_dataset_id: str
    right_column: str
    join_type: str = "left"


@router.get("/relationships")
def list_relationships():
    rels = store.list("relationships")
    for r in rels:
        r["left_dataset"] = (store.get("datasets", r["left_dataset_id"]) or {}).get("name")
        r["right_dataset"] = (store.get("datasets", r["right_dataset_id"]) or {}).get("name")
    return rels


@router.post("/relationships")
def create_relationship(body: RelationshipIn):
    return store.insert("relationships", {"workspace_id": DEFAULT_WS, **body.model_dump()})


@router.delete("/relationships/{rel_id}")
def delete_relationship(rel_id: str):
    store.delete("relationships", rel_id)
    return {"ok": True}


@router.get("/relationships/suggest")
def suggest_relationships():
    """Likely join keys (key-like columns whose values overlap), same-folder pairs first: services/rel_suggest.py."""
    from ..services import rel_suggest
    return rel_suggest.suggest()


@router.get("/snippets")
def snippets():
    """Ready-made Python/Polars recipes for the transform editor."""
    return SNIPPETS
