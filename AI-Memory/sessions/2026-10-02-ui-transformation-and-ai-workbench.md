# Session: 2026-10-02 — Improvement run → ReUI/shadcn UI transformation, chart studio, analyst Ask
Tool/AI: claude (Claude Code desktop). Branch `improve/autonomous`; revert points: tags `baseline-before-improvements`, `pre-ui-migration`. `git log baseline-before-improvements..HEAD` = ~50 commits, one per step.

## Goal (user's requests in order)
1. Make `AI.md` + `ai-memory/` so any AI resumes cheaply; then improve the product autonomously from the plan, reversibly.
2. Redesign Settings AI section like OpenCode (provider + model picker, only connected providers, stats, models).
3. AI assistant must build complex SQL, see all tables + saved queries, edit the editor directly.
4. Workbench: collapsible/resizable panels, connected edge-to-edge layout, real results table (search/filter/sort/pin/pagination), Jupyter-style multi-cell notebook where cells query earlier cells by name.
5. Replace Astryx with shadcn + Tailwind + ReUI; research Chat2DB + alternatives and adopt good features.
6. Reusable structure, no 1000-line files (≤250 lines, hard 400), do more with less code.
7. Spotted ReUI wasn't really used → ReUI-first everywhere; better theme/colours; modern, responsive, feature-rich; much stronger AI Ask; advanced chart editor with templates (charts, tables, pivots) using ReUI chart components.

## What changed (where to look; full map in 01-architecture.md)
- Backend: engine tuning/cache/timeouts, audit, attention, refresh, security; `services/{compose,dialects,assist,ai_context,analyst,chart_suggest}.py`, `routers/{ai,ai_providers,ai_chat}.py`, `PATCH /charts/{id}`; tests in `backend/tests/` (9 scripts, all pass).
- Frontend structure: `hooks/`, `components/{ui,reui,common,layout}`, `features/{workbench,charts,ask,dashboards,sources,guide,ai,settings}`, thin `pages/`, `lib/types/*`.
- Chart studio (`features/charts`): 12 types, schema-driven options, 24 templates, pivot; widgets reuse it.
- Ask (`features/ask` + `services/analyst.py`): all-table analyst, clarify, auto chart, summary, follow-ups, actions.
- UI: ReUI Data Grid, shadcn Sidebar shell (mobile drawer, lazy routes), 15 theme presets, SelectField, ReUI Alert, Activity on DataGrid, Workbench AI quick actions, notebook cell Fix/Explain/Optimize/Convert, CSV/JSON export.

## Decisions / traps (long form in 03-decisions.md D12–D16, 04-gotchas.md)
- ReUI proper = ~22 primitives; the rest of reui.io = shadcn compositions. Use primitive if exists else shadcn.
- Options are data (`optionSchema.ts`), not code. LLM decides SQL, deterministic code validates/executes/charts.
- `/queries/run` saves by default (pass `save:false`). Free models echo templates → validate prose, fall back.
- Bash heredocs mangle quotes: use Write/Edit tools. Restart the user's Vite (5174) after config changes.

## Open items / next steps
- Exactly the numbered list in `02-status.md` → "Next / not started (UI)". Start at item 1 (verify build + AI actions).
- User-only: purge `backend/data/*.duckdb` from git history + rotate the OpenRouter key.

## Verified how
- Backend: all `backend/tests/test_*.py` run with `backend/.venv/Scripts/python.exe` → OK.
- Frontend: `npx tsc -b` clean at each step; `npm run build` passed at the DataGrid commit (not re-run after later commits).
- Browser (port 5175): Ask end-to-end with the user's provider, studio (all 12 types cycled), grid, dark/light toggle, mobile 375px Ask, Sources/Metrics/Dashboards/Alerts/Activity/Settings screens.
- Not run: notebook Fix/Explain/Optimize calls, Ask summary re-check after the fallback fix, Guide/AI-settings visual pass.
