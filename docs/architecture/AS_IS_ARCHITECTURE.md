# Dashtor — As-Is Architecture (audit 2026-11-18)

Source of truth for details: `AI-Memory/01-architecture.md`. This doc is the condensed, verified view.

## Components
| Layer | Real component | Path |
|---|---|---|
| Reverse proxy / static | Caddy (`admin off`, zstd/gzip, `/api/*` + `/.well-known/oauth-*` -> backend, `flush_interval -1` for SSE, SPA fallback) | `frontend/caddy.conf`, `frontend/caddy.backoffice.conf` |
| Frontend app | Vite SPA served by Caddy | `frontend/Dockerfile` |
| Backoffice | Separate SPA build | `frontend/Dockerfile.backoffice` |
| API | FastAPI on uvicorn, python:3.12-slim, `--proxy-headers --forwarded-allow-ips='*'` | `backend/Dockerfile`, `backend/Main.py` |
| Metadata DB | DuckDB `metadata.duckdb`, generic CRUD `store` | `backend/app/core/store.py` |
| Analytics DB | DuckDB `analytics.duckdb` + Parquet files (zstd) behind VIEWs | `backend/app/services/engine.py`, `services/columnar.py` |
| Auth | Supabase JWT (hosted), `ws_default` (local) | `core/auth.py`, `core/tenant.py` |
| Deploy | Dokploy on Oracle (currently down, see `AI-Memory/02-status.md` "OUTAGE 2026-11-13") | `deploy/DOKPLOY.md` |

## Versions
Backend (`backend/requirements.txt`): fastapi==0.115.0, uvicorn[standard]==0.30.0, duckdb>=1.1.0, polars>=1.0.0,
pyarrow>=17.0.0, pydantic>=2.9.0, pydantic-settings>=2.5.0, httpx>=0.27.0, sqlglot>=25.0.0, PyJWT[crypto]>=2.8.0,
psycopg2-binary (unpinned), openpyxl>=3.1.5, faster-whisper>=1.0.3. Only fastapi/uvicorn are exact-pinned.

Frontend (`frontend/package.json`): react ^19.3.0, vite ^6.0.7, typescript ^5.7.2, tailwindcss ^4.3.3,
react-router-dom ^6.30.0, recharts ^3.8.0, @tanstack/react-table ^9.2.4, react-grid-layout ^1.5.4, three ^0.170.0.
Tests: `node --test tests/*.test.ts` (15 files in `frontend/tests/`).

## Size of the system
- `backend/app/routers/`: 35 files · `backend/app/services/`: 75 entries (incl. `qb/`, `mcp/`, `account/`, `admin/` packages).
- `backend/tests/`: 44 files (plain scripts, run by `Scripts/verify.py`, no pytest).
- `frontend/src/features/`: 20 feature folders (ai, alerts, ask, auth, charts, dashboards, datasets, docs, guide, home,
  landing, oauth, quality, query-builder, reports, settings, sources, studio, verify, workbench).

## Module dependency map (backend)
```
Main.py ── mounts routers/* ── lifespan: alerts.scheduler_loop, reports.reports_loop, refresh loop
routers/* (thin HTTP)
   ├─> services/* (logic)
   │     ├─ engine.py  (QueryEngine: DuckDB connections, result cache, locks)  <── analyst, dash_*, qb, metrics, why, brief, alerts, reports
   │     ├─ ai.py / ai_routing / ai_stream / ai_limits / ai_usage (provider layer)  <── analyst, agent, assist, dash_*, chart_suggest_ai
   │     ├─ ingest.py -> connectors/registry.py -> connectors/{files,postgres,mysql,sqlite,rest,web}.py
   │     └─ columnar.py, versions.py, data_tests.py, quality.py, lineage.py
   └─> core/ (config, store, security.validate_readonly, tenant, netguard, auth)
```
Rule (from `AI.md`): every SQL to DuckDB passes `core/security.py::validate_readonly`.

## Request flows
### Ask (NL -> answer)
1. UI `features/ask` -> `POST /api/ai/chat` (`routers/ai_chat.py:26`), empty question -> 400.
2. `services/analyst.py` builds context (semantic layer, tables), calls provider via `services/ai.py`.
3. SQL from the model -> `validate_readonly(sql, 10000)` (`analyst.py:137`); on error one AI repair through
   `assist_svc.fix_sql(..., engine.check_sql)` then re-validated (`analyst.py:143`).
4. Executed via `engine` (`analyst.py:15`); result + deterministic explanation (`services/explain.py`) returned.
5. Audit: `audit.record("ai.chat", ...)` with status ok/blocked (`ai_chat.py:38,44`).

### Query execution
`POST /api/queries/run` -> `validate_readonly` -> `QueryEngine.execute(sql,row_limit)` (`services/engine.py`):
in-flight de-dup (`_flight_lock`), LRU result cache (`_cache`, `_cache_lock`, clock/random SQL bypassed, line 20),
remote-attached sessions serialized (`_linked_lock`), writers serialized (`_write_lock`). DuckDB errors are mapped by
`services/sql_errors.py::friendly`.

### Ingestion
`POST /api/datasets/upload|ingest` -> `services/ingest.py::ingest_source` -> connector `ingest` -> staging table ->
`columnar.publish` (COPY to Parquet + VIEW) -> `datasets`/`columns_meta` rows; quotas via `services/quota.py`.
Refresh: `ingest.refresh_dataset` -> `versions.snapshot` -> `data_tests.check_after_refresh` (auto-rollback on fail).

### Dashboards
`routers/dashboards.py`: CRUD (`:40,:45`), `GET /{id}/params` (`:54`), `POST /{id}/data` batched widget data (`:62`),
`PUT /{id}/layout` (`:87`), `PUT /{id}/pages` (`:112`), widgets (`:121,:136`). AI generation is a 3-phase SSE flow in
`services/dash_*.py` (plan per page in parallel in `dash_pages.py`, build, critic/repair). Frontend state in
`features/dashboards/useDashboardPage.ts`; layout editor at `/dashboards/:id/layout`.

## In-progress elsewhere (other agents, 2026-11-18)
Security hardening, AI/semantic lineage, engine performance — not reflected here yet.
