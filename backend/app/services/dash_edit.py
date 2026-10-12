"""Edit with AI as a streamed, self-correcting run: read → plan → apply & check → verify, with one-click undo.

Before anything changes, the dashboard (name, pages, every widget row) is snapshotted so the whole AI edit can be undone.
Ops that reference something that does not exist go back to the model once with the errors and the valid ids; after
applying, the touched page is checked for overlapping widgets and every new widget was self-reviewed (dash_critic).
"""
from __future__ import annotations

import json
from typing import Any, Iterator

from ..core.store import store
from .ai_context import semantic_context, workbench_context
from .dash_ai import EDIT_SYSTEM, MAX_WIDGETS, _describe
from .dash_edit_ops import Editor
from .dash_place import resolve_overlaps
from .dash_plan import ask_json

STEPS = ["Reading the dashboard", "Planning the change", "Applying and checking", "Verifying the result"]


def _step(n: int, detail: str, done: bool = False) -> dict[str, Any]:
    return {"type": "step", "n": n, "title": STEPS[n - 1], "detail": detail, "done": done}


def _widgets(dash_id: str) -> list[dict[str, Any]]:
    return store.list("dashboard_widgets", where="dashboard_id = ?", params=[dash_id], order=None)


def snapshot(dash: dict[str, Any]) -> None:
    snap = {"name": dash.get("name"), "pages": dash.get("pages") or [], "widgets": _widgets(dash["id"])}
    store.update("dashboards", dash["id"], {"ai_undo": json.dumps(snap, default=str)})


def undo(dash_id: str) -> dict[str, Any]:
    """Put the dashboard back exactly as it was before the last AI edit."""
    dash = store.get("dashboards", dash_id)
    if not dash:
        raise LookupError("dashboard not found")
    if not dash.get("ai_undo"):
        raise ValueError("nothing to undo")
    snap = json.loads(dash["ai_undo"])
    for w in _widgets(dash_id):
        store.delete("dashboard_widgets", w["id"])
    for w in snap["widgets"]:
        store.insert("dashboard_widgets", {k: v for k, v in w.items() if k not in ("created_at", "updated_at")})
    store.update("dashboards", dash_id, {"name": snap["name"], "pages": snap["pages"], "ai_undo": None})
    return {"ok": True, "widgets": len(snap["widgets"])}


def _prompt(dash: dict, editor: Editor, listing: str, context: str, history: list[dict] | None, instruction: str) -> str:
    talk = "\n".join(f'{"User" if t.get("role") == "user" else "You"}: {str(t.get("text", ""))[:300]}' for t in (history or [])[-8:])
    pages = ", ".join(f"{pid} ({name})" for pid, name in editor.page_name.items())
    return (f"{context}\n\nDashboard \"{dash['name']}\". Pages: {pages}. The user is viewing page: {editor.viewing}.\nWidgets:\n{listing}\n"
            + (f"\nConversation so far:\n{talk}\n" if talk else "") + f"\nInstruction: {instruction}")


def _run_ops(editor: Editor, ops: list, applied: list, skipped: list) -> Iterator[dict[str, Any]]:
    for op in [o for o in ops if isinstance(o, dict)][:MAX_WIDGETS]:
        label = str(op.get("op") or "?")
        try:
            text = editor.apply(op)
        except ValueError as e:
            what = str((op.get("widget") or {}).get("title") if isinstance(op.get("widget"), dict) else "") or op.get("title") or op.get("id") or label
            skipped.append({"title": str(what), "reason": str(e)})
            yield {"type": "op", "op": label, "status": "skipped", "text": f"{label} {what}", "detail": str(e)}
        else:
            applied.append(text)
            yield {"type": "op", "op": label, "status": "ok", "text": text}


def edit_stream(dash_id: str, instruction: str, provider_id: str | None, history: list[dict] | None = None,
                page: str | None = None) -> Iterator[dict[str, Any]]:
    dash = store.get("dashboards", dash_id)
    if not dash:
        raise LookupError("dashboard not found")
    yield _step(1, "Reading the widgets, their queries, sizes and positions, plus the tables the AI may use.")
    listing, index = _describe(dash_id)
    editor = Editor(dash, index, "", "", provider_id)
    editor.viewing = editor.touched = page if page in editor.page_name else next(iter(editor.page_name))
    editor.context = f"{workbench_context(None, instruction)}\n\n{semantic_context(None)}"
    yield _step(1, f"{len(index)} widgets on {len(editor.pages)} page(s).", True)

    yield _step(2, "The AI decides which widgets to add, change, move, resize or remove.")
    user = _prompt(dash, editor, listing, editor.context, history, instruction)
    plan = ask_json(EDIT_SYSTEM, user, provider_id, "ops", step=2)
    ops = plan.get("ops") if isinstance(plan.get("ops"), list) else []
    yield {"type": "plan", "message": str(plan.get("message") or ""), "ops": [str(o.get("op")) for o in ops if isinstance(o, dict)]}
    yield _step(2, f"{len(ops)} change(s) planned." if ops else "No change needed.", True)

    applied: list[str] = []
    skipped: list[dict[str, str]] = []
    if ops:
        snapshot(dash)
        yield _step(3, "Each new or changed widget is validated, run, repaired if needed and reviewed against its real result.")
        yield from _run_ops(editor, ops, applied, skipped)
        if skipped and not applied or any("unknown" in s["reason"] for s in skipped):
            # self-correction: show the model what failed and the ids that do exist, once
            listing, _ = _describe(dash_id)
            errors = "\n".join(f'- {s["title"]}: {s["reason"]}' for s in skipped)
            fix = (f"\n\nYour previous ops partly failed:\n{errors}\nAlready applied: {applied or 'nothing'}.\n"
                   "Reply with ONLY the ops still needed, using the widget ids listed above.")
            try:
                retry = ask_json(EDIT_SYSTEM, _prompt(dash, editor, listing, editor.context, history, instruction) + fix, provider_id, "ops", step=3)
            except Exception:   # self-correction is best effort: keep what was applied
                retry = {}
            again = [o for o in retry.get("ops", []) if isinstance(o, dict)] if isinstance(retry.get("ops"), list) else []
            if again:
                yield {"type": "op", "op": "retry", "status": "ok", "text": f"Self-correcting: retrying {len(again)} change(s) with the errors shown to the AI"}
                skipped.clear()
                yield from _run_ops(editor, again, applied, skipped)
        yield _step(3, f"{len(applied)} applied" + (f", {len(skipped)} skipped." if skipped else "."), True)

        yield _step(4, "Checking the page layout for overlaps.")
        moves = resolve_overlaps(editor.index, editor.touched)
        for wid, y in moves:
            editor._set_pos(wid, {**editor.index[wid]["widget"]["position"], "y": y})
        yield _step(4, f"Fixed {len(moves)} overlapping widget(s)." if moves else "Layout is clean.", True)

    nxt = [str(s)[:140] for s in plan.get("next", []) if s][:3] if isinstance(plan.get("next"), list) else []
    yield {"type": "done", "message": str(plan.get("message") or ("Done." if applied else "Nothing to change.")), "applied": applied,
           "skipped": skipped, "page": editor.touched, "next": nxt, "can_undo": bool(applied)}
