"""AI for the visual query builder: plain words -> builder steps (JSON spec), formula help for custom columns.

The model never writes SQL here. It proposes the SAME JSON the UI builds; deterministic code then cleans it, compiles it with
`qb.compile_spec` (so every identifier is quoted and the read-only guard still applies), runs it on a few rows, and — if that
fails — shows the model the exact error once or twice so it can repair its own spec.
"""
from __future__ import annotations

import json
import re
from typing import Any

from ..core.store import store
from . import ai as ai_svc
from .dash_ai import json_objects
from .engine import engine
from .qb import compile_spec
from .qb_explain import describe_spec
from .qb_rules import hints, quick_spec, refine_spec

MAX_REPAIRS = 2
STAGE_KEYS = {"table", "joins", "custom", "filters", "filter_mode", "aggregations", "breakouts", "having", "windows", "columns", "distinct", "sort", "limit"}

SPEC_HELP = """A query is {"stages":[stage, ...]}. Each later stage reads the previous stage's output columns (use it to filter/rank a summary).
stage keys (all optional except `table` in stage 1):
 table: "<table name>"                          (stage 1 only)
 joins: [{"table":"<name>","type":"left|inner|right|full|cross","on":[{"left":{"t":"t0","c":"col"},"right":{"t":"t1","c":"col"}}]}]   # source table is t0, joins are t1, t2 ... in order
 custom: [{"name":"Profit %","expr":"profit / revenue * 100"}]       # new columns; any DuckDB expression; usable below by name
 filters: [{"col":REF,"op":OP,"value":V,"value2":V2}], filter_mode: "and"|"or"
   OP: = != > >= < <= between in not_in contains not_contains starts_with ends_with is_null not_null is_empty not_empty regex last_n_days next_n_days today this_week this_month this_quarter this_year expr
 aggregations: [{"fn":FN,"col":REF,"as":"Name","where":[filters]}]    # FN: count count_distinct count_col sum avg min max median stddev variance p25 p75 p90 p95 p99 mode first last list range null_count null_pct expr(+"expr")
 breakouts: [{"col":REF,"bucket":B,"as":"Name"}]                     # B: none year quarter month week day hour day_of_week month_of_year hour_of_day year_month text_length bin:10
 having: [filters on aggregate names]   windows: [{"fn":W,"col":REF,"partition":[REF],"order":REF,"order_dir":"asc|desc","n":3,"as":"Name"}]
   W: running_sum running_avg running_count moving_avg moving_sum rank dense_rank row_number ntile pct_rank lag lead diff_prev pct_change pct_of_total z_score first_value last_value
 columns: [REF]  (only these, in order)  distinct: true   sort: [{"col":REF,"dir":"asc|desc"}]   limit: 1000
REF is a column name ("revenue"), an output name of an aggregate/custom column, or {"t":"t1","c":"col"} when joined tables share names."""

SYSTEM = (
    "You turn a business user's request into a query-builder spec for a DuckDB analytics app. Reply with ONLY one JSON object: "
    '{"spec": {...}, "explanation": "one short sentence", "title": "short name"}. No markdown, no extra text, and do not write out your reasoning: answer with the JSON immediately.\n'
    "Rules: use ONLY the tables and columns listed (exact spelling). Prefer the simplest spec that answers the request. Summaries need "
    "aggregations and/or breakouts; for 'top N' sort the metric descending and set limit N; for trends bucket the date column "
    "(month by default) and sort it ascending; for shares use the pct_of_total window. Always set a sensible limit (<= 1000 unless a summary). "
    "If a CURRENT SPEC is given, change it according to the request and return the COMPLETE updated spec (keep what was not mentioned).\n\n" + SPEC_HELP)

FORMULA_SYSTEM = (
    "You write ONE DuckDB SQL scalar expression for a computed column. Reply with ONLY a JSON object: "
    '{"expr": "...", "explanation": "one short sentence"}. Use only the listed columns (quote names with spaces or symbols like "Profit %"). '
    "No subqueries, no aggregate functions (SUM/AVG...), no semicolons. Guard divisions with NULLIF(x, 0).")


