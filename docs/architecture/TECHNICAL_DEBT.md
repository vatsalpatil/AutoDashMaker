# Technical Debt Register (audit 2026-11-18)

Evidence-based only. Commands used: `python Scripts/check_file_sizes.py`, grep-based import scan of `backend/app/services/*.py`.

## Critical
| # | Issue | Evidence | Note |
|---|---|---|---|
| C1 | Production down; single host, no failover | `AI-Memory/02-status.md` "OUTAGE 2026-11-13" (Oracle instance deleted, data on boot volume) | Ops, not code. Needs restore runbook + off-host backup of `/app/data`. |
| C2 | `.duckdb` files tracked in git history; `metadata.duckdb` held an AI key | `02-status.md` "Known bugs / risks"; `git status` shows untracked `backend/data/` | History purge still pending (user decision). |

## High
| # | Issue | Evidence |
|---|---|---|
| H1 | Loose dependency pins: only fastapi/uvicorn exact; `psycopg2-binary` unpinned; duckdb `>=1.1.0` | `backend/requirements.txt` — a DuckDB minor bump changes SQL/Parquet behaviour silently on rebuild (`backend/Dockerfile` reinstalls each build) |
| H2 | No lockfile/CI gate on server; deploy = push to `Dashtor_First` | `AI-Memory/00-overview.md` "Git workflow"; verify is local-only (`Scripts/verify.py`) |
| H3 | Proxy trusts all forwarded IPs | `backend/Dockerfile` CMD `--forwarded-allow-ips='*'` — client IP (used by monitoring/rate limits) is spoofable if backend port is reachable without Caddy. (Security agent in progress.) |
| H4 | Engine module at size limit and carries 4 locks + cache + flight de-dup in one class | `backend/app/services/engine.py` 397 lines; locks at lines 41-49. (Perf agent in progress.) |
| H5 | NL->SQL quality unmeasured | `backend/tests/eval_nl2sql.py` exists, last recorded run 1/6 (`02-status.md` line 32); not part of verify |

## Medium
| # | Issue | Evidence |
|---|---|---|
| M1 | Oversize test file (> hard 400) | `backend/tests/test_dash_gen.py` 473 |
| M2 | Files over 250-line budget | `services/ai.py` 292, `services/remote.py` 279, `services/qb/compiler.py` 278, `services/qb/sql_import.py` 277, `services/qb/rules.py` 256, `frontend/src/lib/theme.ts` 277, `frontend/src/features/dashboards/useDashboardPage.ts` 265, `frontend/src/index.css` 293, `tests/test_auth_hardening.py` 352 |
| M3 | Tests are plain scripts, no runner/coverage | `backend/tests/*.py` (44 files, 0 `def test_` pytest-style functions found by grep); no coverage metric |
| M4 | Frontend has only pure-logic tests; no component/E2E tests | `frontend/tests/` 15 `*.test.ts`, `package.json` `"test": "node --test tests/*.test.ts"`; Ask/dashboard UI flows untested |
| M5 | Fragmented AI service surface (15+ `ai_*`/`dash_*` modules) | `backend/app/services/ai*.py`, `dash_*.py` (14 dash modules) — hard to trace one request; needs a flow doc (see AS_IS) |
| M6 | Metadata in single-file DuckDB (single writer) for a multi-user hosted app | `core/store.py`; audit uses a dedicated single-writer thread (`services/audit.py`) to work around it |

## Low
| # | Issue | Evidence |
|---|---|---|
| L1 | `faster-whisper` in core requirements inflates backend image for an optional voice feature | `requirements.txt`, `services/voice.py` |
| L2 | `three` shipped for landing only (lazy) | `frontend/package.json`, `features/landing` |
| L3 | Generated eval artefact committed beside tests | `backend/tests/eval_report.json` |

## Dead code / duplicates scan
- Import scan of every `backend/app/services/*.py` module: all referenced at least once (e.g. `agent_parse`, `http_proxy`,
  `sql_lint`, `copy_worker` each have 1 importer). **No dead service modules found.**
- No duplicated route prefixes found beyond the intentional pre-mount of `routers/metrics.py` before `semantic.py`
  (documented in `AI-Memory/01-architecture.md`).

## Missing tests (highest value)
1. Ask end-to-end against fixture data (`routers/ai_chat.py` -> `services/analyst.py`) with a stub provider.
2. `POST /api/dashboards/{id}/data` param batching (`routers/dashboards.py:62`).
3. Ingestion of each file type through `columnar.publish` + quota rejection.
4. Frontend: Ask chat, dashboard filter/params, layout editor undo (`features/dashboards/layoutEditor/useLayoutHistory`).
