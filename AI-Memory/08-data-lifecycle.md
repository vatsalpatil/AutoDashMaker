# 08 — Data lifecycle: Source → Dataset → Model → Query → Chart → Dashboard → Operate

Designed 2026-10-15 from building real dashboards in the product (a 10-tab, 40-widget report on Chocolate Sales). Each stage has
ONE artifact, a quality GATE before the next stage, and an AI assist. Status: ✅ built · 🔶 partial · ⬜ to build.

```
 Connect        Land            Model             Shape            Visualize        Assemble          Operate
 [Source] ──▶ [Dataset] ──▶ [Derived/Metric] ──▶ [Query] ──▶ [Chart] ──▶ [Dashboard] ──▶ [Share/Refresh/Alert]
  test conn    profile+quality  transform/join     read-only+params  shape contract   critic+layout     freshness, lineage
```

| Stage | Artifact (table) | Gate before moving on | AI assist | Status |
|---|---|---|---|---|
| 1 Connect | `datasources` | connection test, sample preview | detect source type | ✅ |
| 2 Land | `datasets` (+ Parquet), `columns_meta` | schema confirmed, quality score, freshness interval set | column roles, quality explain | ✅ (freshness opt-in) |
| 3 Model | derived `datasets`, `relationships`, `metrics` (semantic) | transform runs, row-count delta shown, lineage recorded | suggest joins, write transforms | 🔶 metrics not yet used by charts |
| 4 Shape | `queries` (SQL with `{{params}}`) | validate_readonly, binds against schema, returns the shape the chart needs | NL→SQL, fix/explain | ✅ |
| 5 Visualize | `charts` (type + encoding + options) | shape contract per type (chartKinds roles) | pick type, encode | 🔶 contract not enforced on save |
| 6 Assemble | `dashboards`, `dashboard_widgets`, pages = tabs | dash_critic checks, no broken widgets | generate / edit with AI, templates | ✅ |
| 7 Operate | shares, refresh jobs, alerts, reports, audit | freshness, alert rules, share expiry | brief, "why", attention | ✅ |

## Lessons from using it (each one became a rule)
1. A widget needed 3 calls (query, chart, widget) and could save broken SQL → **one call: POST /dashboards/{id}/widgets/new** runs the SQL first, then creates all three (services/lifecycle.py). ✅
2. 84 of 156 charts were on no dashboard (AI generations, experiments, deleted dashboards) → **charts show "Used in N"; Charts page "Clean up N unused"; deleting a dashboard can take its own charts with it** (`?cleanup=true`; charts on other dashboards are always kept). ✅
3. Deleting a chart left broken widgets → **delete cascades to its widgets and to its query when unused.** ✅
4. Deleting a dashboard/alert used unscoped raw DELETEs (cross-workspace risk) → **all deletes go through workspace-scoped helpers.** ✅ (rule: never `store.execute("DELETE ...")` without a scoped existence check first)
5. Saved queries lost `{{placeholders}}` → saving keeps the original SQL. ✅
6. The same comparison SQL was pasted into 6 widgets (this month vs last month) → ⬜ **reusable metrics**: charts reference `metrics` definitions so a formula is written once (semantic layer exists; wire it into the query builder + AI).
7. Alias clashed with a real column (`month`) → ⬜ query lint warns when an alias shadows a column.
8. Chart widths vs content (cut-off labels) → elements adapt to the WIDGET width (container queries), not the screen. ✅ for new elements; ⬜ audit the older ones.
9. Nothing tells a user what comes next → ⬜ **"Next step" bar** on Dataset (→ transform / chart / generate dashboard), Query (→ chart), Chart (→ add to dashboard), Dashboard (→ share / schedule).
10. Schema changes silently break charts → ⬜ **impact check**: when a dataset's columns change, mark queries/charts that reference removed columns as broken (lineage already maps chart → query → dataset).

## Object states (target)
draft (unsaved) → valid (runs, matches its shape) → in use (on ≥1 dashboard) → stale (dataset overdue) / broken (fails to run) → archived.
Shown as a badge on lists; "broken" and "stale" feed the attention panel.

## Build order
6 metrics in charts · 9 next-step bar · 10 impact check + broken badges · 7 alias lint · 8 width audit of older chart types.
