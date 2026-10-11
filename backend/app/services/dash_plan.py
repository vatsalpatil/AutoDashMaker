"""Phases 1 and 2 of AI dashboard generation: understand the data (and ask the user), then plan the dashboard.

understand() reads the data, shows the AI the DESCRIBE statistics + top 100 rows, and yields what it understood plus the
questions it wants the user to settle. plan() turns that understanding, the user's answers and any feedback into a named,
multi-page widget plan. Nothing is saved or executed against user data here except profiling; building is in dash_gen.
"""
from __future__ import annotations

import re
import time
from typing import Any, Iterator

import httpx

from . import ai as ai_svc
from .dash_ai import CHART_TYPES, json_objects, widgets_of
from .dash_profile import profile
from .dash_templates import DATA_BASICS, FORMULAS, NAMING_RULES, SQL_RULES, TEMPLATES
from ..core.store import store

MAX_GENERATED = 18
_SMALL = {"a", "an", "and", "by", "for", "in", "of", "on", "or", "per", "the", "to", "vs"}

UNDERSTAND_SYSTEM = (
    "You are a senior data analyst. You are shown ONE table: column roles, DESCRIBE-style statistics (min, quartiles, mean, std), "
    "correlations, top values and the first rows. Study them like an analyst meeting new data. Reply with ONLY one JSON object, no "
    'prose, no markdown: {"understanding": 2-4 sentences: what one row is, what the data is about, the main measures, dimensions, time '
    'column and anything notable (skew, outliers, empty columns, correlations), "thinking": [3 to 6 short strings, each a finding or '
    'decision with its reason], "questions": [2 to 4 objects {"id": "q1", "question": string, "why": one sentence, "options": [2 to 6 short '
    'answers built from the real columns/values], "multi": boolean}] — ask only about the user\'s intent and preferences, never a question the data itself answers (so not "which region sells most?"): the main KPI measure, the primary dimension, the audience, what to compare, what matters most — each answer must change the '
    'dashboard (the main KPI measure, the primary dimension, the audience, the time grain, what to compare), "ideas": [2 to 4 dashboard '
    'ideas worth building for this data]}.\n\n' + DATA_BASICS)

PLAN_SYSTEM = (
    "You are a senior BI designer inside a DuckDB analytics app. You have the data profile, what the analyst understood and what the "
    "user answered. Design a multi-page dashboard that makes the data directly useful and follows the user's answers and feedback. "
    'Reply with ONLY one JSON object, no prose, no markdown: {"name": string, "thinking": [2 to 5 short strings: how the answers shaped '
    'the plan], "pages": [{"id": string, "name": string}], "widgets": [{"page": a page id, "title": string, "type": one of '
    + "|".join(CHART_TYPES) + ', "why": one sentence: the question this widget answers, "formula": the calculation in plain words, '
    '"sql": one read-only DuckDB SELECT}]}. Use ONLY columns that exist in the profile. Put KPI widgets first on the first page. '
    f"3 to 7 widgets per page, at most {MAX_GENERATED} in total.\n\n" + NAMING_RULES + "\n\n" + SQL_RULES + "\n\n" + FORMULAS)


def clean_title(title: Any) -> str:
    """Readable widget/page name: no snake_case, Title Case when the model returned all lowercase, max 60 chars."""
    t = re.sub(r"\s+", " ", str(title or "").replace("_", " ")).strip(" -:")
    if t and (t == t.lower() or t == t.upper()):
        t = " ".join(w if (i and w.lower() in _SMALL) else w.capitalize() for i, w in enumerate(t.lower().split()))
    t = re.sub(r"\b(\w+)(?: \1\b)+", r"\1", t, flags=re.I)   # "Total Total Profit" -> "Total Profit"
    return t[:60] or "Untitled"


