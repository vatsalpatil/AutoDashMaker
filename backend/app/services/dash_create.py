"""Create with AI as a streamed, self-correcting run: read → design → build & check → self-review → insights → save.

Every phase reports what it did (steps, the plan with the reason for each widget, each widget's checks and automatic
fixes, a scored review checklist), so the user sees why the dashboard looks the way it does. Widgets that fail are given
one replacement round with the failure reasons; duplicates are dropped before anything is saved.
"""
from __future__ import annotations

import contextvars
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Iterator

from ..core.store import store
from . import ai as ai_svc
from .ai_context import semantic_context, workbench_context
from .chart_suggest import column_roles
from .dash_ai import CREATE_SYSTEM, MAX_WIDGETS, _layout, _materialize, _store_widget, widgets_of
from .dash_critic import has_time, review_dashboard
from .dash_pages import MAX_PARALLEL
from .dash_plan import ask_json, clean_title

STEPS = ["Reading your data", "Designing the dashboard", "Building and checking each widget", "Self-review and corrections",
         "Writing insights", "Saving the dashboard"]


def _step(n: int, detail: str, done: bool = False) -> dict[str, Any]:
    return {"type": "step", "n": n, "title": STEPS[n - 1], "detail": detail, "done": done}


def _build_all(specs: list[dict[str, Any]], context: str, provider_id: str | None) -> Iterator[tuple[dict, dict | None, str]]:
    """(spec, built widget or None, error) for every spec, built in parallel, in plan order."""
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as pool:
        futs = [pool.submit(contextvars.copy_context().run, _materialize, s, context, provider_id) for s in specs]
        for spec, fut in zip(specs, futs):
            try:
                yield spec, fut.result(), ""
            except ValueError as e:
                yield spec, None, str(e)


def _widget_event(spec: dict[str, Any], w: dict[str, Any] | None, err: str) -> dict[str, Any]:
    title = clean_title(spec.get("title"))
    if w is None:
        return {"type": "widget", "title": title, "status": "skipped", "detail": err}
    return {"type": "widget", "title": w["title"], "status": "ok", "chart": w["chart"]["type"], "ms": w.get("ms"),
            "fixed": w.get("fixed", 0), "notes": w.get("notes", []), "why": str(spec.get("why") or ""), "sql": w["sql"]}


def _replacements(prompt: str, context: str, built: list[dict], skipped: list[dict], provider_id: str | None) -> list[dict[str, Any]]:
    """Self-correction: ask for new widgets in place of the failed ones, showing the model why each failed."""
    failed = "\n".join(f'- "{s["title"]}": {s["reason"]}' for s in skipped)
    have = ", ".join(w["title"] for w in built) or "none"
    user = (f"{context}\n\nDashboard request: {prompt}\nAlready built: {have}\nThese widgets FAILED:\n{failed}\n"
            f"Design {len(skipped)} replacement widget(s) answering the same questions with queries that work on the listed columns.")
    try:
        return widgets_of(ask_json(CREATE_SYSTEM, user, provider_id, "widgets", step=4))[:len(skipped)]
    except ai_svc.AIError:
        return []


def _profile_like(context: str, built: list[dict[str, Any]]) -> dict[str, Any]:
    """What dash_gen's insights/suggestions need, for a dashboard that may span several tables."""
    cols: dict[str, str] = {}
    for w in built:
        roles = column_roles(w["columns"], w["all_rows"])
        for role, names in roles.items():
            for c in names:
                cols.setdefault(c, {"time": "time", "measure": "measure"}.get(role, "category"))
    return {"text": context, "columns": [{"name": c, "role": r} for c, r in cols.items()]}


