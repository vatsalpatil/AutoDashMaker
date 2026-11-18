# Data Sources, Workbench, Query Builder — UX notes (2026-11-19)

## Sources consulted
- Metabase query builder: https://www.metabase.com/docs/latest/questions/query-builder/editor
- Metabase data reference: https://www.metabase.com/docs/latest/exploration-and-organization/data-model-reference
- Power BI connect to data / Get Data: https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-quickstart-connect-to-data
- Power BI data sources: https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-data-sources
- Hex data browser: https://learn.hex.tech/docs/explore-data/data-browser
- Hex data connections: https://learn.hex.tech/docs/connect-to-data/data-connections/data-connections-introduction
- Tableau data source page: https://help.tableau.com/current/pro/desktop/en-us/environment_datasource_page.htm

## Data Sources (`/sources`) — connect flow
- **Competitors:** Power BI's Get data shows common sources first, with "More" opening a gallery grouped by category (File, Database, Online Services). You then pick, connect and land in a Navigator to choose tables. Hex lists its connections and opens a Data browser from them.
- **Ours, before:** the panel showed a row of type pills with the Postgres form already open.
- **Done:** step 1 is a grid of source-type cards (icon, one-line explanation, group badge: Database / File / Online). Step 2 is "Connect <type>" with a "← Choose a different source type" link back. Editing an existing connection skips straight to the form. Files are `features/sources/SourceTypeCards.tsx` and `SourcePanel.tsx`.
- **Rejected:** a separate wizard page, because the inline panel keeps the dataset list in view. Category tabs too: there are only 8 types.

## Dataset detail (`/datasets/:id`)
- **Competitors:** Tableau's data source page puts the data grid (first 1,000 rows) beside a metadata grid. Metabase's data reference lists fields with descriptions and sample values.
- **Done:**
  - Preview is the first and default tab, with the note "First N rows of M".
  - "Schema" is renamed "Columns" and "Why?" is renamed "What changed".
  - Tab order: Preview, Columns, Quality, Tests, Transform, What changed, Versions.
  - Header next steps: Open in builder · Query in Workbench · Build dashboard (`features/datasets/DatasetNextSteps.tsx`).
- **Rejected for now:** an Ask button, because there is no Ask dataset-prefill route.

## Workbench (`/workbench`)
- **Competitors:** Hex's Data browser searches by table or column name, previews data and shows datatypes. Metabase opens its data reference from the SQL editor.
- **Ours:** the Explorer → Tables tree already groups tables by source (schema → table) and expands to "Preview first 100 rows" plus columns with types. Clicking a column inserts it at the cursor. This was verified in the browser, so nothing needed changing. Truncated results already show a warning badge.

## Query Builder (`/builder`)
- **Competitors:** Metabase's builder is a step-by-step flow: pick data, join, custom columns, filter, summarize, limit, then Visualize. It also has a "View SQL" option.
- **Done:**
  - Steps inside each stage are numbered (CSS counter in `ui.tsx` Step, reset per stage in `StageEditor.tsx`).
  - The result pane has a primary "Visualize" button that switches to the chart.
  - A banner appears when the result is cut off: either the backend warns "truncated:" or the result reaches `QB_ROW_LIMIT` (5,000). It suggests adding a Summarize step or filter, or saving as a dataset.
- **Rejected:** a separate Visualize page. The chart tab plus "Create chart" already covers it.

## Backend needs
- `/qb/run` reports no truncation: the injected `LIMIT row_limit` hides it, so the frontend infers it from `row_count >= 5000`. Return `truncated: bool` and `limit` on QueryResult.
- Dataset description and owner fields would allow a Metabase-style catalog.
