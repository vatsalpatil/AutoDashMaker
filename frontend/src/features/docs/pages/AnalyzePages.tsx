import { BRAND_NAME } from '@/lib/brand';
import { AnnotatedShot, Clip, type Pin } from '../DocsParts';
import { Accordion, Code, H2, H3, List, Note, P, PageTitle, Steps, Table, Tip, Warning } from '../DocsKit';

const IMG = '/images/landing';

export function WorkbenchPage() {
  return (
    <>
      <PageTitle eyebrow="Analyze" title="SQL Workbench" lead="A notebook for SQL: cells that run DuckDB queries, chart their results and ask AI to fix, explain or optimise them." />
      <H2>Cells</H2>
      <P>Each cell holds one query. Run it with <b>Ctrl/⌘ + Enter</b>; the result appears below as a sortable, filterable grid you can switch to a chart. Cells keep their output, so a notebook reads like a report: question, query, answer.</P>
      <Clip id="sql-workbench" caption="Run SQL, chart the result, ask AI to explain it." />
      <H2>Writing queries</H2>
      <P>You write <b>DuckDB SQL</b> — close to Postgres, with extras that make analysis shorter:</P>
      <Code title="DuckDB shortcuts" code={`-- group by every non-aggregated column\nSELECT region, category, SUM(revenue) FROM sales_2025 GROUP BY ALL;\n\n-- month buckets and filters on aggregates\nSELECT date_trunc('month', order_date) AS m, SUM(revenue) AS rev\nFROM sales_2025 GROUP BY 1 HAVING rev > 10000 ORDER BY 1;\n\n-- top 3 products per region\nSELECT * FROM sales_2025\nQUALIFY row_number() OVER (PARTITION BY region ORDER BY revenue DESC) <= 3;`} />
      <P>Autocomplete suggests dataset and column names as you type. Instant lint checks flag common mistakes (missing <code>GROUP BY</code>, <code>SELECT *</code> on wide tables, unknown columns) before you run.</P>
      <H2>AI cell actions</H2>
      <Table head={['Action', 'What it does']} rows={[
        ['Fix', 'Reads the error message and your SQL, returns a corrected query for you to accept.'],
        ['Explain', 'Plain-English walk-through: which tables, filters, joins and what each column means.'],
        ['Optimize', 'Suggests a faster equivalent (pre-filtering, fewer scans) with the reason.'],
        ['Convert', 'Translates SQL from another dialect (Postgres, MySQL, BigQuery, T-SQL) to DuckDB.'],
      ]} />
      <Note>AI never runs SQL by itself in the Workbench: it proposes, you click to apply and run.</Note>
      <H2>Parameters</H2>
      <P>Use <code>{'{{name}}'}</code> placeholders to make a query reusable. Dashboards fill them from controls (date period, number, text). Values are passed safely, never pasted into the SQL string.</P>
      <Code code={`SELECT * FROM sales_2025 WHERE region = {{region}} AND revenue > {{min_revenue}}`} />
      <H2>Limits</H2>
      <List items={['Queries stop after 30 seconds (configurable on self-hosted).', 'Up to 10,000 rows are returned to the browser; aggregate first for big tables.', 'Identical queries within 15 minutes are served from a result cache.']} />
    </>
  );
}

export function BuilderPage() {
  return (
    <>
      <PageTitle eyebrow="Analyze" title="Visual Query Builder" lead="Build a query step by step — pick data, filter, join, group, sort — and watch the SQL write itself." />
      <H2>Steps</H2>
      <Steps steps={[
        { title: 'Pick data', body: <P>Choose a dataset. Columns appear grouped by kind (dates, numbers, categories).</P> },
        { title: 'Join (optional)', body: <P>Add another dataset. If a relationship is defined, the join keys are filled in; otherwise pick them. The preview shows how many rows matched.</P> },
        { title: 'Filter', body: <P>Conditions like <i>region is West</i>, <i>order_date in last 90 days</i>, <i>revenue &gt; 100</i>. Combine with AND/OR.</P> },
        { title: 'Summarize', body: <P>Pick a measure (sum, average, count, distinct count, min, max) and group-by columns. Dates can be bucketed by day, week, month, quarter or year.</P> },
        { title: 'Custom columns', body: <P>Add formulas such as <code>[revenue] - [cost]</code>. The AI formula writer turns “profit margin as a percent” into the expression and fixes broken ones.</P> },
        { title: 'Sort & limit, then visualize', body: <P>Results update live. Save as a chart or open the generated SQL in the Workbench to keep going by hand.</P> },
      ]} />
      <H2>Build by describing it</H2>
      <P>Type <i>“top 10 customers by revenue in 2025, only paid orders”</i> and the builder fills in every step. You can keep editing by chat (<i>“make it top 20”</i>, <i>“group by month too”</i>). Simple edits are applied instantly by rules; anything else goes to the AI model. <b>Undo</b> reverts any step.</P>
    </>
  );
}

