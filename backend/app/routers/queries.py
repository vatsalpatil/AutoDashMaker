"""SQL workbench: validated read-only execution + saved queries."""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import settings
from ..core.security import UnsafeQueryError, validate_readonly
from ..core.store import store
from ..services import audit
from ..services.compose import compose_cell_sql, compose_sql, format_sql
from ..services.dialects import DIALECTS, convert_sql
from ..services.engine import engine

router = APIRouter(prefix="/api/queries", tags=["queries"])


class QueryIn(BaseModel):
    sql: str
    name: str = "Untitled query"
    dataset_id: str | None = None
    row_limit: int | None = None
    save: bool = True


class QueryPatch(BaseModel):
    sql: str | None = None
    name: str | None = None


@router.patch("/{query_id}")
def update_query(query_id: str, body: QueryPatch):
    """Edit a saved query in place (after the same read-only check every query passes)."""
    q = store.get("queries", query_id)
    if not q:
        raise HTTPException(404, "query not found")
    patch: dict = {}
    if body.name is not None:
        patch["name"] = body.name.strip() or q["name"]
    if body.sql is not None:
        try:
            validate_readonly(body.sql, settings.default_row_limit)
        except UnsafeQueryError as e:
            audit.record("query.update", entity_type="query", entity_id=query_id, detail=body.sql, status="blocked")
            raise HTTPException(400, f"unsafe query: {e}")
        patch["sql"] = body.sql.strip().rstrip(";").strip()
    if patch:
        store.update("queries", query_id, patch)
        audit.record("query.update", entity_type="query", entity_id=query_id, detail=patch.get("sql") or patch.get("name"))
    return store.get("queries", query_id)


class ComposeIn(BaseModel):
    base_sql: str = ""
    add_sql: str
    name: str | None = None


@router.post("/compose")
def compose(body: ComposeIn):
    """Add `add_sql` to the editor's query as a CTE step: WITH step_1 AS (...), step_2 AS (...) SELECT * FROM step_2."""
    try:
        return {"sql": compose_sql(body.base_sql, body.add_sql, body.name)}
    except ValueError as e:
        raise HTTPException(400, str(e))


class ConvertIn(BaseModel):
    sql: str
    to: str


class LintIn(BaseModel):
    sql: str


@router.post("/lint")
def lint_query(body: LintIn):
    """Instant rule-based checks (SELECT *, missing LIMIT, NOT IN, functions on filters ...): the no-AI half of Optimize."""
    from ..services.sql_lint import lint
    from ..services.names import resolve
    return {"checks": lint(resolve(body.sql))}


@router.get("/dialects")
def dialects():
    return {"dialects": [{"id": k, "label": v} for k, v in DIALECTS.items()]}


@router.post("/convert")
def convert(body: ConvertIn):
    """Translate a DuckDB query into another database's dialect (deterministic, no AI)."""
    try:
        return {"sql": convert_sql(body.sql, body.to), "dialect": DIALECTS[body.to]}
    except ValueError as e:
        raise HTTPException(400, str(e))


class FormatIn(BaseModel):
    sql: str


@router.post("/format")
def format_query(body: FormatIn):
    try:
        return {"sql": format_sql(body.sql)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/run")
def run_query(body: QueryIn):
    try:
        result = engine.execute(body.sql, body.row_limit)
    except UnsafeQueryError as e:
        audit.record("query.run", detail=body.sql, status="blocked")
        raise HTTPException(400, f"unsafe query: {e}")
    except Exception as e:
        audit.record("query.run", detail=f"{body.sql} -- {e}", status="error")
        raise HTTPException(400, str(e)[:500])
    audit.record("query.run", detail=result["sql"], duration_ms=result["duration_ms"])
    if body.save:
        q = store.insert("queries", {
            "dataset_id": body.dataset_id, "name": body.name,
            "sql": result["sql"], "status": "ok",
            "row_count": result["row_count"], "duration_ms": result["duration_ms"],
        })
        result["query_id"] = q["id"]
    return result


class CellIn(BaseModel):
    name: str
    sql: str


class RunCellIn(BaseModel):
    cells: list[CellIn]
    index: int
    row_limit: int | None = None


@router.post("/run-cell")
def run_cell(body: RunCellIn):
    """Run one notebook cell; earlier cells it references by name are chained in as CTEs."""
    if not 0 <= body.index < len(body.cells):
        raise HTTPException(400, "cell index out of range")
    try:
        sql = compose_cell_sql([c.model_dump() for c in body.cells], body.index, set(engine.list_tables()))
    except ValueError as e:
        raise HTTPException(400, str(e))
    try:
        result = run_query(QueryIn(sql=sql, row_limit=body.row_limit, save=False))
    except HTTPException as e:
        # DuckDB says "Table with name X does not exist": if X is a cell further down, say so plainly
        for later in body.cells[body.index + 1:]:
            if re.search(rf"Table with name {re.escape(later.name)} does not exist", str(e.detail), re.IGNORECASE):
                raise HTTPException(400, f"This cell uses '{later.name}', which is defined further down. "
                                         "Move that cell above this one.") from e
        raise
    return {**result, "chained": sql != body.cells[body.index].sql.strip().rstrip(";").strip()}


@router.get("")
def list_queries():
    return store.list("queries")


@router.get("/{query_id}")
def get_query(query_id: str):
    q = store.get("queries", query_id)
    if not q:
        raise HTTPException(404, "query not found")
    return q


@router.delete("/{query_id}")
def delete_query(query_id: str):
    store.delete("queries", query_id)
    return {"ok": True}
