"""Phase 3 of AI dashboard generation: build, check and save the planned dashboard (and the non-interactive shortcut).

build() validates and runs every planned query (dash_ai._materialize: read-only validation, bind check, one repair round,
execution), lays the widgets out per page, writes grounded insights from the real results, suggests improvements and saves.
A widget that cannot be made to work is skipped and reported, never saved half-built. generate() runs all three phases
without pausing for the user (API use and tests).
"""
from __future__ import annotations

import contextvars
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Iterator

from ..core.store import store
from . import ai as ai_svc, ai_stream
from .dash_ai import _layout, _materialize, _store_widget
from .dash_critic import has_time, review_dashboard
from .dash_pages import MAX_PARALLEL
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


INSIGHT_SYSTEM = (
    "You are a data analyst. From the dashboard results below, pick the 5 to 8 most useful insights. Reply with ONLY JSON, no prose: "
    '{"insights": [{"label": 2-4 word title, "value": the headline number formatted for people (e.g. "$25.5M", "40.0%", "Toronto"), '
    '"detail": one short sentence with the supporting numbers, "tone": "up" | "down" | "neutral" | "warn", '
    '"kind": "total" | "trend" | "rank" | "share" | "compare" | "risk"}], "look_next": one follow-up question the data can answer}. '
    "Every number must appear in the results; never invent figures, periods or causes. Use the dataset context for the time span and do "
    "not treat a partial latest period as a real drop. Thousands separators, at most 2 decimals, currency or % where obvious.")
TONES, KINDS = {"up", "down", "neutral", "warn"}, {"total", "trend", "rank", "share", "compare", "risk"}


def _insights(name: str, built: list[dict[str, Any]], prof: dict[str, Any], provider_id: str | None) -> dict[str, Any] | None:
    """Grounded insights as structured cards {items, look_next, markdown}: the model sees the real results and may only state what
    they show. JSON keeps a reasoning model's thinking out of the text."""
    facts = "\n".join(_summary(w) for w in built if w["chart"]["type"] != "scatter")[:10000]
    try:
        raw = ask_json(INSIGHT_SYSTEM, f"Dataset context:\n{_context(prof)}\n\nDashboard: {name}\n\n{facts}", provider_id, "insights", step=5)
    except Exception:
        return None   # insights are a bonus: the dashboard is still complete without them
    items = []
    for it in raw.get("insights") or []:
        if not isinstance(it, dict) or not it.get("label"):
            continue
        items.append({"label": str(it["label"])[:40], "value": str(it.get("value") or "")[:32], "detail": str(it.get("detail") or "")[:240],
                      "tone": it.get("tone") if it.get("tone") in TONES else "neutral", "kind": it.get("kind") if it.get("kind") in KINDS else "total"})
    if not items:
        return None
    look = str(raw.get("look_next") or "")[:200]
    md = "\n".join(f"- **{x['label']}:** {x['value']} — {x['detail']}" for x in items) + (f"\n- **Look next:** {look}" if look else "")
    return {"items": items[:8], "look_next": look, "markdown": md}


def insight_widget(dash_id: str, ins: dict[str, Any]) -> None:
    """The Insights page's widget: stat cards (markdown kept for older viewers, exports and the editor)."""
    rows = (len(ins["items"]) + 3) // 4
    store.insert("dashboard_widgets", {"dashboard_id": dash_id, "kind": "text", "title": "Key Insights", "page": "insights",
                                       "position": {"x": 0, "y": 0, "w": 12, "h": 1 + 2 * rows},
                                       "settings": {"content": ins["markdown"], "insights": ins["items"], "look_next": ins["look_next"]}})


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
    done_by_idx: dict[int, dict[str, Any]] = {}
    skipped: list[dict[str, str]] = []
    total = len(widgets)
    # every widget is checked and executed at the same time (the model repairs of failing queries overlap; local queries are quick)
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as pool:
        futures = {pool.submit(contextvars.copy_context().run, _materialize, spec, prof["text"], provider_id): (i, spec) for i, spec in enumerate(widgets)}
        for fut in as_completed(futures):
            i, spec = futures[fut]
            title = clean_title(spec.get("title"))
            try:
                w = fut.result()
            except ValueError as e:
                skipped.append({"title": title, "reason": str(e)})
                yield {"type": "widget", "title": title, "status": "skipped", "detail": str(e)}
            else:
                page = spec.get("page") if spec.get("page") in page_name else next(iter(page_name))
                w["title"], w["page"] = title, page
                done_by_idx[i] = w
                yield {"type": "widget", "title": title, "status": "ok", "page": page_name[page], "chart": w["chart"]["type"], "ms": w.get("ms"), "fixed": w.get("fixed", 0),
                       "notes": w.get("notes", []), "why": str(spec.get("why") or ""), "formula": str(spec.get("formula") or ""), "sql": w["sql"]}
            yield {"type": "step", "n": 4, "title": "Building and checking each widget",
                   "detail": f"Checked {len(done_by_idx) + len(skipped)} of {total} widgets (several at the same time)…"}
    built = [done_by_idx[i] for i in sorted(done_by_idx)]   # plan order, whatever order they finished in
    if not built:
        raise ai_svc.AIError("None of the planned widgets could be built: " + "; ".join(s["reason"] for s in skipped)[:300])
    rev = review_dashboard(built, skipped, has_time(built, prof["text"]))   # self-review: drop duplicates, score coverage
    built = rev["kept"]
    yield {"type": "review", "score": rev["score"], "checks": rev["checks"], "dropped": rev["dropped"]}
    yield {"type": "step", "n": 4, "title": "Building and checking each widget", "done": True,
           "detail": f"{len(built)} widgets built" + (f", {len(skipped)} skipped" if skipped else "") + f". Quality score {rev['score']}/100."}

    dash_name = clean_title(name)
    yield {"type": "step", "n": 5, "title": "Writing insights", "detail": "The AI reads the real results (and thinks of improvements at the same time); it may only quote numbers that appear in them."}
    with ThreadPoolExecutor(max_workers=2) as pool:   # insights and suggestions need only the built widgets, not each other
        f_ins = pool.submit(contextvars.copy_context().run, _insights, dash_name, built, prof, provider_id)
        f_sug = pool.submit(contextvars.copy_context().run, _suggestions, dash_name, built, None, prof, provider_id)
        insights, suggestions = f_ins.result(), f_sug.result()
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
        insight_widget(dash["id"], insights)
        out.append({"title": "Key Insights", "type": "text", "page": "Insights"})
    yield {"type": "step", "n": 6, "title": "Saving the dashboard", "done": True, "detail": f"“{dash_name}” saved with {len(used)} pages."}
    yield {"type": "done", "dashboard_id": dash["id"], "name": dash_name, "pages": [p["name"] for p in used], "widgets": out,
           "skipped": skipped, "suggestions": suggestions, "score": rev["score"], "checks": rev["checks"]}


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
