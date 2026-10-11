"""Phase 3 of AI dashboard generation: build, check and save the planned dashboard (and the non-interactive shortcut).

build() validates and runs every planned query (dash_ai._materialize: read-only validation, bind check, one repair round,
execution), lays the widgets out per page, writes grounded insights from the real results, suggests improvements and saves.
A widget that cannot be made to work is skipped and reported, never saved half-built. generate() runs all three phases
without pausing for the user (API use and tests).
"""
from __future__ import annotations

from typing import Any, Iterator

from ..core.store import store
from . import ai as ai_svc
from .dash_ai import _layout, _materialize, _store_widget
from .dash_plan import ask_json, clean_title, plan as plan_phase, understand
from .dash_profile import profile


def _summary(w: dict[str, Any]) -> str:
    """What the insights model is told about one widget: every row when short, else count / first / last / min / max."""
    rows, cols = w["all_rows"], w["columns"]
    head = f"{w['title']} ({w['chart']['type']}; columns {', '.join(cols)}; {len(rows)} rows)"
    if len(rows) <= 12:
        return f"{head}: {rows}"
    nums = [c for c in cols if isinstance(rows[0].get(c), (int, float)) and not isinstance(rows[0].get(c), bool)]
    spread = ""
    if nums:
        vals = [r[nums[-1]] for r in rows if isinstance(r.get(nums[-1]), (int, float))]
        spread = f"; {nums[-1]} min {min(vals)}, max {max(vals)}"
    return f"{head}: first {rows[:3]}, last {rows[-3:]}{spread}"


def _context(prof: dict[str, Any]) -> str:
    """Dataset header + every time range, so claims about periods can only come from real dates."""
    return "\n".join(l for l in prof["text"].splitlines() if l.startswith("Table") or "[time]" in l)[:800]


def _insights(name: str, built: list[dict[str, Any]], prof: dict[str, Any], provider_id: str | None) -> str | None:
    """Grounded insights: the model sees the real results and may only state what they show."""
    facts = "\n".join(_summary(w) for w in built if w["chart"]["type"] != "scatter")[:10000]
    messages = [
        {"role": "system", "content": "You are a data analyst. Write 5 to 7 short markdown bullets of insights from the dashboard results below. "
         "Every bullet must quote concrete numbers that appear in the results; never invent figures, periods or causes. Use the dataset "
         "context for the time span and do not treat a partial latest period as a real drop. Format numbers for people (thousands separators, "
         "at most 2 decimals, currency or % where obvious). Lead each bullet with a bold label (e.g. **Top region:**). Finish with one "
         "bullet starting **Look next:** suggesting a follow-up question the data can answer. Reply with the bullets only."},
        {"role": "user", "content": f"Dataset context:\n{_context(prof)}\n\nDashboard: {name}\n\n{facts}"},
    ]
    try:
        text = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", ai_svc.chat(messages, provider_id=provider_id, max_tokens=1500))).strip()
    except Exception:
        return None  # insights are a bonus: the dashboard is still complete without them
    return text or None


def _suggestions(name: str, built: list[dict[str, Any]], insights: str | None, prof: dict[str, Any], provider_id: str | None) -> list[str]:
    """Improvements the user can accept with one click (each is an instruction for the dashboard chat)."""
    system = ('You review a freshly built dashboard. Suggest 3 to 5 concrete improvements as short instructions the user could give, '
              'e.g. "Add profit margin by region". Each must be doable by adding, changing or removing ONE chart, KPI or table using ONLY the '
              'columns listed (no filters, drill-downs, targets or data that is not there). Do not repeat widgets that already exist. '
              'Reply with ONLY JSON: {"suggestions": [strings]}.')
    columns = ", ".join(f"{c['name']} ({c['role']})" for c in prof["columns"])
    user = f"Dashboard: {name}\nColumns: {columns}\nExisting widgets: {', '.join(w['title'] for w in built)}\nInsights:\n{insights or '(none)'}"
    try:
        raw = ask_json(system, user, provider_id, "suggestions").get("suggestions")
    except Exception:
        return []
    return [str(s)[:140] for s in raw if s][:5] if isinstance(raw, list) else []


