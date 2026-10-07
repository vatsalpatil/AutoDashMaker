"""Workbench agent (Roo Code / Cline style): the model plans one step at a time and calls tools; deterministic code runs them.

Server tools only ever read: list_tables, describe_table, sample_rows, run_sql (every query goes through the engine, i.e. through
`validate_readonly`). Notebook tools (add_cell, edit_cell) are never executed here: they are streamed to the browser as proposals,
which the user applies (or auto-approves). Each step is yielded as an event so the UI shows the work as it happens.
"""
from __future__ import annotations

import json
import re
import time
from decimal import Decimal
from typing import Any, Iterator

from ..core.security import UnsafeQueryError
from ..core.store import store
from . import ai as ai_svc
from .dash_ai import json_objects
from .engine import engine

MAX_STEPS = 8
OBS_CHARS = 2400          # how much of a tool result the model sees
PREVIEW_ROWS = 10         # rows shown to the user per observation

SYSTEM = """You are a data analyst agent inside a SQL notebook (DuckDB dialect). Work step by step with tools, like a careful engineer.
Reply on EVERY turn with exactly ONE JSON object and nothing else:
{"thought": "<one short sentence>", "tool": "<tool name>", "args": {...}}

Tools:
- list_tables {}                              the tables you may query, with row counts
- describe_table {"table": "<name>"}          columns and types
- sample_rows {"table": "<name>", "n": 5}     a few rows to see real values
- run_sql {"sql": "SELECT ..."}               run a read-only query; returns the first rows. Use it to check a query before you answer
- add_cell {"sql": "SELECT ...", "run": true}   (agent mode only) add a notebook cell below the active one
- edit_cell {"sql": "SELECT ...", "run": true}  (agent mode only) rewrite the active cell
- final {"answer": "<markdown answer for the user>", "sql": "<best query, optional>"}   finish

Rules:
- Only SELECT / WITH queries. Use the exact table and column names from the context; never invent columns. Tables may be referenced by the names listed.
- If a query fails, read the error and fix it in the next step. Verify results with run_sql before you call final.
- Prefer few steps (at most %d). Keep "thought" short. When the user only asks a question, answer it with final; add_cell/edit_cell are for when they want work done in the notebook.
- The final answer is for a human: say what you found in plain words (numbers included), then mention the query used. No JSON in the answer."""


def _label(d: dict) -> str:
    """The name to show / query: the dataset's own name when unique (SQL accepts it), else its physical table."""
    return d["name"]


def context(active_sql: str, error: str | None, cells: list[dict], mode: str) -> str:
    cols: dict[str, list[str]] = {}
    for c in store.list("columns_meta", order=None):
        cols.setdefault(c["dataset_id"], []).append(f"{c['name']} {c['dtype']}")
    lines = []
    for d in store.list("datasets", order=None):
        if not d.get("physical_name"):
            continue
        c = cols.get(d["id"], [])
        lines.append(f"- {_label(d)} [{d.get('row_count', '?')} rows]: {', '.join(c[:30])}{' …' if len(c) > 30 else ''}")
    text = "Tables:\n" + "\n".join(lines)[:6000]
    steps = [f"- {c.get('name')}: {str(c.get('sql', '')).strip()[:300]}" for c in cells[:12] if c.get("name") and str(c.get("sql", "")).strip()]
    if steps:
        text += "\n\nEarlier notebook steps (query them by name like tables):\n" + "\n".join(steps)
    if active_sql.strip():
        text += f"\n\nActive cell SQL:\n{active_sql.strip()[:1500]}"
    if error:
        text += f"\n\nActive cell error:\n{error[:600]}"
    text += f"\n\nMode: {mode}. " + ("You may use add_cell and edit_cell." if mode == "agent" else "Read-only: do not use add_cell / edit_cell; answer with final (include the query in `sql`).")
    return text


def _rows_text(result: dict[str, Any]) -> str:
    cols = result["columns"]
    head = ", ".join(cols)
    body = "\n".join(" | ".join(str(r.get(c)) for c in cols) for r in result["rows"][:PREVIEW_ROWS])
    return f"{result['row_count']} rows. Columns: {head}\n{body}"[:OBS_CHARS]


def _plain(rows) -> list[dict[str, Any]]:
    """Preview rows as JSON-friendly values (DuckDB decimals become numbers, not strings)."""
    return [{k: float(v) if isinstance(v, Decimal) else v for k, v in r.items()} for r in list(rows)[:PREVIEW_ROWS]]


def _table(name: str) -> dict | None:
    key = str(name).strip().strip('"').lower()
    for d in store.list("datasets", order=None):
        if key in (d["name"].lower(), (d.get("physical_name") or "").lower()):
            return d
    return None


def _quote(name: str) -> str:
    return name if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) else '"' + name.replace('"', '""') + '"'


