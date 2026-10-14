"""Build and edit dashboards from plain language.

The model only proposes widgets as JSON (title, chart type, one SELECT). Everything else is deterministic:
each query is validated read-only, bind-checked (with one repair round), executed, and the chart encoding and
layout are derived from the real result. A widget that cannot be made to work is skipped and reported, never
saved half-built.
"""
from __future__ import annotations

import json
import re
from typing import Any

from ..core.security import validate_readonly
from ..core.store import store
from . import ai as ai_svc, assist as assist_svc
from .ai_context import semantic_context, workbench_context
from .chart_suggest import encode, suggest_chart
from .dash_place import anchor_y, grid_positions, make_room
from .engine import engine

CHART_TYPES = ["kpi", "bar", "line", "area", "pie", "scatter", "table", "pivot", "funnel", "treemap", "radar", "composed", "waterfall", "ranked", "quadrant", "timebreak", "reconcile"]
WIDE = {"line", "area", "table", "pivot", "composed", "timebreak"}
MAX_WIDGETS = 10

_WIDGET_FORMAT = ('{"title": string, "type": one of ' + "|".join(CHART_TYPES) + ', "sql": one read-only DuckDB SELECT, '
                  '"why": one short sentence on the business question it answers}')
_SQL_RULES = (
    "Use ONLY the listed tables and columns. kpi = exactly one row with one numeric column. line/area = first column the "
    "time (or ordered category), then the measures. bar/pie/funnel/treemap = a category column then one measure; pivot = row field, column field, then EVERY measure the user asked for as separate columns (viewers switch between them) "
    "(ORDER BY the measure DESC LIMIT 15). ranked/quadrant = a category, the CURRENT period value, then the PREVIOUS period value (ranked = top N vs previous with growth %; quadrant = Stars/Rising/Watch/Laggards groups). waterfall = a step label then a signed change. timebreak = item, a DATE column (day or month grain, not truncated to year), the measure, then optional text detail columns (category, tier); it shows years that open into months and days. reconcile = a key then 2-3 numeric columns of the SAME quantity from different sources (one row per key, FULL OUTER JOIN / UNION + GROUP BY) to show match rate and differences. Give every column a short alias. Never write anything but SELECT.")

CREATE_SYSTEM = (
    "You are a BI designer inside a DuckDB analytics app. Design a dashboard of 4 to 8 widgets that answers the user's "
    f"request. Reply with ONLY one JSON object, no prose, no markdown: {{\"name\": string, \"widgets\": [{_WIDGET_FORMAT}]}}. "
    "Design like a senior analyst: 2-4 headline KPIs first, then a trend over time when the data has dates, then the main breakdowns "
    "(top categories, shares, comparisons), and a detail table last only if useful. Every widget must answer a different question; "
    "no two widgets with the same query. Follow every explicit requirement in the request (named metrics, chart types, filters, periods). "
    + _SQL_RULES)

EDIT_SYSTEM = (
    "You edit an existing dashboard. You are given its widgets and the user's instruction. Reply with ONLY one JSON "
    'object, no prose: {"message": a short sentence saying what you changed, "ops": [ ... ], "next": up to 3 short follow-up instructions that would improve this dashboard further} where each op is one of '
    f'{{"op":"add","widget":{_WIDGET_FORMAT} plus optional "page": a page id and optional "place"}}, {{"op":"move","id":widget id,"place":...}}, {{"op":"arrange","rows"?:[[widget ids in row 1],[row 2],...],"ids"?:[widget ids, default all KPIs of the page],"columns":1-6}}, {{"op":"resize","id":widget id,"w":1-12,"h":1-12}}, {{"op":"remove","id":widget id}}, {{"op":"note","content":markdown text,"place"?:...}} (a text/notes widget), {{"op":"rename","name":new dashboard name}}, {{"op":"add_page","id":short slug,"name":page name}} (then add widgets with that "page"), '
    '{"op":"update","id":widget id,"title"?:string,"type"?:chart type,"sql"?:string}. '
    "Only include ops the instruction needs; if it needs none, reply with an empty ops list and explain in message. "
    "\"place\" says where on the page: \"bottom\" (default), \"top\", \"after_kpis\" (right below the KPI row), or {\"after\": widget id}; use it whenever the user says where "
    "(\"after the KPIs\", \"at the top\", \"below the trend chart\"), and use the \"move\" op to move a chart that already exists. "
    "Widgets sit on a 12-column grid (size = columns x rows): use \"arrange\" for \"all KPIs in one row of 4 columns\" (it sets each width to 12/columns and lines them up) and "
    "\"rows\" for mixed layouts (\"2x2 charts, then the line chart full width\" = rows [[a,b],[c,d],[line]]; a row of one widget is full width). "
    "arrange keeps heights; only send \"resize\" when the user asks for a size change (\"make it wider / taller\"; full width = w 12). "
    "\"Side by side\" means 2 per row unless the user says otherwise; read the current col/size of every widget before deciding what to change. "
    "If the user says a chart or KPI is missing or not visible, ADD it (do not change a different widget). Use the earlier conversation to "
    "resolve words like 'it' or 'that chart'. New widgets go on the page the user is viewing unless they name another page. "
    + _SQL_RULES)


