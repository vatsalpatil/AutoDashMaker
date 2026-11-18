# Competitive Gap Analysis (2026-11-18)

Competitor facts are from public product knowledge (no web fetch in this pass); Dashtor facts cite code.

## Where Dashtor stands (code-backed)
| Area | Dashtor today | Evidence |
|---|---|---|
| Semantic layer | metrics, dimensions, definitions, synonyms, verified queries; metric live values + preview | `routers/semantic.py`, `routers/metrics.py`, tables in `core/store.py` |
| AI trust | read-only SQL guard, one-shot AI repair, deterministic explanation, audit log | `core/security.py`, `services/analyst.py:137-143`, `services/explain.py`, `services/audit.py` |
| Lineage | dashboard->chart->query->dataset->source | `services/lineage.py`, `/charts/{id}/lineage` |
| Data trust | quality scores, dbt-style tests + auto-rollback, versions (KEEP=3) | `services/quality.py`, `data_tests.py`, `versions.py` |
| Monitoring | alerts scheduler, scheduled reports, attention report, admin monitoring | `services/alerts.py`, `reports.py`, `attention.py`, backoffice |
| Onboarding | starter questions from column names; **no sample dataset** | `services/column_kinds.py`, `analyst.starter_questions`; grep for sample/demo data in `backend/app` and `frontend/src` finds nothing |
| BYO AI | MCP server + OAuth 2.1 for Claude/ChatGPT | `routers/mcp.py`, `routers/oauth.py` |

## Competitor comparison (focus areas)
| Capability | Metabase | Power BI | Tableau | ThoughtSpot | Hex | Julius AI | Dashtor |
|---|---|---|---|---|---|---|---|
| Governed semantic model | Models + metrics | Semantic models (DAX) | Published data sources / Pulse metrics | Worksheets/Models | Semantic projects | none | Partial (metrics not enforced in Ask) |
| AI answer shows SQL + lineage to metric | Metabot shows query | Copilot, limited | Pulse insights | Spotter: tokens map to columns | Magic: code visible | code visible | SQL + explanation; metric lineage in progress (other agent) |
| Sample data on first run | Sample Database | sample reports | Superstore | demo worksheets | templates | sample files | **missing** |
| Data alerts / subscriptions | yes | yes | yes | Monitor | scheduled runs | no | yes |
| Pixel-perfect / enterprise RLS | partial | yes | yes | yes | partial | no | per-user workspace only (`core/tenant.py`) |

## Gaps that matter (should build)
1. **Sample dataset + guided first answer.** Every competitor ships one; Dashtor's empty first run blocks the Ask demo.
2. **Metric-bound Ask.** When a question matches a defined metric, answer must use its expression and say so
   (ThoughtSpot/Power BI pattern). Today metrics only feed prompts (`AI-Memory/01-architecture.md` data flow).
3. **Answer trust card:** SQL, tables, metric used, verified-query match, freshness of each dataset (data exists:
   `datasets.refreshed_at`, quality scores). Lineage work is in progress by another agent.
4. **NL->SQL eval in CI** (`tests/eval_nl2sql.py` 1/6 last run) — trust is the product differentiator.
5. **Self-monitoring of the deployment** (uptime + backup) — the 2026-11-13 outage was found by users, not alerts.

## Should NOT build (now)
- Pixel-perfect paginated reports (Power BI Report Builder) — CSV/scheduled reports suffice.
- Own DAX/LookML-style modelling language — keep metrics as SQL expressions.
- Enterprise SSO/RLS matrix — single-user workspaces (D23) are the current model.
- Warehouse connectors needing heavy deps (BigQuery/Snowflake) until there is demand (`02-status.md` line 32).
- More chart types — 19 kinds already (`features/charts/chartKinds.ts`, Metabase parity doc).
- Python notebook runtime to compete with Hex; Workbench + agent cover the analyst path.
