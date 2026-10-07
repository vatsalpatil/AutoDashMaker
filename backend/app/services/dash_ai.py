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
from .engine import engine

CHART_TYPES = ["kpi", "bar", "line", "area", "pie", "scatter", "table", "pivot", "funnel", "treemap", "radar", "composed"]
WIDE = {"line", "area", "table", "pivot", "composed"}
MAX_WIDGETS = 10

_WIDGET_FORMAT = ('{"title": string, "type": one of ' + "|".join(CHART_TYPES) + ', "sql": one read-only DuckDB SELECT}')
_SQL_RULES = (
    "Use ONLY the listed tables and columns. kpi = exactly one row with one numeric column. line/area = first column the "
    "time (or ordered category), then the measures. bar/pie/funnel/treemap = a category column then one measure "
    "(ORDER BY the measure DESC LIMIT 15). Give every column a short alias. Never write anything but SELECT.")

CREATE_SYSTEM = (
    "You are a BI designer inside a DuckDB analytics app. Design a dashboard of 4 to 8 widgets that answers the user's "
    f"request. Reply with ONLY one JSON object, no prose, no markdown: {{\"name\": string, \"widgets\": [{_WIDGET_FORMAT}]}}. "
    "Put KPI widgets first when sensible. " + _SQL_RULES)

EDIT_SYSTEM = (
    "You edit an existing dashboard. You are given its widgets and the user's instruction. Reply with ONLY one JSON "
    'object, no prose: {"message": a short sentence saying what you changed, "ops": [ ... ]} where each op is one of '
    f'{{"op":"add","widget":{_WIDGET_FORMAT}}}, {{"op":"remove","id":widget id}}, '
    '{"op":"update","id":widget id,"title"?:string,"type"?:chart type,"sql"?:string}. '
    "Only include ops the instruction needs; if it needs none, reply with an empty ops list and explain in message. "
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


def _materialize(spec: dict[str, Any], context: str, provider_id: str | None) -> dict[str, Any]:
    """Validated, executed widget: {title, sql, chart: {type, encoding, options}}. Raises ValueError with the reason."""
    title = str(spec.get("title") or "Untitled").strip()[:80]
    sql = str(spec.get("sql") or "").strip()
    if not sql:
        raise ValueError("no SQL")
    try:
        sql = validate_readonly(sql, 10000)
        err = engine.check_sql(sql)
        if err:  # one repair round with the database's own message
            sql = validate_readonly(assist_svc.fix_sql(sql, err, context, provider_id, engine.check_sql), 10000)
        result = engine.execute(sql, 2000)
    except Exception as e:
        raise ValueError(str(e)[:160]) from e
    rows, cols = list(result["rows"]), result["columns"]
    if not cols:
        raise ValueError("query returned no columns")
    suggested = suggest_chart(cols, rows)
    ctype = str(spec.get("type") or "").lower()
    ctype = ctype if ctype in CHART_TYPES else suggested["type"]
    chart = {"type": ctype, "encoding": encode(ctype, cols, rows), "options": suggested["options"] if ctype == suggested["type"] else {}}
    if ctype == "kpi":
        chart["options"] = {"numberFormat": "compact"}
    return {"title": title, "sql": result["sql"], "chart": chart}


def _store_widget(dash_id: str, widget: dict[str, Any], position: dict[str, int], dataset_id: str | None) -> dict[str, Any]:
    q = store.insert("queries", {"dataset_id": dataset_id, "name": widget["title"], "sql": widget["sql"], "status": "ok"})
    ch = store.insert("charts", {"query_id": q["id"], "dataset_id": dataset_id, "name": widget["title"], "spec": widget["chart"]})
    row = store.insert("dashboard_widgets", {"dashboard_id": dash_id, "chart_id": ch["id"], "position": position, "page": "main"})
    return {"id": row["id"], "title": widget["title"], "type": widget["chart"]["type"]}


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
            pos[i] = {"x": 0, "y": y, "w": 12, "h": 4}
            y += 4
        else:
            pos[i] = {"x": 6 * half, "y": y, "w": 6, "h": 4}
            half += 1
            if half == 2:
                y, half = y + 4, 0
    return [pos[i] for i in range(len(widgets))]


def create_dashboard(prompt: str, dataset_id: str | None, provider_id: str | None) -> dict[str, Any]:
    context = f"{workbench_context(dataset_id, prompt)}\n\n{semantic_context(dataset_id)}"
    plan = _ask(CREATE_SYSTEM, f"{context}\n\nDashboard request: {prompt}", provider_id)
    specs = widgets_of(plan)[:MAX_WIDGETS]
    if not specs:
        raise ai_svc.AIError(f"The model's plan had no widgets (it replied with: {', '.join(list(plan)[:6]) or 'nothing'}). Try again or pick another model.")
    built, skipped = [], []
    for spec in specs:
        try:
            built.append(_materialize(spec, context, provider_id))
        except ValueError as e:
            skipped.append({"title": str(spec.get("title", "?")), "reason": str(e)})
    if not built:
        raise ai_svc.AIError("None of the proposed widgets could be built: " + "; ".join(s["reason"] for s in skipped)[:300])
    name = str(plan.get("name") or prompt)[:80]
    dash = store.insert("dashboards", {"name": name, "description": f"Built by AI from: {prompt[:200]}"})
    widgets = [_store_widget(dash["id"], w, p, dataset_id) for w, p in zip(built, _layout(built))]
    return {"dashboard_id": dash["id"], "name": name, "widgets": widgets, "skipped": skipped}


def _describe(dash_id: str) -> tuple[str, dict[str, dict]]:
    """Widget list for the edit prompt, plus id → {widget row, chart, sql}."""
    lines, index = [], {}
    for w in store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash_id], order=None):
        ch = store.get("charts", w["chart_id"]) if w.get("chart_id") else None
        q = store.get("queries", ch["query_id"]) if ch and ch.get("query_id") else None
        if not ch:
            continue
        index[w["id"]] = {"widget": w, "chart": ch, "sql": (q or {}).get("sql", "")}
        lines.append(f'- id={w["id"]} type={ch["spec"]["type"]} title="{ch["name"]}" sql: {(q or {}).get("sql", "")[:300]}')
    return "\n".join(lines) or "(no widgets yet)", index


