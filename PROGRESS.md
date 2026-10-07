# AutoDashMaker — Progress vs `Plan/smart-data-platform-requirements.md`

Legend: ✅ done · 🔶 partial/stubbed · ⬜ not started

## Phase 1 — Data (§13, §14, §38, §42–45)
- ✅ Connector interface (test/discover/ingest) — `connectors/base.py`
- ✅ CSV / Excel / Parquet / JSON file connector
- ✅ PostgreSQL connector (DuckDB postgres extension, read-only attach)
- ✅ MySQL connector (DuckDB mysql extension, read-only attach)
- ✅ SQLite connector (attach file, read-only)
- ✅ REST API connector (record_path extraction + JSON flattening)
- ✅ Google Sheets connector (share-link → CSV export, verified live)
- ✅ Direct URL connector (CSV/Parquet/JSON/Excel over HTTP, content-type sniffing)
- ✅ Source credential editing + re-test saved connections (PATCH /test-saved)
- ✅ Schema discovery with per-column profile (nulls, distinct, samples)
- ✅ Cross-source blending — join any two datasets into a derived dataset, collision-safe aliasing (§45)
- ✅ Relationship model + auto-suggestion (shared column name + dtype across datasets)

## Multi-layer transform engine (§9 — SQL + Python like Hex)
- ✅ Sandboxed Python (Polars) layer: AST-validated, whitelisted imports, no builtins, `df` in / `result` out
- ✅ SQL layers with `{df}` chaining (DuckDB, same read-only guard)
- ✅ Chained pipelines → derived datasets (`/api/transforms/derive`)
- ✅ Layer preview endpoint + ready-made Polars snippet library
- ✅ Pipeline persistence — `layers` + `base_dataset_id` stored; refresh replays the pipeline
- ✅ AI SQL panel endpoint (`/api/ai/sql`) — generates + explains SQL for the Workbench, never executes

## Dashboard editor (§22 advanced)
- ✅ Multi-page dashboards (pages on dashboard, page per widget)
- 🔶 Drag/resize grid, fullscreen widgets, table widgets, edit/view toggle (UI in progress)

## Phase 2 — AI (§16–18, §46, §51–52)
- ✅ AI provider registry: Gemini (free default), OpenAI, Anthropic, Groq, OpenRouter, Ollama
- ✅ NL → SQL ask endpoint with read-only validation of AI output
- ✅ Semantic context injected into ask prompt (metrics/definitions/synonyms/verified queries)
- ✅ Conversational follow-ups (conversation state: active dataset/filters/SQL history)
- ✅ Structured intent parse (intent/metrics/dimensions/filters/viz) returned with answers
- ⬜ Model routing (cheap vs strong models per task)
- ⬜ MCP / agent API (§71)

## Phase 3 — Visualization (§21, §22)
- ✅ Declarative chart specs (bar/line/area/pie/kpi) rendered from fresh query execution
- ✅ Dashboard grid (12-col), widgets with position, add/remove, save layout
- ✅ Dashboard generation from schema profile (KPIs/trend/bar/pie + rationale per widget, ID-column aware)
- ✅ Dashboard editor: drag/resize grid, widget toolbar (chart↔table, fullscreen), section grouping cards, multi-page tabs with persistence
- ✅ Workbench AI assistant: chat panel → /api/ai/sql with editor context + refinement history
- ⬜ Dashboard filters, sharing, refresh policies

## Phase 4 — Trust (§19, §20, §26–31)
- ✅ Read-only SQL guard (sqlglot parse, mutation blocklist, auto LIMIT)
- ✅ Result validation warnings (empty, null explosion, duplicate rows)
- ✅ Data quality: completeness, uniqueness, validity, duplicate %, freshness
- ✅ Lineage: dashboard → chart → query → dataset → source
- ✅ Query explanation (deterministic: tables/columns/filters/grouping/aggregations via sqlglot)
- ✅ Answer provenance (dataset, metric refs, rows, duration, freshness, warnings)
- ✅ Confidence classification (verified / likely / needs clarification / data-quality concern) — rule-based
- ✅ Query timeout & cancellation (30s interrupt) · ⬜ cost estimation
- ✅ Audit logs (§58) — `/api/audit`

## Semantic & memory layer (§15, §47–50)
- ✅ Metrics, dimensions, business definitions, synonyms — CRUD + API
- ✅ Verified query library (mark answer correct → stored as example, injected into future context)
- ✅ Human feedback loop (✓/✕ with reason categories)
- ⬜ Query evaluation benchmark (§50)
- ⬜ Versioning of semantic model (§91)

## Phase 5–6 — Intelligence & Operations (§23–25, §66–69)
- 🔶 Trend/anomaly/contribution detection on results (deterministic z-score; trends only on time-ordered data)
- ✅ "Why?" engine — period-vs-period change attribution across dimensions with non-causal language (§66–67)
- ✅ Alerts — metric SQL rules (threshold + %-change operators), in-process scheduler, run history (§25)
- ✅ In-app notifications (bell, unread count, mark read)
- ✅ Decision briefs — findings + attention items from live widget re-execution (§68)
- ✅ Data freshness — expected interval per dataset, stale detection, manual refresh (§27)
- ⬜ Scheduled reports (§69)

## Platform (§34–35, §54–58, §70–71)
- ✅ Multi-tenant-ready metadata columns (org/workspace/created_by), DuckDB metadata store
- ⬜ Auth/RBAC (deferred by user decision)
- ⬜ Background jobs, embedding, MCP
- ✅ "What needs my attention?" aggregator (§99) — `/api/attention` + Ask-page panel
- ✅ Opt-in scheduled dataset refresh with backoff + source health endpoint (§27, §54)
- ✅ Query result cache + DuckDB resource limits (§53, §55)
- ✅ Visual query builder (§102): stages, joins, custom columns, window calcs, conditional metrics · ⬜ pivot/union/AI text-to-steps