def _tool(tool: str, args: dict[str, Any], mode: str) -> tuple[bool, str, dict[str, Any]]:
    """Run one server-side tool -> (ok, text for the model, extra event fields for the UI)."""
    try:
        if tool == "list_tables":
            ds = [d for d in store.list("datasets", order=None) if d.get("physical_name")]
            return True, "\n".join(f"- {_label(d)} ({d.get('row_count', '?')} rows)" for d in ds), {}
        if tool == "describe_table":
            d = _table(args.get("table", ""))
            if not d:
                return False, f"unknown table {args.get('table')!r}. Use list_tables.", {}
            cols = [f"{c['name']} {c['dtype']}" for c in store.list("columns_meta", where="dataset_id = ?", params=[d["id"]], order=None)]
            return True, f"{_label(d)}: {', '.join(cols)}", {}
        if tool == "sample_rows":
            d = _table(args.get("table", ""))
            if not d:
                return False, f"unknown table {args.get('table')!r}. Use list_tables.", {}
            n = min(max(int(args.get("n") or 5), 1), 10)
            r = engine.execute(f"SELECT * FROM {_quote(_label(d))} LIMIT {n}", row_limit=n)
            return True, _rows_text(r), {"columns": r["columns"], "rows": _plain(r["rows"])}
        if tool == "run_sql":
            sql = str(args.get("sql", "")).strip()
            if not sql:
                return False, "run_sql needs a sql argument", {}
            r = engine.execute(sql, row_limit=200)
            return True, _rows_text(r), {"columns": r["columns"], "rows": _plain(r["rows"]), "row_count": r["row_count"], "ms": r["duration_ms"]}
    except UnsafeQueryError as e:
        return False, f"blocked: {e}. Only read-only SELECT queries are allowed.", {}
    except Exception as e:  # SQL errors go back to the model so it can repair the query
        return False, str(e)[:700], {}
    return False, f"unknown tool {tool!r}", {}


def _decide(messages: list[dict], provider_id: str | None) -> dict[str, Any] | None:
    """The model's next move: the last JSON object that names a tool; None if it answered in prose."""
    raw = ai_svc.chat(messages, provider_id=provider_id, max_tokens=3000)
    for obj in reversed(json_objects(raw)):
        if isinstance(obj.get("tool"), str):
            return obj
    prose = ai_svc._THINK.sub("", ai_svc._ANSI.sub("", raw)).strip()
    return {"tool": "final", "args": {"answer": prose}, "thought": ""} if prose and "{" not in prose[:2] else None


def run(task: str, history: list[dict], mode: str, ctx: str, provider_id: str | None = None) -> Iterator[dict[str, Any]]:
    """Yield events: step / observation / action / final / error."""
    t0 = time.time()
    messages: list[dict] = [{"role": "system", "content": SYSTEM % MAX_STEPS + "\n\n" + ctx}]
    for h in history[-8:]:
        if h.get("role") in ("user", "assistant") and str(h.get("content", "")).strip():
            messages.append({"role": h["role"], "content": str(h["content"])[:3000]})
    messages.append({"role": "user", "content": task})
    nudged = False
    last_sql: str | None = None

    for n in range(1, MAX_STEPS + 1):
        try:
            move = _decide(messages, provider_id)
        except ai_svc.AIError as e:
            yield {"type": "error", "message": str(e)}
            return
        if move is None:
            if nudged:
                yield {"type": "error", "message": "The model did not return a usable step. Try again or pick another model in Settings → AI models."}
                return
            nudged = True
            messages.append({"role": "user", "content": "Reply with ONLY the JSON object {\"thought\", \"tool\", \"args\"}."})
            continue
        tool, args, thought = move["tool"], move.get("args") if isinstance(move.get("args"), dict) else {}, str(move.get("thought", ""))[:400]
        yield {"type": "step", "n": n, "thought": thought, "tool": tool, "args": args}

        if tool == "final":
            sql = args.get("sql") or last_sql
            yield {"type": "final", "text": str(args.get("answer", "")).strip() or "Done.", "sql": sql, "seconds": round(time.time() - t0, 1)}
            return
        if tool in ("add_cell", "edit_cell"):
            sql = str(args.get("sql", "")).strip()
            if mode != "agent":
                obs = "Not allowed in ask mode. Put the query in the final answer instead."
                yield {"type": "observation", "n": n, "ok": False, "text": obs}
            elif not sql:
                obs = f"{tool} needs a sql argument"
                yield {"type": "observation", "n": n, "ok": False, "text": obs}
            else:
                last_sql = sql
                yield {"type": "action", "n": n, "kind": tool, "sql": sql, "run": bool(args.get("run", True))}
                obs = "Proposed to the user; the notebook is updated on their side. Continue or call final."
                yield {"type": "observation", "n": n, "ok": True, "text": obs}
        else:
            if tool == "run_sql":
                last_sql = str(args.get("sql", "")).strip() or last_sql
            ok, obs, extra = _tool(tool, args, mode)
            yield {"type": "observation", "n": n, "ok": ok, "text": obs[:900], **extra}
        messages.append({"role": "assistant", "content": json.dumps({"thought": thought, "tool": tool, "args": args})[:2000]})
        messages.append({"role": "user", "content": "Observation: " + obs})

    yield {"type": "final", "text": "I ran out of steps before finishing. Here is where I got to; ask me to continue if you want more.", "sql": last_sql,
           "seconds": round(time.time() - t0, 1)}
