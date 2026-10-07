# AI.md — READ THIS FIRST (any AI: Claude, Codex, ChatGPT, Gemini, Antigravity, Cursor, Copilot…)

**Project:** AutoDashMaker — AI-native data analytics platform (FastAPI + DuckDB + React/TS).
This repo keeps a curated **project memory** in [`ai-memory/`](ai-memory/README.md) so you do NOT
need to crawl the codebase. Reading memory costs ~3-5k tokens; crawling costs 50k+.

## Start-of-chat protocol (do this before anything else)
1. Read `ai-memory/00-overview.md` (what/stack/run/rules — always).
2. Read `ai-memory/02-status.md` (what is in progress, what is next, known bugs — always).
3. Read ONLY what the task needs (see the routing table in `ai-memory/README.md`):
   - touching code layout/API/DB → `01-architecture.md`
   - confused by a past choice → `03-decisions.md`
   - stuck / odd error → `04-gotchas.md`
   - "what did we do last time?" → tail of `05-changelog.md`, then `sessions/`
4. Then open source files **by the path listed in the architecture map**. Use grep, not browsing.

## End-of-response protocol (MANDATORY after every task that changes anything)
Before you give your final answer, update memory (details: `ai-memory/README.md` → "Update rules"):
- **Always:** append ONE line to `ai-memory/05-changelog.md` (date · files · what/why).
- **If status changed** (feature done/started, bug found/fixed): edit `02-status.md` in place.
- **If structure changed** (new/renamed file, route, table, page, dependency): edit `01-architecture.md`.
- **If you made a non-obvious choice** or hit a trap: add to `03-decisions.md` / `04-gotchas.md`.
- **Big or multi-step session:** also create `ai-memory/sessions/YYYY-MM-DD-<topic>.md` from `_TEMPLATE.md`.
- Edit facts **in place** (never duplicate, never append contradictions). Delete what is no longer true.
- Pure Q&A / no files changed → no update needed.
- Chat-only AI with no file access (e.g. ChatGPT web)? End your answer with a
  "MEMORY UPDATE" block containing the exact text to paste into the files above.

## Never read (wasted tokens — generated, binary, huge, or irrelevant)
`backend/.venv/` · `frontend/node_modules/` · `frontend/dist/` · `**/__pycache__/` ·
`backend/data/*.duckdb` · `backend/uploads/` · `backend/server*.log` (grep only) ·
`frontend/package-lock.json` · `frontend/tsconfig.tsbuildinfo` · `.vscode/` ·
`Plan/*.exe`, `Plan/*.json` (unrelated) · `Plan/smart-data-platform-requirements.md` (1000+ lines —
grep for a `§` number only when asked about the spec; `PROGRESS.md` maps features → §).

## Hard rules for this repo
- Every SQL reaching DuckDB goes through `backend/app/core/security.py::validate_readonly`. Never bypass it.
- Python deps: use `backend/.venv` (not the global interpreter). Pinned in `backend/requirements.txt`.
- Never commit/echo secrets (`backend/.env`, API keys in the `ai_providers` table).
- Keep memory files short (budgets in `ai-memory/README.md`). Accuracy beats completeness.
- **Reuse before writing; small files.** Check `hooks/`, `components/common/`, `features/`, `services/` first; never copy a pattern twice — extract it. Hand-written files ≤ 250 lines (hard 400); pages stay thin. Verify with `python scripts/check_file_sizes.py`. Full rules: `ai-memory/00-overview.md` → "Code structure & reuse rules".
- UI primitives are shadcn (Base UI) + ReUI and are generated — add via the shadcn CLI, don't hand-edit `components/ui` or `components/reui`. Use theme tokens, not hard-coded colours.
