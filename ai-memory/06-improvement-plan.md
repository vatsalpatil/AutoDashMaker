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

## Databricks AI/BI comparison (2026-10-08, from the user's Free Edition workspace, read-only)
Seen: Dashboards list (chips: Domain/Owned by me/Modified this week/Favorited/Certified/Popular, star, list/grid, sort) · dashboard = Data tab (datasets, relationships, SQL dataset, parameters, result/schema, custom calcs) + pages + global filters + Bookmarks (saved filter states) + Publish/Share + warehouse picker + refresh · Genie agents list · Alerts v2 · SQL editor/Queries/History/Warehouses. The console flags automated browsers, so research stayed read-only.
- DONE: favorites star + quick chips (All/Favorites/New this week) + favorites-first sort on Dashboards list (`useFavorites`, `QuickChips`); saved filter views per dashboard (`FilterViews`, localStorage).
- NEXT: dashboard **Data tab** (datasets a dashboard uses: schema + result preview + relationships) · same chips/favorites on Charts + Datasets lists · date-range preset filter widget · Publish/draft state · email subscriptions (scheduled reports) · "Genie spaces" (named Ask contexts with instructions) · query history page.
- Views/favorites are browser-local; move to a DB table if they must follow the user across devices.

### Databricks tour: what each area is, and the Dashtor backend design (2026-10-08)
Concepts: **Workspace/Recents** (file tree + recently opened) · **Catalog** (Unity Catalog: metastore→catalog→schema→table/volume/model; Govern/Connect/Share; Suggested/Favorites/Recents) · **Discover** (search over every asset type + *Domains* = governed-tag groups; Certified/Deprecated badges) · **SQL Editor / Queries / Query History / SQL Warehouses** (write+save+parameterise SQL; every run logged; warehouse = compute) · **Dashboards** (draft vs published, datasets tab, pages, global filters, bookmarks) · **Genie Agents** (a named NL space over chosen tables + instructions) · **Alerts v2** · **Jobs & Pipelines / Runs** (ingestion pipeline, ETL pipeline, job orchestration; triggers; run history) · **Data Ingestion** (file upload + ~30 connectors) · **Visual Data Prep** (no-code canvas) · **AI/ML** (Playground, Agents, AI Gateway, Experiments, Features, Models, Serving) — out of scope for an analytics product, except Playground ~ our AI provider settings.
Design principle: one generic **asset layer** so every list/search/home panel behaves the same, instead of per-feature flags.
1. `assets` (id, kind, ref_id, name, owner, workspace_id, domain, certified: none|certified|deprecated, tags JSON, modified_at) kept in sync by store hooks; `user_favorites(user_id, asset_id)`, `user_recents(user_id, asset_id, opened_at)`. API: `GET /api/assets?kind&q&favorite&owner&since&domain&sort`, `POST /api/assets/{id}/favorite|certify`, `POST /api/recents`. Replaces localStorage favorites; powers Discover page + Home recents + list chips.
2. `query_runs` (id, user, sql, source: ask|builder|notebook|widget, duration_ms, rows, status, error, created_at) written in `services/engine.py`; `GET /api/history`. Also gives "popular" and cost hints.
3. `saved_queries` (+ parameters JSON) behind the Workbench; list page like Queries.
4. Dashboards: `dashboard_versions` (draft JSON, published JSON, published_by/at); viewers get published, editors get draft; `dashboard_views(dashboard_id, user_id, name, query JSON, shared)` replaces localStorage bookmarks.
5. `schedules` (kind dashboard|alert|pipeline, ref_id, cron, recipients, last_run, last_status) run by one in-process scheduler (APScheduler) + SMTP email (needs Supabase SMTP, an open item); `job_runs` for pipeline/refresh runs.
6. `ask_spaces` (name, instructions, table_ids[], sample_questions[]) — Ask can be scoped to a space (Genie-style).
7. "Compute": a read-only Settings card for DuckDB threads/memory/timeout (our warehouse), not a separate service.
Build order: (1) assets+favorites+recents → (2) query history → (3) dashboard views + publish → (4) saved queries → (5) schedules/email → (6) ask spaces. All additive tables via `SCHEMA`/`MIGRATIONS`; routers thin, logic in `services/assets.py`, `services/history.py`.
