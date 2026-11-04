import { BRAND_NAME } from '@/lib/brand';
import { ConnectAiSection } from '@/features/guide/sections/ConnectAiSection';
import { AnnotatedShot, Clip, type Pin } from '../DocsParts';
import { Code, H2, H3, List, Note, P, PageTitle, Table, Tip, Warning } from '../DocsKit';

const DASH_PINS: Pin[] = [
  { x: 24, y: 13.4, label: 'Edit with AI', text: 'describe a change in words.' },
  { x: 81, y: 10, label: 'Share / Present', text: 'read-only link or full screen.' },
  { x: 30, y: 17.5, label: 'Filters', text: 'slice every widget at once.' },
  { x: 29, y: 41, label: 'KPI cards', text: 'exact values on hover.' },
  { x: 45, y: 65, label: 'Widgets', text: 'drag and resize on a 12-column grid.' },
];

export function DashboardsPage() {
  return (
    <>
      <PageTitle eyebrow="Visualize" title="Dashboards" lead="Charts, KPIs and notes on a responsive grid — with pages, filters, parameters and AI editing." />
      <AnnotatedShot src="/images/landing/dashboard-overview.webp" alt="Dashboard" pins={DASH_PINS} />
      <H2>Three ways to create one</H2>
      <Table code={false} head={['Way', 'When to use']} rows={[
        ['Blank', 'You know exactly what goes on it. Add saved charts, new charts or text widgets.'],
        ['Generate from a dataset', 'Fast first draft: KPIs with change vs previous period, a trend, top breakdowns and a detail table, chosen from the data profile.'],
        ['Describe it to AI', '“A sales dashboard for regional managers with margin focus.” The AI plans pages and widgets, then a critic pass fixes duplicates and bad chart choices.'],
      ]} />
      <H2>Layout</H2>
      <P>The grid has 12 columns. Drag a widget by its header, resize from the corner; on phones widgets stack in one column. Use <b>sections</b> (text headers) to group widgets and <b>pages</b> (tabs) to split a big dashboard — for example Overview, Regions, Products.</P>
      <H2>Filters and parameters</H2>
      <P><b>Filters</b> apply a condition (region, date range) to every widget whose dataset has that column. <b>Parameters</b> fill <code>{'{{placeholders}}'}</code> in widget SQL — for example a period switch (month/quarter/year) or a number threshold. Changing a control re-runs all affected widgets in one batched request.</P>
      <Code title="widget SQL with a parameter" code={`SELECT date_trunc({{period}}, order_date) AS p, SUM(revenue)\nFROM sales_2025 GROUP BY 1 ORDER BY 1`} />
      <H2>Edit with AI</H2>
      <P>Type instructions like <i>“add a profit by category bar next to the revenue trend”</i>, <i>“make all KPIs compare to last year”</i> or <i>“remove the table”</i>. Each instruction becomes a list of edits (add, update, move, delete) applied to the dashboard; undo reverts them.</P>
      <Clip id="dashboard" caption="A generated dashboard, then edited and shared." />
      <H2>Patterns gallery</H2>
      <P>Ready-made widget patterns: KPI vs previous, ratio, ranked list, quadrant, growth treemap, reconcile (two sources that should match), and time-break (expand / split / compare periods).</P>
    </>
  );
}

