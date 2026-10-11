"""Generate a multi-page dashboard from one dataset, AI only, as a stream of visible steps.

run() yields events so the UI can show the whole process: 1 read the data -> 2 what the AI understood and how it reasoned ->
3 the layout it chose (pages, widgets, why, formula) -> 4 each widget validated + executed -> 5 grounded insights -> 6 saved.
Every query goes through dash_ai._materialize (read-only validation, bind check, one repair round, execution); a widget that
cannot be made to work is skipped and reported, never saved half-built.
"""
from __future__ import annotations

import re
from typing import Any, Iterator

from ..core.store import store
from . import ai as ai_svc
from .dash_ai import CHART_TYPES, _ask, _layout, _materialize, _store_widget, widgets_of
from .dash_profile import profile
from .dash_templates import DATA_BASICS, FORMULAS, NAMING_RULES, SQL_RULES, TEMPLATES

MAX_GENERATED = 18
_SMALL = {"a", "an", "and", "by", "for", "in", "of", "on", "or", "per", "the", "to", "vs"}

SYSTEM = (
    "You are a senior BI designer inside a DuckDB analytics app. You are given a profile of ONE table (column roles, ranges, "
    "top values) and a dashboard blueprint. First understand the data, then design a multi-page dashboard that makes it directly "
    "useful. Reply with ONLY one JSON object, no prose, no markdown: "
    '{"understanding": 2-3 sentences: what one row is, what the data is about, the main measures, dimensions and time column, '
    '"thinking": [3 to 6 short strings, each one decision with its reason, e.g. "Main measure: revenue, because it is numeric and ... "], '
    '"name": string, "pages": [{"id": string, "name": string}], "widgets": [{"page": a page id, "title": string, "type": one of '
    + "|".join(CHART_TYPES) + ', "why": one sentence: the question this widget answers, "formula": the calculation in plain words, '
    '"sql": one read-only DuckDB SELECT}]}. Use ONLY columns that exist in the profile. Put KPI widgets first on the first page. '
    f"3 to 7 widgets per page, at most {MAX_GENERATED} in total.\n\n" + DATA_BASICS + "\n\n" + NAMING_RULES + "\n\n" + SQL_RULES + "\n\n" + FORMULAS)


def clean_title(title: Any) -> str:
    """Readable widget/page name: no snake_case, Title Case when the model returned all lowercase, max 60 chars."""
    t = re.sub(r"\s+", " ", str(title or "").replace("_", " ")).strip(" -:")
    if t and (t == t.lower() or t == t.upper()):
        t = " ".join(w if (i and w.lower() in _SMALL) else w.capitalize() for i, w in enumerate(t.lower().split()))
    return t[:60] or "Untitled"


