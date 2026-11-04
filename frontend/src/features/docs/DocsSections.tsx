import { H2, P } from '@/features/guide/GuideParts';
import { AnnotatedShot, Callout, Clip, type Pin } from './DocsParts';

const IMG = '/images/landing';

const HOME_PINS: Pin[] = [
  { x: 8, y: 22, label: 'Sidebar', text: 'every tool: Ask, sources, Workbench, charts, dashboards.' },
  { x: 40, y: 44, label: 'Ask bar', text: 'type a question in plain English.' },
  { x: 55, y: 52, label: 'Workspace stats', text: 'datasets, dashboards, charts and live alerts at a glance.' },
  { x: 62, y: 61, label: 'Quick actions', text: 'jump straight into building.' },
  { x: 85, y: 72, label: 'Your data', text: 'uploaded datasets with row counts.' },
];
const CHART_PINS: Pin[] = [
  { x: 24, y: 31, label: 'Chart type', text: 'pick from 30+ types; one click switches.' },
  { x: 28, y: 57, label: 'Fields', text: 'choose what to slice by and what to measure.' },
  { x: 58, y: 36, label: 'Live preview', text: 'updates as you change anything.' },
  { x: 55, y: 62, label: 'Suggestions', text: 'chart types that fit this data shape.' },
  { x: 90, y: 13.5, label: 'Style · Labels · Ask AI', text: '70+ options, or describe the change.' },
];
const DASH_PINS: Pin[] = [
  { x: 24, y: 13.4, label: 'Edit with AI', text: '"add a profit-by-region bar" and it is done.' },
  { x: 81, y: 10, label: 'Share / Present', text: 'public read-only link or full-screen mode.' },
  { x: 30, y: 17.5, label: 'Filters', text: 'let viewers slice every widget at once.' },
  { x: 29, y: 41, label: 'KPI cards', text: 'headline numbers with exact values on hover.' },
  { x: 45, y: 65, label: 'Trend widgets', text: 'drag, resize and rearrange on a 12-column grid.' },
];

/** Concrete, end-to-end examples with clips and annotated screens. */
export function UseCasesSection() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <H2>Tour of the home screen</H2>
        <P>Hover a number to highlight what it points at.</P>
        <AnnotatedShot src={`${IMG}/home-screen.webp`} alt="Home screen" pins={HOME_PINS} />
      </div>
      <div className="flex flex-col gap-3">
        <H2>Use case 1 · Monthly sales report from a CSV</H2>
        <P>Example: <code>sales_2025.csv</code> with 1,500 orders (date, region, category, units, revenue, profit).</P>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
          <li><b className="text-foreground">Data Sources → Add data</b> and drop the CSV. Columns are typed and profiled automatically.</li>
          <li>Open the dataset to check quality — nulls, outliers and duplicates are flagged.</li>
          <li><b className="text-foreground">Ask</b>: "revenue by month in 2025" → you get SQL, a chart and a summary.</li>
          <li>Save the answer as a chart, then <b className="text-foreground">Dashboards → Generate</b> to build the rest.</li>
        </ol>
        <div className="grid gap-4 sm:grid-cols-2">
          <Clip id="profile-a-dataset" caption="Step 2 — every column profiled with a quality score." />
          <Clip id="dashboard" caption="Step 4 — the finished dashboard, ready to share." />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <H2>Use case 2 · Analyst digging with SQL</H2>
        <P>In the <b>Workbench</b>, write <code>SELECT region, SUM(profit) FROM sales_2025 GROUP BY 1</code> with autocomplete, or ask the AI cell to fix, explain or optimise it.</P>
        <Clip id="sql-workbench" caption="Notebook cells: run SQL, chart the result, ask AI to explain." />
      </div>
      <div className="flex flex-col gap-3">
        <H2>Use case 3 · Designing the perfect chart</H2>
        <AnnotatedShot src={`${IMG}/chart-editor.webp`} alt="Chart editor" pins={CHART_PINS} />
        <Clip id="chart-editor" caption="Switching between bar, area, treemap and donut with a live preview." />
      </div>
      <div className="flex flex-col gap-3">
        <H2>Use case 4 · A dashboard your team checks every morning</H2>
        <AnnotatedShot src={`${IMG}/dashboard-overview.webp`} alt="Dashboard" pins={DASH_PINS} />
        <Callout title="Keep it fresh">Turn on auto-refresh, add an <b>Alert</b> ("revenue drops 20% week over week") and a scheduled <b>Report</b> to email the dashboard every Monday.</Callout>
      </div>
    </div>
  );
}
