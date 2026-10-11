# 07 — Chat2DB & alternatives: feature matrix → what AutoDashMaker has / lacks / plans
Written 2026-10-02 from research done earlier in the improvement run plus web search on conversational analytics (Cube, Omni, Vanna, Hex, Metabase, ThoughtSpot). Update the status column as features land.

Principles taken from the research: (1) ground the model in a semantic layer / real schema, never raw guessing; (2) ask a clarifying question when a request is genuinely ambiguous; (3) always show which tables/metrics/filters produced an answer; (4) keep context across follow-ups without silently changing a metric; (5) suggest follow-up questions; (6) LLM proposes, deterministic code validates and executes.

| Capability (source tool) | Status | Where / notes |
|---|---|---|
| NL → SQL over the whole schema (Chat2DB, Vanna, Hex Magic) | ✅ | `services/analyst.py`, `/ai/chat`, Ask page; workbench `/ai/sql` |
| Schema linking for big schemas (Chat2DB) | ✅ | `ai_context.workbench_context` (top-8 relevant tables get columns) |
| Execution-feedback repair of failing SQL (Vanna, Google techniques) | ✅ | `generate_sql` bind-check + `_repair`; analyst one more repair on run error |
| Clarifying questions (ThoughtSpot, Cube) | ✅ | `CLARIFY:` protocol → `status: clarify` |
| Explain / Optimize / Fix with AI on a query (Chat2DB) | ✅ | `services/assist.py`, `CellAssist.tsx`; Explain strips reasoning transcripts |
| SQL dialect conversion (Chat2DB) | ✅ | `services/dialects.py` (sqlglot), "Convert to…" in cells |
| Result → chart suggestion + chart studio (Chat2DB dashboards, Metabase) | ✅ | `chart_suggest.py`, `features/charts` (12 types, 24 templates, pivot) |
| Follow-up question suggestions (Vanna) | ✅ | analyst summary call + deterministic `_facts` fallback |
| Plain-language answer summary (ThoughtSpot, Julius) | ✅ | `analyst._summarize` (validated; factual fallback) |
| Provenance / explainability (Cube, Omni) | ✅ | "How" tab, tables badges, confidence label |
| Feedback loop + verified-query library (Vanna training data) | 🔶 | feedback + verified library stored and fed into prompts; no automatic evaluation |
| Notebook with cell-by-cell queries (Hex) | ✅ | `features/workbench` (cells query earlier cells by name) |
| Schema browser (tree, columns, preview) (Chat2DB, DBeaver) | ✅ | `explorer/TablesTab` (ReUI Tree) |
| Query history (Chat2DB, DBeaver) | ✅ | `explorer/HistoryTab` from audit log |
| Saved queries / snippets | ✅ | Saved tab, `/queries` |
| Results grid: sort/filter/pin/export (DBeaver, TablePlus) | ✅ | ReUI Data Grid wrapper, CSV/JSON |
| Dashboard filters (Metabase, ThoughtSpot Liveboards) | ✅ | `features/dashboards/dashboardFilters.tsx` (client-side, per-column) |
| Many database connectors (Chat2DB, DBeaver) | 🔶 | files, Postgres, MySQL, SQLite, REST, Sheets, URL; no warehouse connectors (BigQuery/Snowflake) |
| Schema-aware SQL editor (autocomplete, highlighting) (Chat2DB, DBeaver) | ⬜ | cells are plain textareas → plan: CodeMirror 6 with schema completion |
| Model routing (cheap vs strong), eval benchmark for NL→SQL | ⬜ | see 02-status "platform" list |
| Team sharing / RBAC / comments (Chat2DB Pro, Metabase) | ⬜ | auth deferred by the user |
| Scheduled reports / email | ⬜ | alerts exist; reports not built |
| Query cost estimate / EXPLAIN visualiser (DBeaver) | ⬜ | `explain_sql` is structural only |

## Suggested order for the open items
1. CodeMirror editor with table/column completion (biggest day-to-day gain in the Workbench).
2. NL→SQL eval set (20-30 questions over the sample data) to compare models and detect regressions.
3. Warehouse connectors (BigQuery/Snowflake) behind the existing `datasources` schema-driven forms.
4. Scheduled reports, then auth/RBAC when the user wants multi-user.
