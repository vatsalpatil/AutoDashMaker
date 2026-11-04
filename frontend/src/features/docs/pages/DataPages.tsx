import { BRAND_NAME } from '@/lib/brand';
import { Accordion, Code, H2, H3, List, Note, P, PageTitle, Table, Tabs, Tip, Warning } from '../DocsKit';

export function SourcesPage() {
  return (
    <>
      <PageTitle eyebrow="Data" title="Connect data sources" lead="A source is a saved connection. Importing a table from it creates a dataset that you can query, chart and refresh." />
      <H2>How importing works</H2>
      <P>When you import, {BRAND_NAME} reads the rows from the source once, writes them to a Parquet file inside your workspace and registers a <b>dataset</b> on top of it. Queries then run on that local copy with DuckDB — fast, and your production database is not hit by every chart. To pick up new data, <b>Refresh</b> the dataset (by hand or on an auto-refresh schedule).</P>
      <Note>Credentials are encrypted at rest and masked in every API response. Even you will see <code>••••</code> after saving a password.</Note>
      <H2>Supported source types</H2>
      <Table head={['type', 'Use it for', 'What you provide']} rows={[
        ['file', 'CSV, TSV, JSON, Parquet, Excel (.xlsx/.xls)', 'Drag and drop the file (max 50 MB on hosted)'],
        ['postgres', 'PostgreSQL and compatibles: Supabase, Redshift, CockroachDB, Neon', 'host, port, database, user, password, SSL mode'],
        ['mysql', 'MySQL, MariaDB, TiDB, PlanetScale', 'host, port, database, user, password'],
        ['sqlite', 'A local .sqlite / .db file', 'file path (local mode)'],
        ['rest', 'Any JSON HTTP API', 'URL, method, headers, record path, pagination'],
        ['graphql', 'GraphQL endpoints', 'URL, query, variables, headers'],
        ['url', 'A CSV/JSON/Parquet file on the web', 'the file URL'],
        ['gsheets', 'Google Sheets', 'the sheet share link (anyone with link can view)'],
      ]} />
      <H2>Examples</H2>
      <Tabs tabs={[
        { label: 'PostgreSQL', body: <><P>Create a read-only user on your database first — {BRAND_NAME} only ever reads, but least privilege is good practice.</P><Code title="on your Postgres" code={`CREATE USER dashtor_ro WITH PASSWORD '…';\nGRANT USAGE ON SCHEMA public TO dashtor_ro;\nGRANT SELECT ON ALL TABLES IN SCHEMA public TO dashtor_ro;`} /><P>Then <b>Add data → PostgreSQL</b>, fill host/port/database/user/password, click <b>Test</b>, and pick the tables to import.</P></> },
        { label: 'REST API', body: <><P>The response is flattened into columns. Use <b>record path</b> to point at the array of rows inside the JSON.</P><Code title="response" code={`{ "data": { "items": [ { "id": 1, "price": { "amount": 9.5 } } ] } }`} /><P>record path <code>data.items</code> → columns <code>id</code>, <code>price.amount</code> (nested keys are joined with <code>.</code>). Only GET requests are retried on failure.</P></> },
        { label: 'Google Sheets', body: <P>Set the sheet to <b>Anyone with the link → Viewer</b>, copy the link and paste it as a Google Sheets source. {BRAND_NAME} downloads it as CSV. Each refresh re-downloads the sheet.</P> },
        { label: 'API Studio', body: <P>For tricky APIs (auth flows, pagination, GraphQL), build and test the request in <b>API Studio</b> first — environments, curl import, history — then click <b>Save as source</b> or <b>Save as dataset</b>.</P> },
      ]} />
      <H2>Blending and relationships</H2>
      <P>Datasets from different sources live in the same DuckDB engine, so one query can join a CSV with a Postgres table. Declare <b>relationships</b> (e.g. <code>orders.customer_id → customers.id</code>) so the Query Builder and Ask know how to join them without guessing.</P>
      <Warning title="Private networks">On the hosted app, sources must be reachable from the internet. database and webhook addresses on private networks (<code>localhost</code>, <code>10.x</code>, <code>192.168.x</code>) are blocked to prevent SSRF; run {BRAND_NAME} yourself to reach private databases.</Warning>
    </>
  );
}