def _slug(text: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "page"
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def _pages(plan: dict[str, Any], template: str) -> list[dict[str, str]]:
    """Page list: the model's, or the template's fixed pages. Ids are unique slugs; at most 5 pages."""
    given = plan.get("pages")
    raw = [p for p in given if isinstance(p, dict) and p.get("name")] if isinstance(given, list) else []
    raw = raw or [{"id": i, "name": n} for i, n in TEMPLATES[template]["pages"]]
    pages, taken = [], set()
    for p in raw[:5]:
        pid = _slug(str(p.get("id") or p["name"]), taken)
        taken.add(pid)
        pages.append({"id": pid, "name": clean_title(p["name"])})
    return pages or [{"id": "overview", "name": "Overview"}]


def _page_of(spec: dict[str, Any], pages: list[dict[str, str]]) -> str:
    key = str(spec.get("page", "")).strip().lower()
    for p in pages:
        if key in (p["id"].lower(), p["name"].lower()):
            return p["id"]
    return pages[0]["id"]


def _unique(title: str, page_name: str, seen: set[str]) -> str:
    t, n = title, 2
    if t.lower() in seen:
        t = f"{title} ({page_name})"[:70]
    while t.lower() in seen:
        t, n = f"{title} {n}", n + 1
    seen.add(t.lower())
    return t


def _facts(prof: dict[str, Any]) -> str:
    """Step 1 text: what the profile found, by role (facts only, nothing generated)."""
    by: dict[str, list[str]] = {}
    for c in prof["columns"]:
        extra = f" ({c['distinct_count']:,} values)" if c["role"] == "dimension" else f" ({c['null_pct']}% empty)" if c["null_pct"] >= 5 else ""
        by.setdefault(c["role"], []).append(c["name"] + extra)
    labels = {"measure": "Measures (numbers to add up)", "dimension": "Dimensions (to split by)", "time": "Time columns",
              "id": "Identifiers (counted, never summed)", "text": "Free text / high-cardinality"}
    lines = [f"{prof['rows']:,} rows, {len(prof['columns'])} columns."]
    lines += [f"{labels[r]}: {', '.join(by[r])}" for r in labels if r in by]
    if prof["grain"]:
        lines.append(f"Time span suggests a {prof['grain']}ly trend grain.")
    return "\n".join(lines)


def _insights(name: str, built: list[dict[str, Any]], provider_id: str | None) -> str | None:
    """Grounded insights: the model sees the real result rows and may only state what they show."""
    facts = "\n".join(f"{w['title']} | columns {', '.join(w['columns'])} | first rows {w['preview']}" for w in built if w["chart"]["type"] != "scatter")[:9000]
    messages = [
        {"role": "system", "content": "You are a data analyst. Write 5 to 7 short markdown bullets of insights from the widget results below. "
         "Every bullet must quote concrete numbers that appear in the results; never invent figures. Lead each bullet with a bold "
         "label (e.g. **Top region:**). Finish with one bullet starting **Look next:** suggesting a follow-up question. Reply with the bullets only."},
        {"role": "user", "content": f"Dashboard: {name}\n\n{facts}"},
    ]
    try:
        text = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", ai_svc.chat(messages, provider_id=provider_id, max_tokens=1200))).strip()
    except Exception:
        return None  # insights are a bonus: the dashboard is still complete without them
    return text or None


def run(dataset_id: str, template: str, focus: str, provider_id: str | None, name: str | None = None) -> Iterator[dict[str, Any]]:
    """Yield {type: step|widget|done} events; raises LookupError / ai_svc.AIError for the caller to report."""
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise LookupError("dataset not found")
    template = template if template in TEMPLATES else "auto"
    tpl = TEMPLATES[template]

    yield {"type": "step", "n": 1, "title": "Reading the data", "detail": "Profiling every column: type, empty %, distinct values, ranges, top values."}
    prof = profile(ds)
    yield {"type": "step", "n": 1, "title": "Reading the data", "detail": _facts(prof), "done": True}

    yield {"type": "step", "n": 2, "title": "Understanding the data", "detail": f"Asking the AI to reason about the data using the “{tpl['name']}” template…"}
    pages_hint = ", ".join(f"{i} = {n}" for i, n in tpl["pages"]) or "(you choose)"
    user = (f"{prof['text']}\n\nBlueprint \"{tpl['name']}\" — pages: {pages_hint}\n{tpl['blueprint']}"
            + (f"\n\nExtra focus from the user: {focus.strip()[:400]}" if focus.strip() else ""))
    plan = _ask(SYSTEM, user, provider_id)
    specs = widgets_of(plan)[:MAX_GENERATED]
    if not specs:
        raise ai_svc.AIError("The model's plan had no widgets. Try again or pick another model in Settings.")
    thinking = [str(t) for t in plan.get("thinking", []) if t][:8] if isinstance(plan.get("thinking"), list) else []
    yield {"type": "step", "n": 2, "title": "Understanding the data", "done": True,
           "detail": str(plan.get("understanding") or "").strip(), "items": thinking}

    pages = _pages(plan, template)
    page_name = {p["id"]: p["name"] for p in pages}
    plan_lines = [f"{page_name[_page_of(s, pages)]}: {clean_title(s.get('title'))} ({s.get('type', '?')}) — {str(s.get('why') or '').strip()}" for s in specs]
    yield {"type": "step", "n": 3, "title": "Planning the dashboard", "done": True,
           "detail": f"{len(pages)} pages, {len(specs)} widgets.", "items": plan_lines}

    yield {"type": "step", "n": 4, "title": "Building and checking each widget",
           "detail": "Every query is validated read-only, bound against the real schema, repaired once if needed, and executed."}
    built, skipped, seen = [], [], set()
    for spec in specs:
        title = clean_title(spec.get("title"))
        try:
            w = _materialize(spec, prof["text"], provider_id)
        except ValueError as e:
            skipped.append({"title": title, "reason": str(e)})
            yield {"type": "widget", "title": title, "status": "skipped", "detail": str(e)}
            continue
        page = _page_of(spec, pages)
        w["title"] = _unique(clean_title(spec.get("title") or w["title"]), page_name[page], seen)
        w["page"], w["why"], w["formula"] = page, str(spec.get("why") or ""), str(spec.get("formula") or "")
        built.append(w)
        yield {"type": "widget", "title": w["title"], "status": "ok", "page": page_name[page], "chart": w["chart"]["type"],
               "rows": len(w["preview"]) if w["chart"]["type"] == "kpi" else None, "ms": w.get("ms"), "why": w["why"],
               "formula": w["formula"], "sql": w["sql"]}
    if not built:
        raise ai_svc.AIError("None of the proposed widgets could be built: " + "; ".join(s["reason"] for s in skipped)[:300])
    yield {"type": "step", "n": 4, "title": "Building and checking each widget", "done": True,
           "detail": f"{len(built)} widgets built" + (f", {len(skipped)} skipped." if skipped else ".")}

    dash_name = clean_title(name or plan.get("name") or f"{ds['name']} Dashboard")
    yield {"type": "step", "n": 5, "title": "Writing insights", "detail": "The AI reads the real results and may only quote numbers that appear in them."}
    insights = _insights(dash_name, built, provider_id)
    yield {"type": "step", "n": 5, "title": "Writing insights", "done": True,
           "detail": "Insights page added." if insights else "Skipped (the model did not return insights)."}

    used = [p for p in pages if any(w["page"] == p["id"] for w in built)]
    if insights:
        used.append({"id": "insights", "name": "Insights"})
    dash = store.insert("dashboards", {"name": dash_name, "pages": used, "description": f"AI-generated from {ds['name']} ({tpl['name']})."})
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
    yield {"type": "done", "dashboard_id": dash["id"], "name": dash_name, "pages": [p["name"] for p in used], "widgets": out, "skipped": skipped}


def generate(dataset_id: str, template: str, focus: str, provider_id: str | None, name: str | None = None) -> dict[str, Any]:
    """Run to the end and return the final result (non-streaming callers and tests)."""
    final: dict[str, Any] = {}
    for ev in run(dataset_id, template, focus, provider_id, name):
        if ev["type"] == "done":
            final = ev
    return final
