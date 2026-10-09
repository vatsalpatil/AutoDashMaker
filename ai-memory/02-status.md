# 02 — Status (hot file; edit in place)  · Last updated: 2026-10-01

Authoritative per-feature checklist vs spec: `../PROGRESS.md` (✅/🔶/⬜ with § refs). Summary below.

## Done (high level)
Connectors (files, Postgres, MySQL, SQLite, REST, Google Sheets, URL) · schema profiling · cross-source blending + relationships ·
SQL+Polars transform pipelines → derived datasets · multi-provider AI (Ask, SQL assistant) · semantic layer + verified queries + feedback ·
read-only SQL guard · quality scoring · lineage · charts · dashboards (12-col grid, multi-page, generate-from-schema) · "Why?" engine ·
alerts + in-app notifications · decision briefs · freshness tracking.

## Added in the 2026-10-02 improvement run (see 06-improvement-plan.md)
Engine tuning + query timeout + result cache · opt-in auto-refresh + source health + HTTP retry (GET only) · audit log (`/api/audit`) ·
"What needs my attention" (`/api/attention` + Ask-page panel) · ingest service extraction · tests in `backend/tests/`.

## Added 2026-10-02 (UI transformation run)
Chart studio (12 types, 70+ schema-driven options, 24 templates, pivot, live preview, thumbnails) · Ask analyst (all tables, chart, summary, follow-ups, clarify, actions) · ReUI Data Grid · shadcn Sidebar shell (mobile drawer, lazy routes) · 15-preset theme system + Inter · SelectField on shadcn Select · notebook cell actions (Fix/Explain/Optimize/Convert) · CSV/JSON export.

## Added 2026-10-04
Visual Query Builder at `/builder` (plan §102) with AI: describe-to-build, edit by chatting (instant rules for simple wording, model for the rest), formula writer/fixer, plain-English explain, undo. Next: pivot, union, save/share builder questions, join match-rate preview, 'suggest next step' chips from the result.

## In progress
- Dashboard editor polish (drag/resize, widget toolbar, fullscreen, sections) — largely working per PROGRESS.md.
- Trend/anomaly detection is partial (z-score only; trends only on time-ordered data).

## Next / not started (UI)
Pending list (updated 2026-10-03, evening). DONE since the last list: AI dashboards (create + chat edit), KPI exact-value hover + percentage option, API Studio (REST/GraphQL/WebSocket/JSON lab, curl import, environments, history, save as dataset/source), GraphQL source type, CodeMirror editor component, agent-style Workbench AI assistant (`/ai/agent`, features/workbench/agent), instant SQL lint checks for Optimize/Explain, JSON Compare tab (`diffJson`), starred (saved) requests, All-pages pagination (`/studio/pages`), SSE panel (`/studio/stream`), JSON Schema tab (`lib/jsonSchema.ts`), AI Explain (`/studio/explain`), scheduled Reports page (`/reports`), in the studio history, Workbench SQL cells on CodeMirror (completion from `GET /api/datasets/columns`).
STILL TO DO:
1. API Studio extras left: Socket.IO/MQTT only.
2. NL→SQL eval: `backend/tests/eval_nl2sql.py` written (20 cases, run on demand vs a live server); first run 1/6, CLARIFY-echo bug fixed, re-run blocked by the OpenRouter free daily limit. Warehouse connectors (BigQuery/Snowflake/ClickHouse) not built: need credentials + heavy deps; Postgres-compatible warehouses (Redshift, Supabase, CockroachDB) already work via the postgres connector. Auth + per-user isolation done (D23); roles/quotas not built.
3. Light-mode: studio, charts list and chart studio checked OK; Workbench cell colours tokenised; Transform/Relationships/Why panels still unchecked visually.
USER-ONLY: purge `backend/data/*.duckdb` from git history (holds the OpenRouter key; needs their approval) and rotate the key. The user's dev server runs on 5174 (restart after config changes); my test server was on 5175.

## Next / not started (platform)
Dashboard filters, sharing · model routing (cheap vs strong) · MCP/agent API · query cost estimate · UI for audit log + source health ·
persist refresh backoff across restarts · persistent engine connection / Store connection reuse (each metadata write opens a connection, ~50 ms) · eval benchmark for NL→SQL · semantic-model versioning · scheduled reports · per-user quotas/admin role (auth + per-user isolation DONE 2026-10-07) · background jobs/embeddings.

## Known bugs / risks
- (fixed 2026-10-01) `services/alerts.py::evaluate_alert` crashed with "cannot access local variable 'value'" — see changelog.
- OPEN (needs user decision): `backend/data/*.duckdb` are tracked in git history (baseline + M1-M5b commits) and `metadata.duckdb` holds an AI provider API key. No remote exists, so nothing has leaked; purge history before ever pushing (a history rewrite was declined by the permission system, so it was left for the user).
- (fixed 2026-10-02) vite proxy now defaults to 8000 to match `python backend/main.py`; override with API_TARGET.
- Git repo exists since 2026-10-02 (branch improve/autonomous, tag baseline-before-improvements). Tests are plain scripts in backend/tests/ (no pytest, no CI).

## Deployed (2026-10-07)
Dokploy on Oracle (backend + frontend Nixpacks, self-hosted Supabase). Branch Dashtor_First. Open: replace the exposed Oracle SSH key; live sign-up untested; per-user disk quota; Supabase email (SMTP).

## 2026-10-08 (late)
Metrics hub redesigned (live values, builder, suggestions). Settings is tabbed (AI/Appearance/System/Backup). Backend now runs from `backend/.venv` (3.12) - restarted by me after the old global-Python worker wedged. Disk is 91% full vs the 80% upload limit: set `DISK_USAGE_LIMIT_PCT=95` in `backend/.env` or free space (tests + uploads fail otherwise). Metrics/dimensions are not yet used by charts/alerts selectors (only Ask + the hub).

## 2026-10-09 Email + mobile verification
Built and tested (`tests/test_verify.py`). NOT live-tested with real delivery: needs `SMTP_*` and `SMS_PROVIDER=twilio` + `TWILIO_*` in the server env, then `VERIFICATION_REQUIRED=true`. UI never seen against a real Supabase login (gate only mounts when auth is on). Settings page has no "Account" tab yet (another session had uncommitted edits to SettingsPage.tsx).