def schema_text(current: dict | None, prompt: str) -> str:
    """Compact table list for the prompt: the tables in play plus the best keyword matches, with join hints."""
    from .ai_context import relevance
    datasets = [d for d in store.list("datasets", order=None) if d.get("physical_name")]
    cols: dict[str, list[dict]] = {}
    for c in store.list("columns_meta", order=None):
        cols.setdefault(c["dataset_id"], []).append(c)
    used = set()
    for st in (current or {}).get("stages", [])[:1]:
        used |= {st.get("table"), *[j.get("table") for j in st.get("joins") or []]}
    ranked = sorted(datasets, key=lambda d: (d["name"] in used, relevance(prompt, d, [c["name"] for c in cols.get(d["id"], [])])), reverse=True)[:8]
    lines = []
    for d in ranked:
        cs = ", ".join(f"{c['name']} {str(c.get('dtype') or '').upper()}" for c in cols.get(d["id"], [])[:60])
        lines.append(f"- {d['name']} ({d.get('row_count') or '?'} rows): {cs}")
    names = {d["id"]: d["name"] for d in datasets}
    for r in store.list("relationships", order=None)[:20]:
        if r["left_dataset_id"] in names and r["right_dataset_id"] in names:
            lines.append(f"join hint: {names[r['left_dataset_id']]}.{r['left_column']} = {names[r['right_dataset_id']]}.{r['right_column']}")
    return "TABLES:\n" + "\n".join(lines)


def _ref(r: Any, tables: list[str]) -> Any:
    """'orders.amount' / 't1.amount' -> {"t": "t1", "c": "amount"}; anything else is kept."""
    if isinstance(r, str) and "." in r:
        head, col = r.split(".", 1)
        if re.fullmatch(r"t\d+", head):
            return {"t": head, "c": col}
        for i, t in enumerate(tables):
            if t and t.lower() == head.lower():
                return {"t": f"t{i}", "c": col}
    return r


def _walk_refs(o: Any, tables: list[str]) -> Any:
    if isinstance(o, dict):
        return {k: (_ref(v, tables) if k in ("col", "left", "right", "order") else [_ref(x, tables) for x in v] if k in ("columns", "partition") and isinstance(v, list) else _walk_refs(v, tables)) for k, v in o.items()}
    if isinstance(o, list):
        return [_walk_refs(x, tables) for x in o]
    return o


def clean_spec(raw: Any) -> dict:
    """Accept what models actually return (a spec, a single stage, extra keys, 'orders.col' refs) and give back a strict spec."""
    if isinstance(raw, dict) and isinstance(raw.get("spec"), dict):
        raw = raw["spec"]
    if isinstance(raw, dict) and "stages" not in raw:
        raw = {"stages": [raw]}
    if not isinstance(raw, dict) or not isinstance(raw.get("stages"), list) or not raw["stages"]:
        raise ValueError("the reply has no 'stages'")
    stages = []
    known = {d["name"].lower(): d["name"] for d in store.list("datasets", order=None) if d.get("physical_name")}
    for i, st in enumerate(raw["stages"]):
        if not isinstance(st, dict):
            raise ValueError("a stage must be an object")
        st = {k: v for k, v in st.items() if k in STAGE_KEYS and v not in (None, [], "")}
        if i == 0:
            t = str(st.get("table") or "")
            if t.lower() not in known:
                raise ValueError(f"table '{t}' does not exist. Tables: {', '.join(known.values())}")
            st["table"] = known[t.lower()]
            for j in st.get("joins") or []:
                if str(j.get("table", "")).lower() not in known:
                    raise ValueError(f"join table '{j.get('table')}' does not exist. Tables: {', '.join(known.values())}")
                j["table"] = known[str(j["table"]).lower()]
        else:
            st.pop("table", None)
            st.pop("joins", None)
        stages.append(st)
    tables = [stages[0]["table"], *[j["table"] for j in stages[0].get("joins") or []]]
    stages = _walk_refs(stages, tables)
    for st in stages:
        try:
            st["limit"] = max(1, min(int(st["limit"]), 100000)) if "limit" in st else st.get("limit")
        except (TypeError, ValueError):
            st.pop("limit", None)
        if st.get("limit") is None:
            st.pop("limit", None)
    if "limit" not in stages[-1] and not (stages[-1].get("aggregations") or stages[-1].get("breakouts")):
        stages[-1]["limit"] = 1000
    return {"stages": stages}


def _parse(text: str, key: str) -> dict:
    objs = [o for o in json_objects(text) if key in o or "stages" in o]
    if not objs:
        raise ValueError("the reply was not the JSON object that was asked for")
    return objs[-1]


