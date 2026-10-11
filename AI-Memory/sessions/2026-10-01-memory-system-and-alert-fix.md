# Session: 2026-10-01 — memory system setup + startup/alert fixes
Tool/AI: Claude Code

## Goal
Get backend running (missing `pydantic_settings`), fix failing alert job, then create a cross-AI project memory system.

## What changed
- Global C:/Python314: installed `backend/requirements.txt` (side effect: fastapi/starlette downgraded to pinned versions).
- `backend/app/services/alerts.py:37` — `value = float(result["rows"][0][result["columns"][0]])` (was `float(value)` → UnboundLocalError).
- Created `AI.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` (thin pointers), `ai-memory/` (00–05 + sessions/).

## Decisions
- D7 in 03-decisions.md (tiered, budgeted memory; research basis: Cline Memory Bank, AGENTS.md best-practice guides).

## Open items / next steps
- Alert fix not run against a live server yet; confirm `server_err.log` stops showing it.
- Consider switching VS Code interpreter to `backend/.venv` and aligning `main.py` port 8000 → 8001.
- Memory files 00/01/02 were written from a structural scan (file names, routes, tables, PROGRESS.md), not a full code read;
  frontend component purposes are inferred from names — correct them when you open those files.