def ask_json(system: str, user: str, provider_id: str | None, key: str) -> dict[str, Any]:
    """One model call that must return a JSON object holding `key`.

    Handles what free/reasoning models do in practice: temporary rate limits (retry after a pause), a reasoning transcript that eats
    the whole token budget and leaves no answer (retry with a bigger budget), slow replies (long timeout), and replies that are not
    JSON (one insistent retry)."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    tokens, nudged, waits = 6000, False, [5, 15]
    while True:
        try:
            text = ai_svc.chat(messages, provider_id=provider_id, max_tokens=tokens, timeout=180)
        except httpx.TimeoutException:
            raise ai_svc.AIError("The AI model took too long to answer. Try again, or pick a faster model in Settings.") from None
        except ai_svc.AIError as e:
            msg = str(e)
            if ("429" in msg or "rate" in msg.lower()) and waits:
                time.sleep(waits.pop(0))
                continue
            if "empty content" in msg and tokens < 16000:
                tokens = 16000
                continue
            if "empty content" in msg:
                raise ai_svc.AIError("This model spent its whole answer budget thinking and returned nothing. Pick a different model in Settings "
                                     "(a non-reasoning or smaller reasoning model works best for dashboards).") from None
            if "429" in msg or "rate-limit" in msg.lower():
                raise ai_svc.AIError("The AI provider is rate-limiting requests right now (free models have per-minute and daily limits). "
                                     "Wait a minute and try again, or pick another model in Settings.") from None
            raise
        found = [o for o in json_objects(text) if key in o]
        if found:
            return found[-1]
        if nudged:
            raise ai_svc.AIError("The model did not return a usable answer. Try again or pick a non-reasoning model in Settings.")
        nudged = True
        messages.append({"role": "user", "content": "Reply with ONLY the JSON object, nothing else."})


def _facts(prof: dict[str, Any]) -> str:
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


def _questions(raw: Any) -> list[dict[str, Any]]:
    out = []
    for i, q in enumerate(raw if isinstance(raw, list) else []):
        if isinstance(q, dict) and q.get("question"):
            opts = [str(o)[:60] for o in q.get("options", []) if o][:6] if isinstance(q.get("options"), list) else []
            out.append({"id": str(q.get("id") or f"q{i + 1}"), "question": str(q["question"])[:200], "why": str(q.get("why") or "")[:200],
                        "options": opts, "multi": bool(q.get("multi"))})
    return out[:4]


def _strings(raw: Any, n: int) -> list[str]:
    return [str(t)[:300] for t in raw if t][:n] if isinstance(raw, list) else []


def understand(dataset_id: str, template: str, focus: str, provider_id: str | None) -> Iterator[dict[str, Any]]:
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise LookupError("dataset not found")
    yield {"type": "step", "n": 1, "title": "Reading the data", "detail": "Profiling every column, computing statistics and reading the top 100 rows."}
    prof = profile(ds)
    yield {"type": "step", "n": 1, "title": "Reading the data", "detail": _facts(prof), "done": True}
    yield {"type": "profile", "table": prof["table"], "rows": prof["rows"], "describe": prof["describe"], "sample": prof["sample"], "correlations": prof["correlations"]}

    yield {"type": "step", "n": 2, "title": "Understanding the data", "detail": "The AI is studying the statistics and sample rows…"}
    focus_line = f"\n\nThe user's focus: {focus.strip()[:400]}" if focus.strip() else ""
    plan = ask_json(UNDERSTAND_SYSTEM, f"{prof['text']}\n\nTemplate wanted: {TEMPLATES.get(template, TEMPLATES['auto'])['name']}{focus_line}", provider_id, "understanding")
    yield {"type": "step", "n": 2, "title": "Understanding the data", "done": True, "detail": str(plan.get("understanding") or "").strip(), "items": _strings(plan.get("thinking"), 8)}
    yield {"type": "understanding", "understanding": str(plan.get("understanding") or "").strip(), "thinking": _strings(plan.get("thinking"), 8),
           "questions": _questions(plan.get("questions")), "ideas": _strings(plan.get("ideas"), 4)}


def _slug(text: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "page"
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def clean_pages(raw: Any, template: str) -> list[dict[str, str]]:
    """Page list: the model's, or the template's fixed pages. Ids are unique slugs; at most 5 pages."""
    given = [p for p in raw if isinstance(p, dict) and p.get("name")] if isinstance(raw, list) else []
    given = given or [{"id": i, "name": n} for i, n in TEMPLATES[template]["pages"]]
    pages, taken = [], set()
    for p in given[:5]:
        pid = _slug(str(p.get("id") or p["name"]), taken)
        taken.add(pid)
        pages.append({"id": pid, "name": clean_title(p["name"])})
    return pages or [{"id": "overview", "name": "Overview"}]


def page_of(spec: dict[str, Any], pages: list[dict[str, str]]) -> str:
    key = str(spec.get("page", "")).strip().lower()
    for p in pages:
        if key in (p["id"].lower(), p["name"].lower()):
            return p["id"]
    return pages[0]["id"]


def unique_title(title: str, page_name: str, seen: set[str]) -> str:
    t, n = title, 2
    if t.lower() in seen:
        t = f"{title} ({page_name})"[:70]
    while t.lower() in seen:
        t, n = f"{title} {n}", n + 1
    seen.add(t.lower())
    return t


def plan(dataset_id: str, template: str, focus: str, understanding: str, answers: dict[str, str], feedback: str,
         previous: list[str], provider_id: str | None, name: str | None = None) -> Iterator[dict[str, Any]]:
    ds = store.get("datasets", dataset_id)
    if not ds:
        raise LookupError("dataset not found")
    template = template if template in TEMPLATES else "auto"
    tpl = TEMPLATES[template]
    yield {"type": "step", "n": 3, "title": "Planning the dashboard", "detail": "Turning what it understood and your answers into pages and widgets…"}
    prof = profile(ds)
    pages_hint = ", ".join(f"{i} = {n}" for i, n in tpl["pages"]) or "(you choose)"
    parts = [prof["text"], f"Analyst's understanding: {understanding[:1200]}",
             f"Blueprint \"{tpl['name']}\" — pages: {pages_hint}\n{tpl['blueprint']}"]
    if answers:
        parts.append("The user answered:\n" + "\n".join(f"- {q}: {a}" for q, a in answers.items() if a))
    if focus.strip():
        parts.append(f"The user's focus: {focus.strip()[:400]}")
    if feedback.strip():
        parts.append(f"The user reviewed the previous plan ({'; '.join(previous)[:900]}) and asks: {feedback.strip()[:600]}. Revise accordingly.")
    raw = ask_json(PLAN_SYSTEM, "\n\n".join(parts), provider_id, "widgets")
    specs = widgets_of(raw)[:MAX_GENERATED]
    if not specs:
        raise ai_svc.AIError("The model's plan had no widgets. Try again or pick another model in Settings.")
    pages = clean_pages(raw.get("pages"), template)
    page_name = {p["id"]: p["name"] for p in pages}
    seen: set[str] = set()
    widgets = []
    for i, s in enumerate(specs):
        page = page_of(s, pages)
        widgets.append({"idx": i, "page": page, "title": unique_title(clean_title(s.get("title")), page_name[page], seen),
                        "type": str(s.get("type") or "").lower() if str(s.get("type") or "").lower() in CHART_TYPES else "table",
                        "why": str(s.get("why") or "").strip()[:300], "formula": str(s.get("formula") or "").strip()[:300],
                        "sql": str(s.get("sql") or "").strip()})
    used = [p for p in pages if any(w["page"] == p["id"] for w in widgets)]
    yield {"type": "step", "n": 3, "title": "Planning the dashboard", "done": True, "detail": f"{len(used)} pages, {len(widgets)} widgets proposed.",
           "items": _strings(raw.get("thinking"), 6)}
    yield {"type": "plan", "name": clean_title(name or raw.get("name") or f"{ds['name']} Dashboard"), "pages": used, "widgets": widgets}