def build(dataset_id: str, name: str, pages: list[dict[str, str]], widgets: list[dict[str, Any]], provider_id: str | None) -> Iterator[dict[str, Any]]:
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise LookupError("dataset not found")
    if not widgets:
        raise ai_svc.AIError("Nothing to build: no widgets were selected.")
    page_name = {p["id"]: p["name"] for p in pages}
    prof = profile(ds)
    yield {"type": "step", "n": 4, "title": "Building and checking each widget",
           "detail": "Every query is validated read-only, bound against the real schema, repaired once if needed, and executed."}
    built, skipped = [], []
    for spec in widgets:
        title = clean_title(spec.get("title"))
        try:
            w = _materialize(spec, prof["text"], provider_id)
        except ValueError as e:
            skipped.append({"title": title, "reason": str(e)})
            yield {"type": "widget", "title": title, "status": "skipped", "detail": str(e)}
            continue
        page = spec.get("page") if spec.get("page") in page_name else next(iter(page_name))
        w["title"], w["page"] = title, page
        built.append(w)
        yield {"type": "widget", "title": title, "status": "ok", "page": page_name[page], "chart": w["chart"]["type"], "ms": w.get("ms"),
               "why": str(spec.get("why") or ""), "formula": str(spec.get("formula") or ""), "sql": w["sql"]}
    if not built:
        raise ai_svc.AIError("None of the planned widgets could be built: " + "; ".join(s["reason"] for s in skipped)[:300])
    yield {"type": "step", "n": 4, "title": "Building and checking each widget", "done": True,
           "detail": f"{len(built)} widgets built" + (f", {len(skipped)} skipped." if skipped else ".")}

    dash_name = clean_title(name)
    yield {"type": "step", "n": 5, "title": "Writing insights", "detail": "The AI reads the real results and may only quote numbers that appear in them."}
    insights = _insights(dash_name, built, prof, provider_id)
    suggestions = _suggestions(dash_name, built, insights, prof, provider_id)
    yield {"type": "step", "n": 5, "title": "Writing insights", "done": True,
           "detail": "Insights page added." if insights else "Skipped (the model did not return insights)."}

    used = [p for p in pages if any(w["page"] == p["id"] for w in built)]
    if insights:
        used.append({"id": "insights", "name": "Insights"})
    dash = store.insert("dashboards", {"name": dash_name, "pages": used, "description": f"AI-generated from {ds['name']}."})
    out = []
    for p in used:
        group = [w for w in built if w["page"] == p["id"]]
        for w, pos in zip(group, _layout(group)):
            _store_widget(dash["id"], w, pos, dataset_id, p["id"])
            out.append({"title": w["title"], "type": w["chart"]["type"], "page": p["name"]})
    if insights:
        store.insert("dashboard_widgets", {"dashboard_id": dash["id"], "kind": "text", "title": "Key Insights", "page": "insights",
                                           "position": {"x": 0, "y": 0, "w": 12, "h": 6}, "settings": {"content": insights}})
        out.append({"title": "Key Insights", "type": "text", "page": "Insights"})
    yield {"type": "step", "n": 6, "title": "Saving the dashboard", "done": True, "detail": f"“{dash_name}” saved with {len(used)} pages."}
    yield {"type": "done", "dashboard_id": dash["id"], "name": dash_name, "pages": [p["name"] for p in used], "widgets": out,
           "skipped": skipped, "suggestions": suggestions}


def generate(dataset_id: str, template: str, focus: str, provider_id: str | None, name: str | None = None) -> dict[str, Any]:
    """All three phases without stopping to ask the user (the questions are skipped)."""
    understanding = ""
    for ev in understand(dataset_id, template, focus, provider_id):
        if ev["type"] == "understanding":
            understanding = ev["understanding"]
    planned: dict[str, Any] = {}
    for ev in plan_phase(dataset_id, template, focus, understanding, {}, "", [], provider_id, name):
        if ev["type"] == "plan":
            planned = ev
    final: dict[str, Any] = {}
    for ev in build(dataset_id, planned["name"], planned["pages"], planned["widgets"], provider_id):
        if ev["type"] == "done":
            final = ev
    return final
