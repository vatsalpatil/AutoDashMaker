# UX review: Key Numbers, Charts, Dashboards (2026-11-19)

Research basis: official docs found via web search on 2026-11-19 (sources at the end).

## What the docs say
- Metabase metrics: a curated aggregation with its own dimensions and a default time dimension. Dashboard filters connect to a
  metric's dimensions. The docs advise keeping filters out of the metric's formula.
- Metabase dashboard filters: a filter widget sits on the dashboard (applies across tabs), in the header or on a card (current
  tab only). Linked filters narrow one filter by another.
- Power BI: scorecards hold metrics (goals) with a current value, a target and a colour-coded status, connected to report data.
  The Visualizations pane has three tabs: Build visual (fields), Format visual and Analytics.
- Lightdash: metrics are defined once in YAML and reused across the project, and a searchable Metrics catalog lists them.
  Custom metrics live only inside the chart they were made in.
- Tableau Show Me: from the fields you select it suggests chart types, outlines the best one and greys out types the fields
  can't support (e.g. a histogram needs one measure and no dimensions).

## Key Numbers (`/metrics`)
- Competitors: Metabase "Metrics" = a saved aggregation + filters on a table, reused in the query builder; Power BI
  measures live in the model, scorecards add targets/owners; dbt/Lightdash define metrics in YAML with description,
  owner and "used by"; ThoughtSpot models expose formulas to search by name.
- Ours: live value + trend cards, suggestions to pin, builder, plus Dimensions/Glossary/Relationships tabs that teach Ask.
- Gap: page never said *what* a metric is or *where* it is used (only Ask uses it today).
- Chosen: dismissible 3-point explainer (what / where used / how to start). Rejected: targets/owners (needs backend fields),
  "used in charts" (charts can't reference metrics yet).

## Charts (`/charts`, `/charts/:id`)
- Competitors: Metabase questions list shows collection + type; viz picker suggests sensible types from the result shape;
  Tableau Show Me greys out impossible types; Superset list shows dataset, type, dashboards, owner.
- Ours: table/grid, type filter, "used in" count, studio with templates + live preview.
- Chosen: "Source query" column, source + dashboard usage on grid cards, plainer page description.
  Rejected: names of dashboards per chart (API only returns a count; needs backend), studio restructure (high risk).

## Dashboards (`/dashboards`, detail, layout, generate)
- Competitors: Metabase dashboards have tabs + filter bar wired to cards; Power BI pages + slicers + filter pane;
  Lightdash/Tableau show filter state prominently; lists show owner, last viewed, card count.
- Ours: pages, pinned filters, AI create, generate-from-dataset, share links, present mode.
- Chosen: "Contents" column/card line (widgets · pages · filters), clearer description and empty state pointing to the
  three ways to start. Rejected: last-viewed/owner (no backend data).

## Also changed
- Dashboard empty page (`features/dashboards/WidgetGrid.tsx`): names the two ways to fill it (Add widget, Edit with AI)
  and what a widget can be. This follows Metabase/Power BI, where an empty canvas points straight to adding content.

## Suggested follow-ups (need other owners / backend)
- `/charts` to return `used_in_dashboards: [{id,name}]` and query/dataset name to avoid a second `/queries` call.
- Let charts and alerts use pinned metrics (Metabase/Lightdash pattern); show "used by" on metric cards.
- Dashboard list: `updated_at`, owner, last viewed.
- Targets and status on key numbers (Power BI scorecards); a searchable metrics catalog (Lightdash).
- Grey out chart types the columns can't support in the studio picker (Tableau Show Me).

## Sources
- https://www.metabase.com/docs/latest/data-modeling/semantic-layer/metrics
- https://www.metabase.com/docs/latest/dashboards/filters
- https://www.metabase.com/docs/latest/dashboards/linked-filters
- https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview
- https://learn.microsoft.com/en-us/power-bi/create-reports/service-the-report-editor-take-a-tour
- https://learn.microsoft.com/en-us/power-bi/create-reports/service-goals-create-connected
- https://docs.lightdash.com/references/metrics
- https://docs.lightdash.com/explore/metrics-catalog
- https://help.tableau.com/current/pro/desktop/en-us/buildauto_showme.htm
