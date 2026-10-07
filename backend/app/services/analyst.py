"""The conversational analyst behind Ask: question → SQL over *all* tables → result → chart, summary, follow-ups.

LLM decides; deterministic code verifies and executes: every statement still passes validate_readonly and the
engine's bind check before it runs.
"""
import re
from typing import Any

from ..core.security import validate_readonly
from ..core.store import store
from . import ai as ai_svc, assist as assist_svc, names
from .ai_context import semantic_context, with_notebook_steps, workbench_context
from .chart_suggest import column_roles, suggest_chart
from .engine import engine
from .explain import explain_sql
from .insights import detect_insights

SYSTEM = (
    "You are a careful data analyst inside a DuckDB analytics app. Turn the user's request into ONE read-only "
    "SELECT (CTEs, joins, window functions allowed) over the tables listed below. Reply with ONLY the SQL: no markdown, "
    "no comments. Use business metrics, definitions and synonyms exactly as defined; reuse verified example queries as "
    "patterns; reuse the user's saved queries by inlining them as CTEs when named. Never invent tables or columns. "
    "Add LIMIT when the result could be large. For a follow-up, build on the previous SQL (wrap it as a CTE) instead of "
    "starting over. " + ai_svc.CLARIFY_RULE + " " + ai_svc.NOT_A_QUERY_RULE)

SUMMARY_SYSTEM = (
    "You explain query results to a business user. Reply in exactly this format and nothing else:\n"
    "SUMMARY: <one or two plain sentences that answer the question using the actual numbers>\n"
    "FOLLOW-UPS:\n- <short follow-up question 1>\n- <short follow-up question 2>\n- <short follow-up question 3>")

_NUMERIC = re.compile(r"INT|DOUBLE|DECIMAL|FLOAT|REAL|NUMERIC|HUGEINT", re.IGNORECASE)
_TEMPORAL = re.compile(r"DATE|TIMESTAMP", re.IGNORECASE)


def starter_questions(dataset_id: str | None = None, limit: int = 6) -> list[str]:
    """Clickable first questions built from the schema and defined metrics (no model call)."""
    datasets = [d for d in store.list("datasets", order=None) if d.get("physical_name") and (not dataset_id or d["id"] == dataset_id)]
    cols = store.list("columns_meta", order=None)
    out: list[str] = []
    for m in store.list("metrics", order=None)[:2]:
        out.append(f"What is {m['label'].lower()}?")
    for d in datasets[:3]:
        mine = [c for c in cols if c["dataset_id"] == d["id"]]
        measures = [c["name"] for c in mine if _NUMERIC.search(c["dtype"] or "") and not c["name"].lower().endswith("id")]
        dims = [c["name"] for c in mine if "VARCHAR" in (c["dtype"] or "").upper()]
        times = [c["name"] for c in mine if _TEMPORAL.search(c["dtype"] or "")]
        t = names.label(d)
        if measures and dims:
            out += [f"Total {measures[0]} by {dims[0]} in {t}", f"Top 10 {dims[0]} by {measures[0]}"]
        if measures and times:
            out.append(f"How does {measures[0]} change over {times[0]}?")
        if not measures:
            out.append(f"How many rows are in {t}?")
    seen: set[str] = set()
    return [q for q in out if not (q in seen or seen.add(q))][:limit]


def _confidence(result: dict, sql: str) -> str:
    if result["warnings"]:
        return "data_quality_concern"
    if result["row_count"] == 0:
        return "insufficient_data"
    if any(v["sql"].strip() == sql.strip() for v in store.list("verified_queries", order=None)):
        return "verified"
    return "likely_correct"


def _fmt(n: float) -> str:
    return f"{n:,.0f}" if abs(n) >= 100 else f"{n:,.2f}".rstrip("0").rstrip(".")