def edit_dashboard(dash_id: str, instruction: str, provider_id: str | None) -> dict[str, Any]:
    dash = store.get("dashboards", dash_id)
    if not dash:
        raise LookupError("dashboard not found")
    listing, index = _describe(dash_id)
    context = f"{workbench_context(None, instruction)}\n\n{semantic_context(None)}"
    plan = _ask(EDIT_SYSTEM, f"{context}\n\nDashboard \"{dash['name']}\" widgets:\n{listing}\n\nInstruction: {instruction}", provider_id)
    applied, skipped = [], []
    bottom = max([(w["widget"].get("position") or {}).get("y", 0) + (w["widget"].get("position") or {}).get("h", 0) for w in index.values()] or [0])
    for op in [o for o in plan.get("ops", []) if isinstance(o, dict)][:MAX_WIDGETS]:
        kind, wid = op.get("op"), str(op.get("id", ""))
        try:
            if kind == "remove" and wid in index:
                store.delete("dashboard_widgets", wid)
                applied.append(f'removed "{index[wid]["chart"]["name"]}"')
            elif kind == "add" and isinstance(op.get("widget"), dict):
                w = _materialize(op["widget"], context, provider_id)
                pos = _layout([w], bottom)[0]
                _store_widget(dash_id, w, pos, None)
                bottom += pos["h"]
                applied.append(f'added "{w["title"]}"')
            elif kind == "update" and wid in index:
                cur = index[wid]
                spec = {"title": op.get("title") or cur["chart"]["name"], "type": op.get("type") or cur["chart"]["spec"]["type"],
                        "sql": op.get("sql") or cur["sql"]}
                w = _materialize(spec, context, provider_id)
                # a new chart (not an in-place edit): the old one may be shared with other dashboards
                new = _store_widget(dash_id, w, cur["widget"].get("position") or {"x": 0, "y": bottom, "w": 6, "h": 4}, None)
                store.delete("dashboard_widgets", wid)
                applied.append(f'updated "{w["title"]}" ({new["type"]})')
            else:
                skipped.append({"title": kind or "?", "reason": "unknown widget or operation"})
        except ValueError as e:
            skipped.append({"title": str(op.get("title") or op.get("widget", {}).get("title") or wid or kind), "reason": str(e)})
    return {"message": str(plan.get("message") or ("Done." if applied else "Nothing to change.")), "applied": applied, "skipped": skipped}
