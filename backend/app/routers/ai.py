"""AI endpoints: workbench assistant (/sql, /assist) and the full ask pipeline (§16).

Question → context retrieval (schema + semantic layer + verified examples)
→ NL→SQL → read-only validation → execution → result profiling
→ deterministic explanation + insights → confidence classification.

LLM decides; deterministic code verifies and executes (§88).
Provider management lives in ai_providers.py; prompt context in services/ai_context.py.
"""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.security import UnsafeQueryError, validate_readonly
from ..core.store import store, DEFAULT_WS
from ..services import ai as ai_svc, assist as assist_svc, audit
from ..services.ai_context import semantic_context, table_schema_text, with_notebook_steps, workbench_context
from ..services.engine import engine
from ..services.explain import explain_sql
from ..services.insights import detect_insights
from . import ai_agent, ai_chat, ai_providers

router = APIRouter(prefix="/api/ai", tags=["ai"])
router.include_router(ai_providers.router)
router.include_router(ai_chat.router)
router.include_router(ai_agent.router)

NOT_A_QUERY_REPLY = ("That doesn't look like a question about your data. "
                     "Try something like \"total amount by region\" or \"top 5 products by amount\".")
_EDIT_INTENT = re.compile(
    r"\b(edit|change|modify|update|fix|add|remove|drop|filter|sort|order|limit|top|only|group|rename|replace|"
    r"include|exclude|show|also|instead|but|make)\b", re.IGNORECASE)


class AskIn(BaseModel):
    question: str
    dataset_id: str | None = None
    provider_id: str | None = None
    conversation_id: str | None = None
    previous_sql: str | None = None   # follow-up: modify this query


class SqlGenIn(BaseModel):
    question: str
    dataset_id: str | None = None
    provider_id: str | None = None
    current_sql: str | None = None   # editor content to refine
    history: list[dict] = []         # [{role, content}] chat turns
    cells: list[dict] = []           # notebook cells [{name, sql}] the assistant may query by name


class AssistIn(BaseModel):
    action: str                      # fix | optimize | explain
    sql: str
    error: str | None = None         # fix: the database error
    dataset_id: str | None = None
    provider_id: str | None = None
    cells: list[dict] = []           # notebook cells the query may reference by name


def _confidence(question: str, result: dict, ds: dict, warnings: list[str]) -> str:
    """§30: classify, never fabricate a percentage."""
    if warnings:
        return "data_quality_concern"
    if result["row_count"] == 0:
        return "insufficient_data"
    q = question.lower()
    metrics = store.list("metrics", where="dataset_id = ?", params=[ds["id"]], order=None)
    if len([m for m in metrics if m["name"].split("_")[0].lower() in q]) > 1:
        return "needs_clarification"
    if any(v["sql"].strip() == result["sql"].strip() for v in store.list("verified_queries", order=None)):
        return "verified"
    return "likely_correct"


# ------------------------------------------------------------------- assist

@router.post("/assist")
def assist(body: AssistIn):
    """One-click helpers on an existing query: fix its error, optimize it, or explain it in plain language."""
    if body.action not in ("fix", "optimize", "explain"):
        raise HTTPException(400, "action must be fix, optimize or explain")
    if not body.sql.strip():
        raise HTTPException(400, "nothing to work on: the query is empty")
    if body.action == "fix" and not body.error:
        raise HTTPException(400, "fix needs the error message")
    ctx = with_notebook_steps(workbench_context(body.dataset_id, body.sql), body.cells)
    try:
        if body.action == "fix":
            sql = assist_svc.fix_sql(body.sql, body.error, ctx, body.provider_id, engine.check_sql)
            validate_readonly(sql, 10000)
            audit.record("ai.fix", detail=f"{body.error[:200]} -> {sql}")
            return {"status": "ok", "sql": sql}
        if body.action == "optimize":
            out = assist_svc.optimize_sql(body.sql, ctx, body.provider_id, engine.check_sql)
            validate_readonly(out["sql"], 10000)
            audit.record("ai.optimize", detail=out["sql"])
            return {"status": "ok", **out}
        text = assist_svc.explain_query(body.sql, ctx, body.provider_id)
        return {"status": "ok", "text": text, "structure": explain_sql(body.sql)}
    except UnsafeQueryError as e:
        audit.record(f"ai.{body.action}", detail=f"blocked: {e}", status="blocked")
        raise HTTPException(400, f"AI produced unsafe SQL: {e}")
    except ai_svc.AIError as e:
        return {"status": "no_provider", "detail": str(e)}
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")


# ---------------------------------------------------------------------- sql

_SQL_SYSTEM = (
    "You are a SQL assistant inside a DuckDB analytics workbench. Reply with ONLY "
    "a single read-only SELECT query (no markdown, no comments, no explanation). "
    "Use {df}-free plain table names. Add LIMIT for large results. Never invent "
    "columns. For complex requests use WITH (CTEs), joins, subqueries and window functions as needed; "
    "still output exactly one statement. If the request modifies, extends, combines with or compares "
    "against the current SQL, return ONE query that builds on it (wrap the current SQL as a CTE) "
    "instead of replacing it. When asked to edit, fix or change the current SQL, output the COMPLETE "
    "edited query (it will be written straight into the editor). You can see all tables and the user's "
    "saved queries below; use any table, and reuse a saved query by inlining it when the user names it. "
    + ai_svc.NOT_A_QUERY_RULE)