def _facts(result: dict) -> tuple[str, list[str]]:
    """A deterministic one-line answer and follow-up ideas drawn from the result's shape."""
    rows, cols = result["rows"], result["columns"]
    n = result["row_count"]
    roles = column_roles(cols, rows)
    measure, cat, time = (roles[k][0] if roles[k] else None for k in ("measure", "category", "time"))
    if n == 1 and measure:
        return f"{measure.replace('_', ' ').capitalize()} is {_fmt(float(rows[0][measure]))}.", []
    if measure and (cat or time):
        key = cat or time
        vals = [(str(r[key]), float(r[measure])) for r in rows if r.get(measure) not in (None, "")]
        if vals:
            total = sum(v for _, v in vals) or 1
            top = max(vals, key=lambda kv: kv[1])
            low = min(vals, key=lambda kv: kv[1])
            text = f"{top[0]} is highest at {_fmt(top[1])} ({top[1] / total:.0%} of the total {_fmt(total)}) across {len(vals)} {key.replace('_', ' ')} values"
            text += f"; {low[0]} is lowest at {_fmt(low[1])}." if len(vals) > 1 else "."
            more = [f"Break {measure} down by another column", f"Show {measure} over time"] if cat else [f"Which {measure} values are unusual?"]
            return text, more + [f"Top 5 by {measure}"]
    return f"Found {n:,} row{'s' if n != 1 else ''} across {len(cols)} columns.", []


def _usable(text: str) -> bool:
    """Reject replies that echo the instructions or leave template brackets behind."""
    return bool(text) and "<" not in text and "plain sentences" not in text.lower() and len(text) < 600


def _summarize(question: str, result: dict, insights: list[dict], provider_id: str | None) -> tuple[str, list[str]]:
    """Plain-language answer + follow-up ideas. Falls back to a factual line if the model call fails."""
    rows = result["rows"][:15]
    fallback, ideas = _facts(result)
    try:
        raw = ai_svc.chat([
            {"role": "system", "content": SUMMARY_SYSTEM},
            {"role": "user", "content": f"Question: {question}\nColumns: {result['columns']}\nRows (first {len(rows)} of {result['row_count']}): {rows}\n"
                                        f"Notes: {[i['text'] for i in insights][:3]}"},
        ], provider_id=provider_id, max_tokens=400)
    except Exception:  # the answer is still useful without prose
        return fallback, ideas
    text = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", raw))
    m = re.search(r"SUMMARY:\s*(.+?)(?:\n\s*FOLLOW-?UPS?:|\Z)", text, re.DOTALL | re.IGNORECASE)
    follow = re.findall(r"^\s*[-*•]\s*(.+)$", text.split("FOLLOW", 1)[-1] if "FOLLOW" in text.upper() else "", re.MULTILINE)
    said = m.group(1).strip() if m else ""
    follow = [f.strip() for f in follow if _usable(f.strip())][:3]
    return (said if _usable(said) else fallback), (follow or ideas)


def answer(question: str, history: list[dict], dataset_id: str | None, provider_id: str | None, cells: list[dict] | None = None) -> dict[str, Any]:
    """One analyst turn. `history` = previous [{question, sql}] turns, oldest first."""
    ctx = with_notebook_steps(workbench_context(dataset_id, question), cells or [])
    messages: list[dict] = [{"role": "system", "content": SYSTEM}]
    for h in history[-3:]:
        if h.get("sql"):
            messages += [{"role": "user", "content": h.get("question", "")}, {"role": "assistant", "content": h["sql"]}]
    messages.append({"role": "user", "content": f"{ctx}\n\n{semantic_context(dataset_id)}\n\nQuestion: {question}"})

    try:
        sql = ai_svc.generate_sql(messages, provider_id=provider_id, check=engine.check_sql)
    except ai_svc.NeedsClarification as e:
        return {"status": "clarify", "detail": str(e.args[0])}
    except ai_svc.NotAQuery:
        return {"status": "not_a_query", "detail": "That doesn't look like a question about your data. Try one of the suggestions below."}
    safe = validate_readonly(sql, 10000)

    try:
        result = engine.execute(safe)
    except Exception as first:  # one repair round using the database's own error
        try:
            safe = validate_readonly(assist_svc.fix_sql(safe, str(first), ctx, provider_id, engine.check_sql), 10000)
            result = engine.execute(safe)
        except Exception as e:
            return {"status": "sql_error", "detail": str(e)[:300], "sql": safe}

    insights = detect_insights(result["rows"], result["columns"])
    summary, follow = _summarize(question, result, insights, provider_id)
    return {
        "status": "ok", "sql": result["sql"], "result": result, "summary": summary, "followups": follow,
        "chart": suggest_chart(result["columns"], result["rows"]), "explanation": explain_sql(result["sql"]),
        "insights": insights, "confidence": _confidence(result, result["sql"]),
        "provenance": {"tables": explain_sql(result["sql"]).get("tables", []), "rows": result["row_count"],
                       "duration_ms": result["duration_ms"], "warnings": result["warnings"]},
    }
