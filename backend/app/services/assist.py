"""AI helpers around a query the user already has: fix an error, optimize, explain (Chat2DB-style actions).

Each one reuses the same safety net as generation: the model's SQL is extracted from its reply, bound
against the real schema (EXPLAIN) with one repair round, and finally goes through the read-only guard when
the user runs it. Nothing here executes SQL.
"""
from __future__ import annotations

import re
from typing import Any, Callable

from . import ai as ai_svc
from .explain import explain_sql

_NOTES = re.compile(r"(?is)\bnotes?\s*:?\s*(.+)$")

FIX_RULES = (
    "You repair DuckDB SQL. Reply with ONLY the corrected single read-only query: no markdown, no comments, "
    "no explanation. Keep the user's intent and column aliases. Use only the listed tables, columns and notebook "
    "steps (earlier cells are queryable by name)."
)

OPTIMIZE_RULES = (
    "You optimize DuckDB SQL for speed and clarity WITHOUT changing the result: same columns, same rows, same "
    "ordering semantics. Typical wins: select only needed columns instead of *, filter early, remove redundant "
    "subqueries/CTEs, avoid repeated scans, replace correlated subqueries with joins, use the right aggregate. "
    "If the query is already good, return it unchanged. Reply with the query in a ```sql block, then a line "
    "'Notes:' followed by 1-4 short bullet points describing what changed (or 'No changes needed')."
)

EXPLAIN_RULES = (
    "Explain this DuckDB query to a business analyst in 3-6 short bullet points: what it computes, which tables "
    "and filters it uses, how it groups/sorts, and any assumption or pitfall (NULL handling, duplicate rows from "
    "joins, time ranges). Plain language, no SQL jargon where avoidable. Do not repeat the query."
)


def _messages(system: str, context: str, body: str) -> list[dict[str, str]]:
    return [{"role": "system", "content": system}, {"role": "user", "content": f"{context}\n\n{body}"}]


def fix_sql(sql: str, error: str, context: str, provider_id: str | None,
            check: Callable[[str], str | None] | None) -> str:
    """Corrected query for `sql` that failed with `error`."""
    body = f"Query:\n{sql}\n\nIt failed with this error:\n{error[:800]}\n\nReturn the corrected query."
    return ai_svc.generate_sql(_messages(FIX_RULES, context, body), provider_id=provider_id, check=check)


def optimize_sql(sql: str, context: str, provider_id: str | None,
                 check: Callable[[str], str | None] | None) -> dict[str, Any]:
    """{sql, notes, changed}: an equivalent faster/cleaner rewrite plus what changed."""
    msgs = _messages(OPTIMIZE_RULES, context, f"Query:\n{sql}")
    raw = ai_svc.chat(msgs, provider_id=provider_id, max_tokens=3000)
    new_sql = ai_svc.extract_sql(raw)
    if not ai_svc._parses(new_sql):
        # reasoning models often spend the first answer on thinking: insist once on just the query (the notes are then lost)
        raw = ai_svc.chat(msgs + [{"role": "assistant", "content": new_sql[:400]}, {"role": "user", "content":
                          "That was not a single DuckDB query. Reply with ONLY the optimized query in a ```sql block, nothing else."}],
                          provider_id=provider_id, max_tokens=3000)
        new_sql = ai_svc.extract_sql(raw)
    if not ai_svc._parses(new_sql):
        raise ai_svc.AIError("The model did not return a usable query. Try again or pick another model.")
    err = check(new_sql) if check else None
    if err:  # keep the user's original rather than offer a query that does not bind
        return {"sql": sql, "notes": [f"The suggested rewrite did not bind ({err[:120]}), so it was discarded."],
                "changed": False}
    m = _NOTES.search(ai_svc._THINK.sub("", ai_svc._ANSI.sub("", raw)).split("```")[-1] if "```" in raw else raw)
    notes = [ln.lstrip("-*• ").strip() for ln in (m.group(1) if m else "").splitlines() if ln.strip()]
    norm = lambda s: " ".join(s.lower().rstrip(";").split())  # noqa: E731
    return {"sql": new_sql, "notes": notes[:6], "changed": norm(new_sql) != norm(sql)}


def _final_bullets(text: str) -> str:
    """Reasoning models often write their thinking first. Keep only the last block of bullet lines."""
    block: list[str] = []
    for ln in text.splitlines():
        if re.match(r"^\s*[-*•]\s+\S", ln) and not re.match(r"^\s*[-*]\s+\*\*", ln):
            block.append(ln.strip())
        elif ln.strip() and block:
            block = []  # a prose line ends the block; keep scanning for a later one
    return "\n".join(block)


def _arg_text(node: Any) -> str:
    text = node.sql(dialect="duckdb") if node is not None else "?"
    return re.sub(r"CAST\(('[^']*') AS (?:DATE|TIMESTAMP)\)", r"\1", text)   # DATE '2024-01-01' reads better than its CAST form