def _check(spec: dict) -> dict:
    """Compile and bind-check (LIMIT 0: catches bad columns / types without scanning big tables); the message goes back to the model."""
    sql = compile_spec(spec)
    try:
        engine.execute(f"SELECT * FROM ({sql}) AS qb_check LIMIT 0", 1)
    except Exception as e:  # noqa: BLE001
        raise ValueError(str(e)[:400]) from e
    return {"sql": sql}


def build_spec(prompt: str, current: dict | None, provider_id: str | None) -> dict[str, Any]:
    fresh = not (current and (current.get("stages") or [{}])[0].get("table"))
    if fresh:                                  # simple requests are answered instantly and exactly, without a model call
        quick = quick_spec(prompt)
        if quick:
            try:
                compile_spec(quick)                # columns come from the schema, so no database round-trip is needed to trust it
                return {"spec": quick, "title": prompt.strip()[:60].capitalize(), "explanation": "Built instantly from your wording (no AI call needed).",
                        "steps": describe_spec(quick), "attempts": 0, "source": "rules"}
            except ValueError:
                pass
    if not fresh:                              # simple edits of an open query (filter, add count, sort, limit) are exact and instant too
        edited = refine_spec(prompt, current)
        if edited and edited != current:
            try:
                compile_spec(edited)
                return {"spec": edited, "title": prompt.strip()[:60].capitalize(), "explanation": "Changed instantly from your wording (no AI call needed).",
                        "steps": describe_spec(edited), "attempts": 0, "source": "rules"}
            except ValueError:
                pass
    ctx = schema_text(current, prompt)
    user = f"{ctx}\n\n" + (f"CURRENT SPEC:\n{json.dumps(current)}\n\n" if current and (current.get("stages") or [{}])[0].get("table") else "") + f"REQUEST: {prompt}"
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    last_error = ""
    for attempt in range(MAX_REPAIRS + 1):
        reply = ai_svc.chat(messages, provider_id=provider_id, max_tokens=3000)
        try:
            obj = _parse(reply, "spec")
            spec = hints(prompt, clean_spec(obj))
            if not fresh and spec == clean_spec(current):
                raise ValueError('you returned the CURRENT SPEC unchanged. Apply the request to it')
            _check(spec)
            return {"spec": spec, "title": str(obj.get("title") or "")[:80], "explanation": str(obj.get("explanation") or ""),
                    "steps": describe_spec(spec), "attempts": attempt + 1, "source": "ai"}
        except ValueError as e:
            last_error = str(e)
            messages += [{"role": "assistant", "content": reply[:3000]},
                         {"role": "user", "content": f"That spec failed: {last_error}\nReturn the corrected JSON object only."}]
    raise ValueError(f"The AI could not build a valid query ({last_error}). Try rephrasing, or name the table and columns.")


_EXPR_HINT = re.compile(r"[Ee]xpr(?:ession)?(?: is| would be)?\s*[:=]\s*`([^`\n]+)`")


def formula(prompt: str, table: str | None, columns: list[dict], expr: str, error: str, provider_id: str | None) -> dict[str, Any]:
    cols = ", ".join(f"{c.get('name')} ({c.get('kind', '')})" for c in columns[:80])
    user = f"TABLE: {table or '?'}\nCOLUMNS: {cols}\n" + (f"CURRENT FORMULA: {expr}\n" if expr else "") + (f"IT FAILED WITH: {error}\n" if error else "") + f"REQUEST: {prompt or 'fix the formula'}"
    messages = [{"role": "system", "content": FORMULA_SYSTEM}, {"role": "user", "content": user}]
    for _ in range(MAX_REPAIRS + 1):
        reply = ai_svc.chat(messages, provider_id=provider_id, max_tokens=2500)
        try:
            try:
                obj = _parse(reply, "expr")
            except ValueError:                 # reasoning models sometimes run out of tokens right after settling on the answer
                found = _EXPR_HINT.findall(reply)
                if not found:
                    raise
                obj = {"expr": found[-1], "explanation": "Written from the model's notes."}
            e = str(obj.get("expr") or "").strip().rstrip(";")
            if not e:
                raise ValueError("empty expression")
            if table:
                _check({"stages": [{"table": table, "custom": [{"name": "__f", "expr": e}], "columns": ["__f"], "limit": 3}]})
            return {"expr": e, "explanation": str(obj.get("explanation") or "")}
        except ValueError as err:
            messages += [{"role": "assistant", "content": reply[:1000]}, {"role": "user", "content": f"That expression failed: {err}\nReturn the corrected JSON only."}]
    raise ValueError("The AI could not write a working formula. Try describing it differently.")
