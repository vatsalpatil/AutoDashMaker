# Implementation Roadmap (2026-11-18)

In progress by other agents (do not duplicate): **security hardening**, **AI/semantic lineage**, **engine performance**.

## P0
### P0-1 Restore production + off-host backups
- Objective/problem: site down since 2026-11-13 (`AI-Memory/02-status.md` OUTAGE); data only on one boot volume.
- Solution: recreate instance from boot volume; nightly copy of `/app/data` Parquet + `metadata.duckdb` to object storage; external uptime ping.
- Files: `deploy/DOKPLOY.md` (runbook), new `Scripts/backup.py`.
- Deps: user OCI account upgrade. Acceptance: site 200 on `/api/health`; restore drill from backup succeeds.
- Tests: restore into a fresh volume and run `Scripts/verify.py --quick`. Rollback: none needed (additive).

### P0-2 Pin backend dependencies
- Problem: `requirements.txt` ranges (duckdb `>=1.1.0`, psycopg2 unpinned) reinstalled on every Docker build.
- Solution: exact pins from the working `.venv` (`pip freeze` subset). Files: `backend/requirements.txt`.
- Acceptance: two builds produce identical versions. Tests: `Scripts/verify.py`. Rollback: revert file.

## P1
### P1-1 Sample dataset + first-run Ask
- Problem: no sample/demo data anywhere (grep empty); new users face an empty Ask.
- Solution: bundled small Parquet (e.g. sales) + "Load sample data" on Home/Sources empty state, calling existing ingest.
- Files: `backend/app/services/ingest.py` (reuse), new `routers` endpoint in `routers/datasets.py`, `frontend/src/features/home/*`, `features/sources`.
- Deps: none. Acceptance: one click -> dataset + 3 starter questions answerable. Tests: backend test ingests sample; frontend `home.test.ts` extended.
- Rollback: hide button (feature flag in `core/config.py`).

### P1-2 Ask trust card (after lineage agent lands)
- Problem: answers show SQL/explanation but not data freshness/quality/metric used.
- Solution: return `datasets[].refreshed_at`, quality score, metric id in `/api/ai/chat` payload; render a collapsible card.
- Files: `services/analyst.py`, `routers/ai_chat.py`, `frontend/src/features/ask/*`.
- Deps: AI/semantic lineage work. Acceptance: every ok answer lists tables + freshness. Tests: `tests/test_analyst.py`. Rollback: UI flag.

### P1-3 NL->SQL eval as a gate
- Problem: `tests/eval_nl2sql.py` last 1/6, not in verify. Solution: offline mode with recorded fixtures + score threshold; run in `Scripts/verify.py --eval`.
- Acceptance: score printed, regression fails. Rollback: drop flag.

## P2
### P2-1 Frontend UX test coverage
- Problem: only pure-logic tests (`frontend/tests/*.test.ts`); Ask, dashboard params, layout undo untested in a browser.
- Solution: Playwright smoke for Ask, dashboard filter, layout editor undo/redo, share link.
- Files: new `frontend/e2e/`, `package.json`. Acceptance: smoke green locally. Rollback: remove folder.

### P2-2 Split oversize files
- `backend/tests/test_dash_gen.py` (473), `services/engine.py` (397, coordinate with perf agent), `features/dashboards/useDashboardPage.ts` (265), `services/ai.py` (292).
- Acceptance: `python Scripts/check_file_sizes.py --strict` passes. Tests: existing suites. Rollback: git revert.

### P2-3 Metric-bound Ask
- Solution: if question matches a metric/synonym, compile via metric expression (`routers/metrics.py` preview logic) instead of free SQL.
- Deps: P1-2. Acceptance: metric questions return identical numbers to Metrics hub. Tests: `tests/test_analyst.py`.

## P3
- P3-1 Move `faster-whisper` to optional extra (`requirements-voice.txt`) to slim the image.
- P3-2 Remove `backend/tests/eval_report.json` from VCS (generated).
- P3-3 Evaluate metadata store move (DuckDB -> Postgres/Supabase) if concurrent hosted writes grow (`core/store.py`, `services/audit.py` single-writer workaround).
