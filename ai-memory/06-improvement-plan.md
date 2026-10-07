# 06 — Improvement plan (started 2026-10-02, autonomous overnight run)

**Goal (from spec §1, §99):** trustworthy "what needs my attention today?" platform; lean on 4 CPU / 20 GB (§55);
better source connectivity. Research basis: DuckDB OOM/tuning guide (set `threads`, `memory_limit` <80%,
`preserve_insertion_order=false`, spill dir), semantic/result caching (§53), text-to-SQL = semantic layer + validation.

## REVERT (if you don't like the result)
- Everything is on git branch `improve/autonomous`; baseline = tag `baseline-before-improvements` (branch `main`).
- Undo all:  `git checkout main`  (code returns to baseline; branch kept for reference)  — or hard reset: `git reset --hard baseline-before-improvements`
- Undo one step: `git revert <commit>` (each milestone below = its own commit `M<n>: ...`).
- Data safety: copies of `backend/data` + `backend/uploads` made before any change in `_backups/baseline-2026-10-02/`
  (restore by copying them back over `backend/data` and `backend/uploads` with the server stopped).

## Milestones (tick when committed; each verified before ticking)
- [x] M1 Engine: DuckDB resource limits (config), query timeout+interrupt, result cache w/ invalidation, 1-query `describe_table`
- [x] M2 Connectivity: auto-refresh scheduler (by `expected_interval_minutes`), `/api/sources/health`, retry on network connectors
- [x] M3 Audit log (§58): table + middleware-free logging of query runs/ingests + `/api/audit`
- [x] M4 North-star: `/api/attention` aggregator (stale data, triggered alerts, low quality, brief findings) + UI panel on Ask page
- [x] M5 Review pass: simplify, code-review, security-review skills; fix findings; update PROGRESS.md + ai-memory
- [x] M6 Final verification: backend boot, API smoke tests, `npm run build`

## Rules for this run
Small commits · verify before each tick · never touch `backend/data` by hand · no new heavy deps (no Redis/Celery: in-process only) ·
if a milestone fails verification: revert that commit, log why in 04-gotchas.md, move on.

## Log (newest last)
- 2026-10-02 baseline committed (fbdb2c9, tag baseline-before-improvements); branch improve/autonomous created.
- 2026-10-02 M1-M5b committed (see git log). Open: data .duckdb files tracked in git history (API key) - needs user decision; security-review + final verification done (security-review skill could not run: repo has no origin remote; manual security pass done instead).