export function AskPage() {
  return (
    <>
      <PageTitle eyebrow="AI" title="Ask in plain English" lead="Ask a business question; get the SQL, the result, a chart, a short summary and follow-up questions." />
      <H2>What happens when you ask</H2>
      <Steps steps={[
        { title: 'Context is assembled', body: <P>{BRAND_NAME} gathers the schema of the relevant datasets (table and column names, types, a few sample values), your metric definitions, glossary and verified queries. <b>Your full rows are not sent.</b></P> },
        { title: 'The model writes SQL', body: <P>Your configured AI provider returns a query — or a clarifying question if the request is ambiguous (<i>“By revenue, do you mean gross or net?”</i>).</P> },
        { title: 'The SQL is checked', body: <P>The read-only guard parses it; anything other than a single SELECT is refused. Unknown tables/columns trigger one automatic repair attempt.</P> },
        { title: 'It runs and is explained', body: <P>DuckDB runs it, a chart type is chosen from the result's shape (time → line, category → bar, one number → KPI), and you get a summary plus follow-ups.</P> },
      ]} />
      <H2>Asking good questions</H2>
      <Table code={false} head={['Instead of', 'Ask']} rows={[
        ['“sales”', '“total revenue by month in 2025”'],
        ['“best customers”', '“top 10 customers by revenue, last 90 days”'],
        ['“is it going down?”', '“weekly orders for the last 12 weeks vs the 12 before”'],
      ]} />
      <Tip title="Teach it your words">If Ask gets a term wrong, add a <b>definition</b> or save the corrected query as a <b>verified query</b>. Thumbs up/down feedback is stored too.</Tip>
      <H2>The AI Assistant (agent)</H2>
      <P>Inside the Workbench and dashboards, the assistant can take several steps: look at datasets, run queries, build a chart, add it to a dashboard. Each step is shown as it runs, and you can stop it.</P>
      <H2>AI providers</H2>
      <P>Pick a provider in <b>Settings → AI</b>: Gemini (free tier default), OpenAI, Anthropic, Groq or OpenRouter. You can store several keys per provider and switch automatically when one runs low. Answers use temperature 0 so the same question gives the same SQL.</P>
      <Warning>Free models (for example <code>openrouter/free</code>) pick a random model per request, so answers can vary. Pin a specific model for consistency.</Warning>
    </>
  );
}

const CHART_PINS: Pin[] = [
  { x: 24, y: 31, label: 'Chart type', text: 'switch type in one click.' },
  { x: 28, y: 57, label: 'Fields', text: 'x, y and colour encodings.' },
  { x: 58, y: 36, label: 'Live preview', text: 'updates on every change.' },
  { x: 55, y: 62, label: 'Suggestions', text: 'types that fit this data.' },
  { x: 90, y: 13.5, label: 'Style · Labels · Ask AI', text: '70+ options or describe the change.' },
];

export function ChartsPage() {
  return (
    <>
      <PageTitle eyebrow="Visualize" title="Charts" lead="A chart is a SQL query plus a visual spec. Change either one; the other follows." />
      <AnnotatedShot src={`${IMG}/chart-editor.webp`} alt="Chart studio" pins={CHART_PINS} />
      <H2>Encodings</H2>
      <P>A spec maps result columns to visual channels: <code>x</code> (category or time), <code>y</code> (one or more measures) and optional <code>color</code> (splits into series). Columns are picked automatically from the result, and you can override them.</P>
      <Code title="chart spec" code={`{ "type": "bar", "encoding": { "x": "region", "y": ["revenue", "profit"], "color": null } }`} />
      <H2>Which chart to use</H2>
      <Table head={['Type', 'Best for']} rows={[
        ['bar', 'Comparing categories (revenue by region). Horizontal for long labels.'],
        ['line / area', 'Trends over time. Area for cumulative or stacked totals.'],
        ['composed', 'Bars + line on two axes (revenue and margin %).'],
        ['kpi / gauge / progress', 'One headline number, optionally vs previous period or a target.'],
        ['pie / sunburst / treemap', 'Share of a whole; treemap for many categories.'],
        ['scatter / boxplot / histogram', 'Distributions and relationships between two measures.'],
        ['funnel / sankey / waterfall', 'Stages, flows and how a total is built up.'],
        ['radar / ranked / table', 'Multi-measure profiles, leaderboards, exact values.'],
      ]} />
      <H2>Styling</H2>
      <P>Over 70 options grouped as <b>Style</b> (palette, stacking, curves, bar radius), <b>Labels</b> (data labels, legend, number formats: currency, %, compact 1.2K), and <b>Axes</b> (ranges, log scale, gridlines). 24 templates give a polished start; <b>Ask AI</b> applies changes like <i>“make it horizontal and sort descending”</i>.</P>
      <H3>Pivot</H3>
      <P>Turn a long result (month, region, revenue) into one series per region without rewriting SQL.</P>
      <Accordion items={[
        { q: 'My chart shows only 10,000 rows', a: 'Results sent to the browser are capped. Aggregate in SQL (GROUP BY) — a chart rarely needs more points than pixels.' },
        { q: 'Why does a KPI show a different number than the table?', a: 'KPIs sum the whole result; check the chart\'s SQL filters. Hover the KPI to see the exact unrounded value.' },
      ]} />
    </>
  );
}
