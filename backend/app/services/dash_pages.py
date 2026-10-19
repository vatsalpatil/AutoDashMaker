"""Parallel planning: one model call per dashboard page, all running at the same time.

A single call that writes a whole multi-page plan is slow on free models (generation speed is the limit, and the answer is long).
Here the pages come from the template, then every page is planned by its own call concurrently, so the wall-clock time is roughly the slowest single page. Each call sees what the other pages are
for, which also keeps widgets from repeating across pages. Used for the first plan; revisions still use one call (dash_plan.plan).
"""
from __future__ import annotations

import contextvars
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Iterator

from . import ai as ai_svc
from .dash_ai import CHART_TYPES, widgets_of
from .dash_plan import MAX_GENERATED, ask_json
from .dash_templates import FORMULAS, NAMING_RULES, SQL_RULES, TEMPLATES

MAX_PARALLEL = 6
PER_PAGE = 8

PAGE_SYSTEM = (
    "You are a senior BI designer inside a DuckDB analytics app. You design ONE page of a multi-page dashboard. Reply with ONLY one JSON "
    'object, no prose, no markdown: {"widgets": [{"title": string, "type": one of ' + "|".join(CHART_TYPES) + ', "why": one sentence: the '
    'question this widget answers, "formula": the calculation in plain words, "sql": one read-only DuckDB SELECT}], "page_name": optional '
    '1-2 word page name, only when your brief asks you to name the page}. 0 (only when your brief allows it) or 3 to '
    f"{PER_PAGE} widgets, only for the page you are given. Use ONLY columns that exist in the profile.\n\n" + NAMING_RULES + "\n\n" + SQL_RULES + "\n\n" + FORMULAS)

def _blueprint_for(tpl: dict, page_id: str) -> str:
    """The page's blueprint line ("id:" or "a, b, c:" shared by several pages), after the template's general lines (no page prefix)."""
    ids = {i for i, _ in tpl["pages"]}
    general, own = [], ""
    for line in tpl["blueprint"].split("\n"):
        head, _, rest = line.partition(":")
        keys = {k.strip() for k in head.split(",")}
        if rest and keys <= ids:
            own = rest.strip() if page_id in keys else own
        else:
            general.append(line.strip())
    return " ".join(general + [own]).strip() if own else ""


def _pages(template: str) -> list[dict[str, str]]:
    """The template's pages with what each is for (no model call: the pages are fixed, only their widgets are up to the AI)."""
    tpl = TEMPLATES[template]
    return [{"id": i, "name": n, "focus": _blueprint_for(tpl, i)} for i, n in tpl["pages"]]


def _plan_page(context: str, pages: list[dict[str, str]], index: int, provider_id: str | None) -> list[dict[str, Any]]:
    page = pages[index]
    others = "\n".join(f"- {p['name']}: {p['focus']}" for i, p in enumerate(pages) if i != index and p["focus"])
    user = (f"{context}\n\nYour page: \"{page['name']}\" — {page['focus'] or 'choose what fits this data'}\n"
            + (f"Other pages (do NOT repeat their content):\n{others}\n" if others else "")
            + ("This is the first page: put the KPI widgets first." if index == 0 else "Do not add headline KPIs that the first page already shows."))
    raw = ask_json(PAGE_SYSTEM, user, provider_id, "widgets", step=3, lane=page["id"], label=page["name"])
    if raw.get("page_name"):
        page["name"] = str(raw["page_name"])[:30]
    return [dict(w, page=page["id"]) for w in widgets_of(raw)[:PER_PAGE]]


REVISE_PAGES_SYSTEM = (
    "You restructure a dashboard's pages to satisfy the user's change request. Reply with ONLY JSON: "
    '{"pages": [{"id": short snake_case id, "name": 1-3 word page name, "focus": one sentence: what this page shows}]}. '
    "2 to 6 pages. Keep the existing pages unless the request changes them; when the user asks for a page/tab per audience, segment, region, "
    "etc., make one page for each. The first page holds the headline KPIs.")


def revise_pages(context: str, previous: list[str], feedback: str, template: str, provider_id: str | None) -> list[dict[str, str]]:
    """One short model call: the pages the revised plan needs (falls back to the template's pages)."""
    current = "; ".join(f"{p['name']} ({p['focus']})" for p in _pages(template)) or "(none fixed)"
    user = (f"{context}\n\nCurrent pages: {current}\nCurrent widgets: {'; '.join(previous)[:900]}\n"
            f"The user's change request: {feedback[:600]}")
    try:
        raw = ask_json(REVISE_PAGES_SYSTEM, user, provider_id, "pages", step=3, lane="pages", label="Pages")
    except ai_svc.AIError:
        return _pages(template)
    out, seen = [], set()
    for p in raw.get("pages") or []:
        if not isinstance(p, dict) or not p.get("name"):
            continue
        pid = "".join(ch if ch.isalnum() else "_" for ch in str(p.get("id") or p["name"]).lower()).strip("_")[:24] or f"p{len(out)}"
        if pid in seen:
            continue
        seen.add(pid)
        out.append({"id": pid, "name": str(p["name"])[:40], "focus": str(p.get("focus") or "")[:300]})
    return out[:8] or _pages(template)


def plan_in_parallel(template: str, context: str, provider_id: str | None, pages: list[dict[str, str]] | None = None) -> Iterator[dict[str, Any]]:
    """Yields step-3 progress events, then one {type: 'specs', name, pages, specs, notes}."""
    name, pages = None, pages or _pages(template)
    names = [p["name"] for p in pages]
    yield {"type": "step", "n": 3, "title": "Planning the dashboard",
           "detail": f"Planning {len(pages)} pages at the same time: {', '.join(names)}."}
    results: dict[int, list[dict[str, Any]]] = {}
    notes: list[str] = []
    errors: list[Exception] = []
    with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL, len(pages))) as pool:
        futures = {pool.submit(contextvars.copy_context().run, _plan_page, context, pages, i, provider_id): i for i in range(len(pages))}
        for fut in as_completed(futures):
            i = futures[fut]
            try:
                results[i] = fut.result()
                notes.append(f"{pages[i]['name']}: {len(results[i])} widgets planned")
            except Exception as e:   # one weak page must not sink the rest
                errors.append(e)
                notes.append(f"{pages[i]['name']}: could not be planned ({str(e)[:120]})")
            yield {"type": "step", "n": 3, "title": "Planning the dashboard",
                   "detail": f"Planned {len(results)} of {len(pages)} pages at the same time: {', '.join(names)}.", "items": notes[:]}
    specs = [w for i in sorted(results) for w in results[i]][:MAX_GENERATED]
    if not specs:
        raise errors[0] if errors else ai_svc.AIError("The model's plan had no widgets. Try again or pick another model in Settings.")
    yield {"type": "specs", "name": name, "pages": [p for i, p in enumerate(pages) if i in results and results[i]], "specs": specs, "notes": notes}