export function AlertsPage() {
  return (
    <>
      <PageTitle eyebrow="Operate" title="Alerts & scheduled reports" lead="Get told when a number crosses a line, and get a summary on a schedule — without opening the app." />
      <H2>Alerts</H2>
      <P>An alert runs a query that returns one number, on a schedule, and compares it with a threshold. When it triggers you get an in-app notification and the event is logged.</P>
      <Table head={['operator', 'Triggers when']} rows={[
        ['gt / gte', 'value is above (or equal to) the threshold'],
        ['lt / lte', 'value is below (or equal to) the threshold'],
        ['eq', 'value equals the threshold'],
        ['pct_up_gt', 'value rose more than N % since the previous check'],
        ['pct_down_gt', 'value fell more than N % since the previous check'],
      ]} />
      <Code title="alert: revenue down more than 20 % week over week" code={`-- operator: pct_down_gt   threshold: 20   every: 7 days\nSELECT SUM(revenue) FROM sales_2025\nWHERE order_date >= current_date - INTERVAL 7 DAY`} />
      <Tip>The percentage operators need one previous run, so a new alert never triggers on its first check.</Tip>
      <H2>Scheduled reports</H2>
      <P>A report runs a query every N minutes and stores the result as a run (status, row count, message). Each run appears as an in-app notification and can be POSTed to a <b>webhook</b> (Slack, Teams, n8n, Zapier):</P>
      <Code title="webhook body" code={`{ "report": "Daily sales", "status": "ok", "rows": 12, "text": "…" }`} />
      <Note>If a dataset changes and the report SQL breaks, the run is recorded as failed instead of stopping the scheduler.</Note>
      <H2>What needs my attention</H2>
      <P>The attention panel on Ask collects everything worth a look: triggered alerts, failing data tests, stale datasets and broken charts.</P>
    </>
  );
}

export function McpPage() {
  return (
    <>
      <PageTitle eyebrow="AI" title="Connect your own AI (MCP)" lead={`Use Claude, ChatGPT, Cursor or any MCP client to explore your data and build dashboards in ${BRAND_NAME} — on your own AI subscription.`} />
      <H2>What MCP gives your AI</H2>
      <P>The Model Context Protocol lets an AI app call tools. {BRAND_NAME} exposes about 20 tools over HTTP. The AI follows the same pipeline you do:</P>
      <Table head={['Tool', 'Purpose']} rows={[
        ['list_datasets / describe_dataset', 'See what data exists, its columns and SQL table name'],
        ['run_sql', 'Run read-only DuckDB SQL (SELECT / WITH only)'],
        ['connect_source / list_source_tables / import_table', 'Bring new data in'],
        ['create_dashboard / add_chart / add_text', 'Build dashboards widget by widget'],
        ['update_chart / update_widget / remove_widget', 'Polish what exists'],
        ['share_dashboard / open_in_app', 'Present the result'],
        ['list_api_endpoints / call_api', 'Reach anything else: alerts, metrics, quality, transforms…'],
      ]} />
      <Note>A read-only token only exposes the read tools. Every SQL call still goes through the read-only guard.</Note>
      <ConnectAiSection />
    </>
  );
}

export function SecurityPage() {
  return (
    <>
      <PageTitle eyebrow="Operate" title="Security, privacy & sharing" lead="What protects your data, what leaves the server, and who can see a shared dashboard." />
      <H2>The read-only SQL guard</H2>
      <P>Every statement — typed, built, generated by AI or sent over MCP — is parsed with sqlglot before DuckDB sees it. Only a single <code>SELECT</code> or <code>WITH</code> is allowed; writes, DDL, <code>COPY</code>, <code>ATTACH</code>, file-reading functions and stacked statements are rejected. A row limit and a timeout are applied too.</P>
      <H2>What is sent to AI providers</H2>
      <List items={['Schema: table and column names and types, a few sample values.', 'Your question, metric definitions and glossary.', 'Small query results only when you ask for a summary or explanation.']} />
      <P>Full datasets are never uploaded to a model. With MCP, your own AI app receives what its tool calls return.</P>
      <H2>Isolation and encryption</H2>
      <List items={['Hosted: each user has a private workspace; queries can only see that workspace\'s datasets.', 'Source passwords, API keys and tokens are encrypted at rest and masked in API responses.', 'Outbound webhooks and database hosts on private networks are blocked (SSRF guard).', 'Every change is written to the audit log (Activity page).']} />
      <H2>Share links</H2>
      <P><b>Share</b> creates an unguessable public URL to a read-only view of one dashboard. Viewers see the rendered widgets only — not SQL, other dashboards or datasets. Revoke a link at any time; it stops working immediately.</P>
      <Warning>Anyone with the link can view. Don't share dashboards containing personal data publicly.</Warning>
      <H3>Your account</H3>
      <P>In <b>Settings → Account</b> you can export a backup, change email, or delete your account and all its data.</P>
    </>
  );
}
