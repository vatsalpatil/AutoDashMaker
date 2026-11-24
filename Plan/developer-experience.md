# Developer experience plan: how Dashtor should be shaped

Written 2026-11-24 after a full test campaign on the live site. Every point comes from friction actually hit in this
codebase, checked against current guidance (sources at the end). Ordered by value per effort: do them top-down, each one
is a separate, shippable change.

## Where it hurts today (measured)

| Symptom | Number | Cost to a developer |
|---|---|---|
| Services in one flat folder | 88 files in `backend/app/services` | Hard to see what belongs to what; names like `dash_ai`, `dash_gen`, `dash_plan`, `dash_pages`, `dash_profile`, `dash_critic` are a package pretending to be files |
| Imports done inside functions to dodge import cycles | 113 | Cycles are hidden, not removed; errors show up at runtime, not at start-up |
| Untyped storage calls (`store.list("datasets")` → `dict`) | 133 | No autocomplete, typos in table/column names fail at runtime, the same "columns of dataset X" query is written many times |
| Frontend API types written by hand (`lib/types/*`) | every endpoint | Backend changes silently drift from the UI (e.g. a new `auto_links` field had to be added twice) |
| Tests are scripts with asserts and hand-made temp env | 63 files, ~100 s, serial | No fixtures, no parallel run, a failure stops the file, every test repeats 4 lines of setup |
| One DB read per dataset in loops (N+1) | rel_suggest, metrics.suggestions, blend_many | Fine at 20 datasets, slow at 500 |
| SQL dialect bugs found only in production | parser was generic, not DuckDB (fixed) | Need a test that runs real queries end to end |

What is already good and must stay: `Scripts/verify.py` (one command, safe-to-deploy verdict), the read-only SQL guard
in one place (`core/security.py`), tenant isolation via ContextVar, per-thread DuckDB cursors + one write lock (exactly
DuckDB's documented pattern), the 250-line file rule and the AI-Memory folder.

## 1. Domain packages instead of a flat services folder (modular monolith)

Group by business area, not by technical layer. Each package owns its router, request/response schemas, service code and
tests; other packages may only import its `api.py` (public functions), never its internals.

```
backend/app/
  core/            config, security (SQL guard), tenant, store, engine   <- shared kernel, imports nothing above it
  domains/
    data/          datasets, sources, connectors, uploads, column_stats, quality, quality_rules, rel_suggest, blend_many
    query/         queries, compose, qb, sql_errors, value_guard, dialects, names
    semantic/      metrics, semantic, glossary, relationships context
    dashboards/    dashboards, charts, dash_* (generator = one sub-package), shares
    ai/            providers, ai, ai_stream, analyst, agent, complete, memory
    monitor/       alerts, reports, notifications, scheduler
    admin/         admin, quota, audit, account
  main.py          includes each domain's router
```

How to get there without a big-bang: move one domain per PR, leave a one-line re-export at the old path
(`from app.domains.monitor.alerts import *`) until callers are updated, delete the shims at the end. Add an import rule
check to `verify.py` (domains may import `core` and other domains' `api.py` only); cycles then fail the build instead of
being hidden by 113 local imports.

## 2. Typed records at the storage edge

Keep the generic store (it works and is tenant-aware) but stop passing raw dicts around:

- One Pydantic model per table (`Dataset`, `ColumnMeta`, `Alert`, ...) in its domain's `models.py`.
- A tiny repository per domain: `datasets.get(id) -> Dataset`, `datasets.columns(ids) -> dict[id, list[ColumnMeta]]`
  (one query for many datasets — removes the N+1 loops above).
- Routers return these models, so FastAPI's OpenAPI schema describes real fields (needed for step 3).

## 3. Generate the frontend API client from OpenAPI

FastAPI already publishes `/openapi.json`. Generate types + a typed SDK into `frontend/src/client` with Hey API
(`@hey-api/openapi-ts`, the generator FastAPI's own docs point to), and add it to `verify.py`:
`generate → git diff --exit-code` fails when someone changed the backend without regenerating. Give every route an
`operation_id` (FastAPI `generate_unique_id_function`) so method names read `listDatasets()`, not `datasets-list_datasets`.
Then delete `lib/types/*` piece by piece.

## 4. Tests on pytest with shared fixtures

- `conftest.py` fixtures: `tmp_workspace` (temp METADATA/ANALYTICS/UPLOAD dirs, set before app import), `make_dataset(rows)`
  (creates the DuckDB table + dataset + column stats in one call), `client` (TestClient, auth on/off), `fake_ai(replies)`.
- Keep the scripts runnable meanwhile (pytest collects plain `assert` files); convert as files are touched.
- Run with `pytest -n auto` (pytest-xdist): each worker gets its own temp workspace, so the 100 s suite should drop to
  roughly the slowest few files.
- Add a "real SQL" test set: a folder of `.sql` files with expected results run through `validate_readonly` + DuckDB.
  It would have caught today's dialect bug (list index and regexp arguments silently changed).

## 5. Backend performance, where it will matter

- Batch metadata reads (step 2) — the main cost once accounts have hundreds of datasets.
- Cache column stats and profiles per dataset version (already done for profiles: make it the one pattern, keyed by
  `dataset_id + refreshed_at`).
- Stream large exports with DuckDB `COPY (validated select) TO file` instead of building Python rows (reports are capped
  at 250k rows because every row becomes a dict today).
- Keep the single-process writer: DuckDB does not support writes from several processes; scale reads with threads and
  per-thread cursors (current design), and move scheduled jobs (alerts, reports) to their own worker process only if one
  machine stops being enough.
- Measure before optimizing: log per-endpoint p50/p95 (a middleware already sees every request) and show it in Admin →
  Monitor.

## 6. Day-to-day ergonomics

- `make dev` / `dev.ps1`: start backend + frontend with one command; `make check` = `verify.py`.
- Ruff (lint + format) and mypy on `core/` and new domain code, run in `verify.py`; pre-commit hook for the fast ones.
- Error contract: every 4xx carries `{code, message, hint}` (`code` stable, e.g. `quota.datasets`, `sql.parse`) so the UI
  can react to codes instead of parsing English; status codes by meaning (dataset limit is 409/403, not 507).
- Seed command: `python Scripts/seed_demo.py` loads the 10 demo projects used in testing (sales, HR, web, inventory,
  finance, healthcare, education, logistics, SaaS, marketing, IoT) into a local workspace in seconds.
- Architecture decision records stay in `AI-Memory/03-decisions.md`; add one line per domain in `01-architecture.md`.

## Suggested order

1. pytest fixtures + parallel run (fast feedback for everything after) — 1 day
2. OpenAPI client generation + drift check — 1 day
3. Typed models + batched repositories for `data` domain — 2 days
4. Domain packages, one per PR, starting with `monitor` (smallest) then `data` — 1 week in slices
5. Error contract + COPY-based exports + endpoint timing — 2 days

## Sources

- FastAPI docs, Generating SDKs: https://fastapi.tiangolo.com/advanced/generate-clients/
- Hey API openapi-ts: https://npmjs.com/package/@hey-api/openapi-ts
- FastAPI best practices (domain packages): https://github.com/zhanymkanov/fastapi-best-practices via https://auth0.com/blog/fastapi-best-practices/
- Modular monoliths with FastAPI: https://amal-babu-git.github.io/blog/coding-and-development/building-scalable-modular-monoliths-fastapi
- DuckDB, multiple Python threads: https://duckdb.org/docs/guides/python/multiple_threads
- DuckDB concurrency: https://duckdb.org/docs/connect/concurrency
