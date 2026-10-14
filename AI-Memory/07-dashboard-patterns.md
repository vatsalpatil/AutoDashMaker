# 07 — Dashboard pattern library (learned 2026-10-14 from a production ERP analytics site)

Study notes, not a copy: each pattern = the business question, the data shape it needs, and how Dashtor builds it.
Status: ✅ built · 🔶 partly · ⬜ not yet. Keep this file current when a pattern ships.

## Page architecture
| Pattern | What it is | Dashtor |
|---|---|---|
| Subject tabs | One page per subject (Overview, Sales, Products, Geography, Shipping, Warehouse, Tax, Data Quality, Operations, Executive, Raw data) | ✅ dashboard pages |
| Dimension tabs with one shared layout | Same KPI strip + time breakdown + top 10 + rate chart + detail table for Portal / Company / Brand / Category / SKU / Account | ✅ template `report_center` |
| Global filter bar | Date from/to, many dimension selects, Apply + Reset, shown above every tab | 🔶 dashboard filters exist; no Apply/Reset batch or date-range preset |
| Period switch | Day / Week / Month changes every widget's "current vs previous" | ✅ SQL params: `DATE_TRUNC('{{period|month}}', d)` → switch above the dashboard |
| Data-source switch | Same page over source A or B (e.g. two sales feeds) | ⬜ (dashboard-level dataset swap) |
| "As of" line | Shows the data's latest date + source | ⬜ (freshness exists per dataset) |

## Widgets
| Pattern | Data shape | Dashtor |
|---|---|---|
| KPI strip (6-10 numbers) | 1 row each | ✅ kpi |
| KPI with previous value + growth | value, previous | ✅ kpi showPrevious/previousColumn |
| Text KPI ("Top SKU: X", "Top state") | 1 row, text value | ✅ kpi renders text |
| Ratio KPI ("3.2 : 1") | a/b | ✅ numberFormat `ratio` |
| Ranked list vs previous | item, cur, prev | ✅ ranked |
| Performance groups (Stars/Rising/Watch/Laggards) | item, cur, prev | ✅ quadrant |
| What drove the change | waterfall of per-item deltas + Others | ✅ waterfall (+ AI template) |
| Share donut / revenue mix | item, value | ✅ pie |
| Dual-axis trend (value + qty) | period, a, b | ✅ composed |
| Month-over-month growth % bars | period, growth | ✅ bar (+ formula) |
| Treemap coloured by growth | item, cur, prev | ✅ treemap option growthColumn |
| Time breakdown (years → months → days) | item, date, measure, text attrs | ✅ timebreak |
| Matrix: item × channel with totals | item, channel, value | ✅ pivot |
| Growth matrix (delta per channel) | item, channel, cur-prev | 🔶 pivot over a delta query |
| Pareto (items making 80% of revenue) | item, value | ✅ AI formula + `operations` template |
| Reconciliation (2-3 sources per key: match rate, mismatched, total diff, largest diff, missing per source) | key, src1, src2, src3 | ✅ reconcile (features/charts/reconcile.ts) |
| Data-quality checks (duplicate invoices, multi-refund orders, same-day refunds, return loops) | rule queries | ✅ AI template `operations` (checks page) |
| Operations lists (restock candidates, stockout signals) | rule queries | ✅ AI template `operations` |
| Geography (top states/cities/postcodes, routes from→to, high-refund routes) | place, value / from, to, value | ✅ bar, sankey |
| Forecast table (avg weekly last 12 weeks × horizon 30/60/90, confidence) | group, week, qty | 🔶 forecast.ts on charts; ⬜ grouped forecast table |
| Threshold lists ("return rate ≥ X%, min sold ≥ N") | item, rate, sold | ✅ SQL params: `WHERE rate >= {{min_rate|30}}` → number box |

## Table features seen everywhere
Aggregate footer picker (Σ μ median min max range count σ) ✅ · CSV export ✅ · rows-per-page ✅ · per-column filter ✅ (DataGrid) ·
show/hide columns ✅ · sort ✅ · compare 2-3 tables side by side ⬜ · split columns by a 2nd dimension ⬜ (timebreak) · fullscreen ✅ widget.

## Build order (value ÷ effort)
DONE 1-4, 6 (reconcile, ratio+pareto, operations template, SQL parameters = period switch + thresholds). NEXT: 7. timebreak split-by + side-by-side compare.

## SQL parameters (how they work)
`{{name|default}}` in any saved SQL (services/sql_params.py): rendered inside engine.execute before validate_readonly; values must be a number or a plain word/date (no quotes/;/comments). Dashboards: GET /dashboards/{id}/params builds controls (period/grain names or day..year defaults -> switch; numeric default -> number box; else text). POST /dashboards/{id}/data {params}. Frontend: features/dashboards/params/DashboardParams.tsx; non-default values cache under chartId|key. Charts/notebook/studio run with defaults. TODO: AI generator does not write placeholders yet (dash_* code paths call validate_readonly on raw SQL: render first before enabling); public share page uses defaults.