def create_stream(prompt: str, dataset_id: str | None, provider_id: str | None) -> Iterator[dict[str, Any]]:
    from .dash_gen import _insights, _suggestions   # lazy: dash_gen imports dash_ai helpers too
    yield _step(1, "Collecting the tables, columns, saved queries and business definitions the AI may use.")
    context = f"{workbench_context(dataset_id, prompt)}\n\n{semantic_context(dataset_id)}"
    tables = sum(1 for l in context.splitlines() if l.lower().startswith(("table", "- table", "## ")))
    yield _step(1, f"Context ready ({tables or 'all'} table(s)" + (", scoped to one dataset)." if dataset_id else ")."), True)

    yield _step(2, "The AI designs KPIs, trends and breakdowns that answer your request, and says why each one is there.")
    plan = ask_json(CREATE_SYSTEM, f"{context}\n\nDashboard request: {prompt}", provider_id, "widgets", step=2)
    specs = widgets_of(plan)[:MAX_WIDGETS]
    if not specs:
        raise ai_svc.AIError("The model's plan had no widgets. Try again or pick another model in Settings.")
    name = clean_title(plan.get("name") or prompt)
    yield {"type": "plan", "name": name, "widgets": [{"title": clean_title(s.get("title")), "type": str(s.get("type") or ""),
                                                      "why": str(s.get("why") or "")} for s in specs]}
    yield _step(2, f"“{name}”: {len(specs)} widgets planned.", True)

    yield _step(3, "Each query is validated read-only, bound to the real schema, repaired if it fails, run, and its chart checked against the result.")
    built, skipped = [], []
    for spec, w, err in _build_all(specs, context, provider_id):
        yield _widget_event(spec, w, err)
        (built.append(w) if w else skipped.append({"title": clean_title(spec.get("title")), "reason": err}))
    yield _step(3, f"{len(built)} built" + (f", {len(skipped)} failed." if skipped else "."), True)

    yield _step(4, "Checking the dashboard as a whole: replacing failed widgets, removing duplicates, scoring coverage.")
    if skipped:
        retry = _replacements(prompt, context, built, skipped, provider_id)
        recovered = 0
        for spec, w, err in _build_all(retry, context, provider_id):
            ev = _widget_event(spec, w, err)
            yield {**ev, "replacement": True}
            if w:
                built.append(w)
                recovered += 1
        skipped = skipped[recovered:]
    if not built:
        raise ai_svc.AIError("None of the proposed widgets could be built: " + "; ".join(s["reason"] for s in skipped)[:300])
    rev = review_dashboard(built, skipped, has_time(built, context))
    built = rev["kept"]
    yield {"type": "review", "score": rev["score"], "checks": rev["checks"], "dropped": rev["dropped"]}
    yield _step(4, f"Quality score {rev['score']}/100.", True)

    yield _step(5, "The AI reads the real results and may only quote numbers that appear in them; it also proposes next improvements.")
    prof = _profile_like(context, built)
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_ins = pool.submit(contextvars.copy_context().run, _insights, name, built, prof, provider_id)
        f_sug = pool.submit(contextvars.copy_context().run, _suggestions, name, built, None, prof, provider_id)
        insights, suggestions = f_ins.result(), f_sug.result()
    yield _step(5, "Insights page added." if insights else "Skipped (the model returned no insights).", True)

    pages = [{"id": "main", "name": "Overview"}] + ([{"id": "insights", "name": "Insights"}] if insights else [])
    dash = store.insert("dashboards", {"name": name, "pages": pages, "description": f"Built by AI from: {prompt[:200]}"})
    widgets = [_store_widget(dash["id"], w, p, dataset_id) for w, p in zip(built, _layout(built))]
    if insights:
        store.insert("dashboard_widgets", {"dashboard_id": dash["id"], "kind": "text", "title": "Key Insights", "page": "insights",
                                           "position": {"x": 0, "y": 0, "w": 12, "h": 6}, "settings": {"content": insights}})
    yield _step(6, f"“{name}” saved with {len(widgets)} widgets.", True)
    yield {"type": "done", "dashboard_id": dash["id"], "name": name, "widgets": widgets, "skipped": skipped,
           "score": rev["score"], "checks": rev["checks"], "suggestions": suggestions}