def json_objects(text: str) -> list[dict[str, Any]]:
    """Every top-level JSON object in a model reply, in order (reasoning text may quote several)."""
    clean = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", text))
    clean = re.sub(r"```(?:json)?", "", clean)
    found, i = [], 0
    while (start := clean.find("{", i)) != -1:
        depth, end = 0, -1
        for j in range(start, len(clean)):
            depth += (clean[j] == "{") - (clean[j] == "}")
            if depth == 0:
                end = j
                break
        if end == -1:
            break
        try:
            obj = json.loads(clean[start:end + 1])
            if isinstance(obj, dict):
                found.append(obj)
            i = end + 1
        except ValueError:
            i = start + 1  # not valid JSON from here: look inside it
    return found


def parse_json(text: str) -> dict[str, Any]:
    """The plan in a model reply: the last object that holds widgets or ops; loose widget objects are gathered."""
    objs = json_objects(text)
    for obj in reversed(objs):
        if widgets_of(obj) or isinstance(obj.get("ops"), list):
            return obj
    loose = [o for o in objs if "sql" in o]
    if len(loose) > 1:
        return {"widgets": loose}
    if objs:
        return objs[-1]
    clean = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", text))
    snippet = " ".join(clean.split())[:160]
    raise ai_svc.AIError("The model did not return a usable dashboard plan. Try again or pick a non-reasoning model in Settings."
                         + (f" It replied: “{snippet}…”" if snippet else " (empty reply)"))


def widgets_of(plan: Any) -> list[dict[str, Any]]:
    """The widget list of a model plan, tolerating other key names (charts, panels, ...) and a bare list."""
    if isinstance(plan, list):
        return [w for w in plan if isinstance(w, dict)]
    for key in ("widgets", "charts", "panels", "visualizations", "items"):
        if isinstance(plan.get(key), list):
            return [w for w in plan[key] if isinstance(w, dict)]
    for value in plan.values():  # any list of objects that carry SQL
        if isinstance(value, list) and value and all(isinstance(w, dict) and "sql" in w for w in value):
            return value
    return []


def _ask(system: str, user: str, provider_id: str | None) -> dict[str, Any]:
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    try:
        return parse_json(ai_svc.chat(messages, provider_id=provider_id, max_tokens=6000))
    except ai_svc.AIError as e:
        if "usable dashboard plan" not in str(e):
            raise
    # reasoning models often burn the first answer on thinking: insist once
    messages += [{"role": "user", "content": "Reply with ONLY the JSON object, nothing else."}]
    return parse_json(ai_svc.chat(messages, provider_id=provider_id, max_tokens=6000))


def _tidy(rows: list) -> list:
    """Rows with floats rounded to 2 decimals (what the insights/suggestions models are shown)."""
    return [{k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()} if isinstance(r, dict) else r for r in rows]


def _materialize(spec: dict[str, Any], context: str, provider_id: str | None, review: bool = True) -> dict[str, Any]:
    """Validated, executed and self-reviewed widget: {title, sql, chart: {type, encoding, options}, notes}. Raises ValueError with the reason."""
    title = str(spec.get("title") or "Untitled").strip()[:80]
    sql = str(spec.get("sql") or "").strip()
    if not sql:
        raise ValueError("no SQL")
    from .dash_repair import run_with_repairs   # lazy: it imports the engine and assist helpers
    sql, result, fixes = run_with_repairs(spec, sql, context, provider_id)   # raises ValueError after its automatic fixes failed
    rows, cols = list(result["rows"]), result["columns"]
    if not cols:
        raise ValueError("query returned no columns")
    suggested = suggest_chart(cols, rows)
    ctype = str(spec.get("type") or "").lower()
    ctype = ctype if ctype in CHART_TYPES else suggested["type"]
    chart = {"type": ctype, "encoding": encode(ctype, cols, rows), "options": suggested["options"] if ctype == suggested["type"] else {}}
    if ctype == "kpi":
        chart["options"] = {"numberFormat": "compact"}
    out = {"title": title, "sql": result["sql"], "chart": chart, "columns": cols, "preview": _tidy(rows[:6]), "all_rows": _tidy(rows[:400]), "ms": result.get("duration_ms"), "fixed": fixes}
    if not review:
        return out
    from .dash_critic import polish   # lazy: it calls back into this module
    return polish({**spec, "title": title}, out, context, provider_id)


