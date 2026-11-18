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

## Add data picker — revision 2 (2026-11-19)

**How others do it**
- Power BI *Get data* groups connectors by category (File, Database, Online Services, Other) with an "All" list ([Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-data-sources)).
- Julius groups sources as warehouses, databases, business tools (Google Sheets, OneDrive) and file uploads ([julius.ai/business](https://julius.ai/business), [connector docs](https://julius.ai/docs/data-connectors/overview)).
- Metabase splits *uploads* (CSV into a collection, Google Sheets on Cloud) from *Admin > Databases > Add a database* where you pick the engine inside one form ([uploads](https://www.metabase.com/docs/latest/databases/uploads)).

**What we changed** (user feedback: "confusing, repeated, too divided")
- Two rows by how data arrives: **Files** (one-time copy: Upload, Google Sheets, File from a link) and **Live connections** (Database, Web API).
- One **Database** tile; the engine (PostgreSQL | MySQL) is a switch inside the form, like Metabase. Typed values carry over when switching.
- One **Web API** tile; style (REST / JSON | GraphQL) is a switch inside the form. API Studio stays the place to explore first (linked under the row).
- **SQLite removed from the picker**: it only reads a file on the Dashtor server, which users of the hosted app cannot use. Existing SQLite sources still open and work.
- Google Sheets moved to Files: users think of a sheet as a spreadsheet, not a service (Julius lists it beside file tools).

**Still worth doing**: Google sign-in for private Sheets/Drive (Julius, Metabase Cloud), warehouse engines (BigQuery/Snowflake) as more Database engines, and an "All connectors" search once there are more than ~8.