def _phrase(e: Any) -> str:
    """One selected expression in words: aggregates become 'the total of …', other expressions keep their SQL."""
    from sqlglot import exp
    inner = e.this if isinstance(e, exp.Alias) else e
    if isinstance(inner, exp.Star):
        return "every column"
    if isinstance(inner, exp.Column):
        return inner.sql(dialect="duckdb")
    rounded = isinstance(inner, exp.Round)
    agg = next(inner.find_all(exp.AggFunc), None) if not isinstance(inner, exp.AggFunc) else inner
    if agg is None:
        return inner.sql(dialect="duckdb")
    x = _arg_text(agg.this)
    text = {exp.Sum: f"the total of {x}", exp.Avg: f"the average of {x}", exp.Min: f"the lowest {x}", exp.Max: f"the highest {x}"}.get(type(agg))
    if text is None and isinstance(agg, exp.Count):
        text = "the number of rows" if isinstance(agg.this, exp.Star) else (f"the number of different {_arg_text((agg.this.expressions or [agg.this])[0])}" if isinstance(agg.this, exp.Distinct) else f"the number of non-empty {x}")
    text = text or agg.sql(dialect="duckdb")
    return text + (" (rounded)" if rounded else "")


def _structure_summary(sql: str) -> str:
    """Plain-language explanation built from the parsed query: the fallback when the model only thinks aloud."""
    import sqlglot
    from sqlglot import exp
    try:
        tree = sqlglot.parse_one(sql, read="duckdb")
    except Exception:
        return "- This query could not be parsed, so it cannot be explained automatically."
    top = tree if isinstance(tree, exp.Select) else tree.find(exp.Select)
    if top is None:
        return "- A set of queries combined into one result."
    ctes = {c.alias.lower() for c in tree.find_all(exp.CTE) if c.alias}
    tables = [t.name for t in top.find_all(exp.Table) if t.name and t.name.lower() not in ctes]
    tables = list(dict.fromkeys(tables)) or ["the data"]
    out = []
    shown = [_phrase(e) for e in top.expressions]
    alias = [e.alias for e in top.expressions if isinstance(e, exp.Alias)]
    out.append(f"Returns {', '.join(shown[:5])}{' …' if len(shown) > 5 else ''}" + (f" (as {', '.join(alias[:3])})" if alias else "") + ".")
    joins = [j for j in top.args.get("joins") or []]
    out.append(f"Reads from {tables[0]}" + (f", joined with {', '.join(_arg_text(j.this) for j in joins)}" if joins else "") + ".")
    if top.args.get("group"):
        out.append(f"Produces one row for each {', '.join(_arg_text(g) for g in top.args['group'].expressions)}.")
    if top.args.get("where"):
        out.append(f"Keeps only rows where {_arg_text(top.args['where'].this)}.")
    if top.args.get("having"):
        out.append(f"Then keeps only groups where {_arg_text(top.args['having'].this)}.")
    order = top.args.get("order")
    limit = top.args.get("limit")
    if order or limit:
        by = ", ".join(f"{_arg_text(o.this)} {'from highest to lowest' if o.args.get('desc') else 'from lowest to highest'}" for o in (order.expressions if order else []))
        n = limit.expression.name if limit is not None else None
        out.append((f"Sorted by {by}" if by else "No particular order") + (f"; keeps the first {n} rows." if n else "."))
    if joins and any(True for _ in top.find_all(exp.AggFunc)):
        out.append("Watch out: joins can repeat rows, which inflates totals and counts if the join keys are not unique.")
    if any(isinstance(f, (exp.Sum, exp.Avg)) for f in top.find_all(exp.AggFunc)):
        out.append("Rows where the summed or averaged value is empty (NULL) are ignored.")
    return "\n".join("- " + line for line in out)


def explain_query(sql: str, context: str, provider_id: str | None) -> str:
    """Plain-language explanation of `sql`. Reasoning models often only think aloud: insist once, then fall back to a
    description built from the parsed query (always correct, if plainer)."""
    msgs = _messages(EXPLAIN_RULES, context, f"Query:\n{sql}")
    for attempt in range(2):
        raw = ai_svc.chat(msgs, provider_id=provider_id, max_tokens=2500)
        text = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", raw)).strip()
        if ai_svc._REASONING.search(text) or text.lower().startswith("here's a thinking"):
            text = _final_bullets(text)
        if len(text.splitlines()) >= 2 and not text.startswith("{"):
            return text
        msgs = msgs + [{"role": "assistant", "content": text[:300]}, {"role": "user", "content": "Reply with ONLY 3-6 short bullet points (each line starting with '- '), no preamble, no reasoning."}]
    return _structure_summary(sql)