export function DatasetsPage() {
  return (
    <>
      <PageTitle eyebrow="Data" title="Datasets, quality & versions" lead="A dataset is a queryable table with a profile, a quality score, a refresh history and versions you can roll back to." />
      <H2>Dataset names in SQL</H2>
      <P>Each dataset has a display name and a <b>physical name</b> — the table name you use in SQL. Spaces and symbols become underscores: “Sales 2025.csv” → <code>sales_2025</code>. The Workbench autocompletes both table and column names.</P>
      <H2>Profile</H2>
      <P>On import, every column is profiled: detected type, null count, distinct count, min / max / mean for numbers, earliest / latest for dates, top values for text. Columns are also classified by meaning (ID-like, money, per-unit, category, date) so charts and AI pick sensible defaults — for example, never summing an ID or a unit price.</P>
      <H2>How the quality score is calculated</H2>
      <Table head={['Dimension', 'Meaning', 'How it is measured']} rows={[
        ['completeness', 'Are cells filled in?', 'Share of non-null cells across columns'],
        ['uniqueness', 'Are rows duplicated?', '100 − duplicate-row %'],
        ['validity', 'Do typed columns hold real values?', 'Numeric/date columns that contain usable values'],
        ['freshness', 'Is the data recent?', 'Time since the last successful refresh vs its schedule'],
      ]} />
      <P>The score is rule-based, not AI — the same data always gets the same score, and the Quality page lists exactly which column cost which points.</P>
      <H2>Data tests</H2>
      <P>Tests are rules that must hold after every refresh, in the style of dbt tests: <code>not_null</code>, <code>unique</code>, <code>accepted_values</code>, <code>range</code> (min/max), <code>min_rows</code>, or <code>custom_sql</code> — a query that must return zero rows.</P>
      <Code title="custom test: no negative revenue" code={`SELECT * FROM sales_2025 WHERE revenue < 0`} />
      <Tip title="Auto-rollback">If a refresh breaks a test, {BRAND_NAME} can roll the dataset back to the last good version automatically, so dashboards never show broken data. Derived datasets have no versions, so for them a failure only raises an alert.</Tip>
      <H2>Versions</H2>
      <P>Every refresh of an imported dataset keeps a version (Parquet snapshot). The <b>Versions</b> tab lists them with row counts and lets you preview or restore one.</P>
      <H2>Refresh & freshness</H2>
      <List items={[<><b>Manual</b> — the Refresh button re-imports from the source.</>, <><b>Auto-refresh</b> — opt in per dataset with an expected interval (e.g. every 60 minutes). Failures back off and are shown in source health.</>, <><b>Freshness</b> — a dataset older than its expected interval is flagged stale and loses freshness points.</>]} />
      <H3>Limits on the hosted app</H3>
      <Table head={['Limit', 'Default']} rows={[['File size', '50 MB'], ['Storage per user', '250 MB'], ['Rows per dataset', '5,000,000'], ['Datasets per user', '20'], ['Query timeout', '30 s'], ['Rows returned to the browser', '10,000']]} />
    </>
  );
}

export function TransformsPage() {
  return (
    <>
      <PageTitle eyebrow="Data" title="Transforms, metrics & “Why?”" lead="Reshape data into derived datasets, define business metrics once, and explain why a number changed." />
      <H2>Transform pipelines</H2>
      <P>A pipeline starts from a base dataset and applies <b>layers</b> in order; each layer receives the previous layer's output. The result is saved as a <b>derived dataset</b> that re-computes when its inputs refresh, and appears in lineage.</P>
      <Tabs tabs={[
        { label: 'SQL layer', body: <><P>The previous layer's output is available as the table <code>{'{df}'}</code>.</P><Code title="SQL layer" code={`SELECT *, revenue - cost AS margin\nFROM {df}\nWHERE status <> 'cancelled'`} /></> },
        { label: 'Python layer (Polars)', body: <><P>The previous layer is <code>df</code> (a Polars DataFrame). Assign your output to <code>result</code>. Allowed imports: <code>polars</code>, <code>numpy</code>, <code>math</code>, <code>datetime</code>, <code>re</code>, <code>json</code>. File access, <code>eval</code>/<code>exec</code> and dunder attributes are blocked.</P><Code title="Python layer" code={`result = (\n    df.with_columns(pl.col("order_date").dt.week().alias("week"))\n      .group_by("week").agg(pl.col("revenue").sum())\n)`} /></> },
      ]} />
      <Note>On the hosted app, Python layers are off unless the operator sets <code>ALLOW_USER_PYTHON=true</code>.</Note>
      <H2>Metrics (semantic layer)</H2>
      <P>A metric is a named SQL aggregate over one dataset, with optional filters — for example <b>Net revenue</b> = <code>SUM("revenue") - SUM("refunds")</code> where <code>status = 'paid'</code>. Defining it once means Ask, the Metrics hub and alerts all use the same formula, so two people never get two different “revenue” numbers.</P>
      <List items={[<><b>Dimensions</b> — columns a metric may be sliced by (region, month).</>, <><b>Definitions</b> — business glossary entries the AI reads (“active customer = ordered in last 90 days”).</>, <><b>Verified queries</b> — question + approved SQL pairs; Ask reuses them first.</>]} />
      <H2>The “Why?” engine</H2>
      <P>Pick a metric and two periods (this month vs last). {BRAND_NAME} computes the change, then breaks it down by every categorical column and ranks the biggest contributors: <i>“Revenue −12%. Largest observed contributor: region = West (−8 pts).”</i> The wording is deliberately non-causal — it shows where the change happened, not what caused it.</P>
      <H2>Lineage</H2>
      <P>The lineage graph shows source → dataset → derived dataset → chart → dashboard. Use it before deleting or changing a dataset to see what depends on it.</P>
      <Accordion items={[
        { q: 'Transform or SQL view in a chart?', a: 'If two or more charts need the same cleaned data, make a transform. If only one chart needs it, keep the logic in that chart\'s SQL.' },
        { q: 'Can a transform join two datasets?', a: 'Yes — in a SQL layer, refer to any other dataset by its physical name alongside `{df}`.' },
      ]} />
    </>
  );
}