def _store_widget(dash_id: str, widget: dict[str, Any], position: dict[str, int], dataset_id: str | None, page: str = "main") -> dict[str, Any]:
    q = store.insert("queries", {"dataset_id": dataset_id, "name": widget["title"], "sql": widget["sql"], "status": "ok"})
    ch = store.insert("charts", {"query_id": q["id"], "dataset_id": dataset_id, "name": widget["title"], "spec": widget["chart"]})
    row = store.insert("dashboard_widgets", {"dashboard_id": dash_id, "chart_id": ch["id"], "position": position, "page": page})
    return {"id": row["id"], "title": widget["title"], "type": widget["chart"]["type"]}


def _table_height(w: dict[str, Any]) -> int:
    """Grid rows (80 px each) a table needs: toolbar + header + its rows, capped so a long table scrolls instead of filling the page."""
    rows = len(w.get("all_rows") or [])
    return 3 if rows <= 4 else 4 if rows <= 8 else 5 if rows <= 14 else 6


def _layout(widgets: list[dict[str, Any]], start_y: int = 0) -> list[dict[str, int]]:
    """KPIs share a row, wide charts take a full row, the rest pair up two per row."""
    kpis = [i for i, w in enumerate(widgets) if w["chart"]["type"] == "kpi"]
    pos: dict[int, dict[str, int]] = {}
    y = start_y
    for chunk in [kpis[i:i + 4] for i in range(0, len(kpis), 4)]:
        for n, i in enumerate(chunk):
            width = 12 // len(chunk)
            pos[i] = {"x": n * width, "y": y, "w": width, "h": 2}
        y += 2
    half = 0
    for i, w in enumerate(widgets):
        if i in pos:
            continue
        if w["chart"]["type"] in WIDE:
            if half:
                y, half = y + 4, 0
            h = 7 if w["chart"]["type"] == "timebreak" else _table_height(w) if w["chart"]["type"] in ("table", "pivot") else 5 if w["chart"]["type"] in ("ranked", "quadrant") else 4
            pos[i] = {"x": 0, "y": y, "w": 12, "h": h}
            y += h
        else:
            pos[i] = {"x": 6 * half, "y": y, "w": 6, "h": 4}
            half += 1
            if half == 2:
                y, half = y + 4, 0
    return [pos[i] for i in range(len(widgets))]


def create_dashboard(prompt: str, dataset_id: str | None, provider_id: str | None) -> dict[str, Any]:
    """Non-streaming create (API use and tests): runs every phase of dash_create.create_stream."""
    from .dash_create import create_stream
    return _last(create_stream(prompt, dataset_id, provider_id))


def _describe(dash_id: str) -> tuple[str, dict[str, dict]]:
    """Widget list for the edit prompt, plus id → {widget row, chart, sql}."""
    lines, index = [], {}
    for w in store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash_id], order=None):
        ch = store.get("charts", w["chart_id"]) if w.get("chart_id") else None
        q = store.get("queries", ch["query_id"]) if ch and ch.get("query_id") else None
        if not ch:
            continue
        index[w["id"]] = {"widget": w, "chart": ch, "sql": (q or {}).get("sql", "")}
        lines.append(f'- id={w["id"]} page={w.get("page") or "main"} row={(w.get("position") or {}).get("y", 0)} col={(w.get("position") or {}).get("x", 0)} size={(w.get("position") or {}).get("w", 6)}x{(w.get("position") or {}).get("h", 4)} type={ch["spec"]["type"]} title="{ch["name"]}" sql: {(q or {}).get("sql", "")[:300]}')
    return "\n".join(lines) or "(no widgets yet)", index


def edit_dashboard(dash_id: str, instruction: str, provider_id: str | None, history: list[dict] | None = None, page: str | None = None) -> dict[str, Any]:
    """Non-streaming edit (API use and tests): runs every phase of dash_edit.edit_stream."""
    from .dash_edit import edit_stream
    return _last(edit_stream(dash_id, instruction, provider_id, history, page))


def _last(events) -> dict[str, Any]:
    done = {}
    for ev in events:
        if ev["type"] == "done":
            done = ev
    return {k: v for k, v in done.items() if k != "type"}
