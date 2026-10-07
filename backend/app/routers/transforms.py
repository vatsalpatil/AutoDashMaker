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
        with engine.connect(read_only=True) as con:
            df = con.execute(validate_readonly(sql, 1_000_000)).pl()
    except Exception as e:
        raise HTTPException(400, str(e)[:400])
    ds = _materialize(df, body.name, kind="blend",
                      source_id=None,
                      parents=[left["name"], right["name"]], layers=None)
    store.insert("relationships", {
        "workspace_id": DEFAULT_WS,
        "left_dataset_id": left["id"], "left_column": body.left_column,
        "right_dataset_id": right["id"], "right_column": body.right_column,
        "join_type": body.join_type, "source": "manual",
    })
    return ds


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
    """Auto-suggest join keys: same column name + compatible dtype across datasets."""
    datasets = store.list("datasets", order=None)
    suggestions = []
    for i, a in enumerate(datasets):
        cols_a = store.list("columns_meta", where="dataset_id = ?", params=[a["id"]], order=None)
        for b in datasets[i + 1:]:
            cols_b = store.list("columns_meta", where="dataset_id = ?", params=[b["id"]], order=None)
            b_by_name = {c["name"]: c for c in cols_b}
            for ca in cols_a:
                cb = b_by_name.get(ca["name"])
                if cb and ca["dtype"] == cb["dtype"]:
                    suggestions.append({
                        "left_dataset_id": a["id"], "left_dataset": a["name"],
                        "left_column": ca["name"],
                        "right_dataset_id": b["id"], "right_dataset": b["name"],
                        "right_column": cb["name"], "dtype": ca["dtype"],
                    })
    # exclude already-declared relationships
    existing = {(r["left_dataset_id"], r["left_column"], r["right_dataset_id"], r["right_column"])
                for r in store.list("relationships", order=None)}
    return [s for s in suggestions
            if (s["left_dataset_id"], s["left_column"], s["right_dataset_id"], s["right_column"]) not in existing]


@router.get("/snippets")
def snippets():
    """Ready-made Python/Polars recipes for the transform editor."""
    return SNIPPETS