@router.post("/sql")
def generate_sql(body: SqlGenIn):
    """Workbench AI assistant: NL -> SQL only (no execution). The user reviews and runs the SQL."""
    ds = store.get("datasets", body.dataset_id) if body.dataset_id else None
    schema_txt = f"{table_schema_text(ds)}\n{semantic_context(ds['id'])}\n" if ds else ""
    ctx = with_notebook_steps(workbench_context(body.dataset_id, body.question), body.cells)
    user = (f"{ctx}\n\n{schema_txt}\n"
            + (f"Current SQL in editor:\n{body.current_sql}\n\n" if body.current_sql else "")
            + f"Request: {body.question}")
    messages = [{"role": "system", "content": _SQL_SYSTEM}, *body.history[-6:], {"role": "user", "content": user}]
    sql = ""
    try:
        try:
            sql = ai_svc.generate_sql(messages, provider_id=body.provider_id, check=engine.check_sql)
        except ai_svc.NotAQuery:
            # A model can wrongly call "edit this to ..." chit-chat. With SQL in the editor and edit wording
            # in the message, insist once before giving up.
            if not (body.current_sql and _EDIT_INTENT.search(body.question)):
                raise
            sql = ai_svc.generate_sql(
                messages + [{"role": "user", "content": "That IS a valid request about the current SQL. Apply it "
                                                        "and reply with ONLY the complete edited query."}],
                provider_id=body.provider_id, check=engine.check_sql)
        safe = validate_readonly(sql, 10000)
    except UnsafeQueryError as e:
        audit.record("ai.sql", detail=f"blocked AI SQL: {sql}", status="blocked")
        raise HTTPException(400, f"AI generated unsafe SQL: {e}")
    except ai_svc.NotAQuery:
        return {"status": "not_a_query", "detail": NOT_A_QUERY_REPLY, "sql": None}
    except ai_svc.AIError as e:
        return {"status": "no_provider", "detail": str(e), "sql": None}
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")
    return {"status": "ok", "sql": safe, "explanation": explain_sql(safe)}


# ---------------------------------------------------------------------- ask

@router.post("/ask")
def ask(body: AskIn):
    if not body.dataset_id:
        raise HTTPException(400, "dataset_id required for now")
    ds = store.get("datasets", body.dataset_id)
    if not ds:
        raise HTTPException(404, "dataset not found")

    followup = ""
    if body.previous_sql:
        followup = (
            "\n\nThis is a FOLLOW-UP question. Modify the previous query to answer it "
            "(e.g. add filters, change grouping, add a comparison). Previous SQL:\n"
            f"{body.previous_sql}"
        )
    messages = [
        {"role": "system", "content":
         "You translate business questions into a single read-only DuckDB SELECT query.\n"
         "Rules: reply with ONLY the SQL (no markdown, no comments); respect the business "
         "metrics, definitions and synonyms EXACTLY as defined; use verified example "
         "queries as patterns when relevant; always add LIMIT if the result could be "
         "large; never invent columns that are not listed. " + ai_svc.NOT_A_QUERY_RULE},
        {"role": "user", "content":
         f"{table_schema_text(ds)}\n{semantic_context(body.dataset_id)}\n\nQuestion: {body.question}{followup}"},
    ]

    sql = ""
    try:
        sql = ai_svc.generate_sql(messages, provider_id=body.provider_id, check=engine.check_sql)
        validate_readonly(sql, 10000)
    except UnsafeQueryError as e:
        audit.record("ai.ask", entity_type="dataset", entity_id=ds["id"],
                     detail=f"Q: {body.question} | blocked AI SQL: {sql}", status="blocked")
        raise HTTPException(400, f"AI generated unsafe SQL: {e}")
    except ai_svc.NotAQuery:
        return {"status": "not_a_query", "detail": NOT_A_QUERY_REPLY, "sql": None, "result": None}
    except ai_svc.AIError as e:
        return {"status": "no_provider", "detail": str(e), "sql": None, "result": None}
    except Exception as e:
        raise HTTPException(502, f"AI call failed: {str(e)[:300]}")

    try:
        result = engine.execute(sql)
    except Exception as e:
        audit.record("ai.ask", entity_type="dataset", entity_id=ds["id"],
                     detail=f"Q: {body.question} | SQL: {sql} | {e}", status="error")
        return {"status": "sql_error", "detail": str(e)[:300], "sql": sql, "result": None}
    audit.record("ai.ask", entity_type="dataset", entity_id=ds["id"],
                 detail=f"Q: {body.question} | SQL: {result['sql']}", duration_ms=result["duration_ms"])

    # persist conversation state (§32)
    conv_id = body.conversation_id
    state = {"dataset_id": ds["id"], "last_sql": result["sql"], "last_question": body.question}
    if conv_id and store.get("conversations", conv_id):
        store.update("conversations", conv_id, {"state": state})
    else:
        conv_id = store.insert("conversations", {"workspace_id": DEFAULT_WS, "state": state})["id"]

    return {
        "status": "ok",
        "sql": result["sql"],
        "result": result,
        "explanation": explain_sql(result["sql"]),
        "insights": detect_insights(result["rows"], result["columns"]),
        "confidence": _confidence(body.question, result, ds, result["warnings"]),
        "conversation_id": conv_id,
        "provenance": {
            "dataset": ds["name"],
            "dataset_id": ds["id"],
            "rows": result["row_count"],
            "duration_ms": result["duration_ms"],
            "warnings": result["warnings"],
        },
    }
