"""Visual query builder API: schema for the pickers, compile (spec -> SQL), run, distinct values, join suggestions."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.security import UnsafeQueryError, quote_ident
from ..core.store import store
from ..services import audit
from ..services.engine import engine
from ..services.qb import compile_spec

router = APIRouter(prefix="/api/qb", tags=["query-builder"])


@router.get("/schema")
def schema():
    """Every table with typed columns + declared/guessed join keys: all the builder's pickers come from this one call."""
    cols: dict[str, list[dict]] = {}
    for c in store.list("columns_meta", order=None):
        cols.setdefault(c["dataset_id"], []).append({"name": c["name"], "dtype": c.get("dtype") or "text"})
    tables = [{"name": d["name"], "id": d["id"], "kind": d.get("kind"), "row_count": d.get("row_count"), "columns": cols.get(d["id"], [])}
              for d in store.list("datasets", order=None) if d.get("physical_name")]
    by_id = {t["id"]: t["name"] for t in tables}
    links = [{"left": by_id.get(r["left_dataset_id"]), "left_column": r["left_column"], "right": by_id.get(r["right_dataset_id"]),
              "right_column": r["right_column"], "type": r.get("join_type") or "left", "declared": True}
             for r in store.list("relationships", order=None) if r["left_dataset_id"] in by_id and r["right_dataset_id"] in by_id]
    seen = {(l["left"], l["left_column"], l["right"], l["right_column"]) for l in links}
    for i, a in enumerate(tables):                      # same name + same type => probable key (id-like columns first)
        for b in tables[i + 1:]:
            bm = {c["name"]: c for c in b["columns"]}
            for ca in a["columns"]:
                cb = bm.get(ca["name"])
                if cb and cb["dtype"] == ca["dtype"] and (a["name"], ca["name"], b["name"], cb["name"]) not in seen \
                        and (ca["name"].lower().endswith("id") or ca["name"].lower() in ("key", "code", "email")):
                    links.append({"left": a["name"], "left_column": ca["name"], "right": b["name"], "right_column": cb["name"], "type": "left", "declared": False})
    return {"tables": tables, "links": links}


class SpecIn(BaseModel):
    spec: dict
    upto: int | None = None
    row_limit: int | None = None


def _compile(spec: dict, upto: int | None) -> str:
    try:
        return compile_spec(spec, upto)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/compile")
def compile_(body: SpecIn):
    return {"sql": _compile(body.spec, body.upto)}


@router.post("/run")
def run(body: SpecIn):
    sql = _compile(body.spec, body.upto)
    try:
        result = engine.execute(sql, body.row_limit)
    except UnsafeQueryError as e:
        raise HTTPException(400, f"unsafe query: {e}")
    except Exception as e:
        audit.record("qb.run", detail=f"{sql} -- {e}", status="error")
        raise HTTPException(400, str(e)[:500])
    audit.record("qb.run", detail=result["sql"], duration_ms=result["duration_ms"])
    return result


class ValuesIn(BaseModel):
    table: str
    column: str
    search: str = ""
    limit: int = 50


@router.post("/values")
def values(body: ValuesIn):
    """Distinct values of a column (with counts) for the filter value picker."""
    col = quote_ident(body.column)
    spec = {"table": body.table, "aggregations": [{"fn": "count", "as": "n"}], "breakouts": [{"col": body.column, "as": "value"}],
            "sort": [{"col": "n", "dir": "desc"}], "limit": min(max(body.limit, 1), 200)}
    if body.search:
        spec["filters"] = [{"col": body.column, "op": "contains", "value": body.search}]
    sql = _compile(spec, None)
    try:
        r = engine.execute(sql, 200)
    except Exception as e:
        raise HTTPException(400, str(e)[:300])
    return {"values": [{"value": x["value"], "count": x["n"]} for x in r["rows"]], "column": col}


# ----------------------------------------------------------------------------------------------- AI + explanation
from ..services import ai as ai_svc  # noqa: E402
from ..services.qb_ai import build_spec, formula as ai_formula  # noqa: E402
from ..services.qb_explain import describe_spec  # noqa: E402


class ExplainIn(BaseModel):
    spec: dict


@router.post("/explain")
def explain(body: ExplainIn):
    """Plain-English steps for a spec (deterministic, no model)."""
    return {"steps": describe_spec(body.spec)}


class AiBuildIn(BaseModel):
    prompt: str
    spec: dict | None = None          # the current spec: the request then edits it instead of starting over
    provider_id: str | None = None


def _ai_error(e: Exception) -> dict:
    return {"status": "no_provider" if "No AI provider" in str(e) else "failed", "detail": str(e)}


@router.post("/ai/build")
def ai_build(body: AiBuildIn):
    if not body.prompt.strip():
        raise HTTPException(400, "describe what you want to see")
    try:
        out = build_spec(body.prompt.strip(), body.spec, body.provider_id)
    except (ai_svc.AIError, ValueError) as e:
        audit.record("qb.ai", detail=f"{body.prompt[:200]} -- {e}", status="error")
        return _ai_error(e)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    audit.record("qb.ai", detail=f"built from: {body.prompt[:200]}")
    return {"status": "ok", **out}


class AiFormulaIn(BaseModel):
    prompt: str = ""
    table: str | None = None
    columns: list[dict] = []
    expr: str = ""
    error: str = ""
    provider_id: str | None = None


@router.post("/ai/formula")
def ai_formula_route(body: AiFormulaIn):
    if not (body.prompt.strip() or body.expr.strip()):
        raise HTTPException(400, "describe the column or give a formula to fix")
    try:
        out = ai_formula(body.prompt.strip(), body.table, body.columns, body.expr.strip(), body.error.strip(), body.provider_id)
    except (ai_svc.AIError, ValueError) as e:
        return _ai_error(e)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    return {"status": "ok", **out}


@router.get("/ai/suggest")
def ai_suggest(table: str | None = None):
    """Clickable starter requests from the schema (no model call)."""
    from ..services.analyst import starter_questions
    ds = next((d for d in store.list("datasets", order=None) if table and d["name"] == table), None)
    return {"suggestions": starter_questions(ds["id"] if ds else None, 6)}


class FromSqlIn(BaseModel):
    sql: str


@router.post("/from-sql")
def from_sql(body: FromSqlIn):
    """Workbench -> builder: SQL as builder steps (exact when a round-trip check passes, else wrapped as a raw-SQL first stage)."""
    from ..services.qb_import import sql_to_spec
    try:
        return sql_to_spec(body.sql)
    except ValueError as e:
        raise HTTPException(400, str(e))
