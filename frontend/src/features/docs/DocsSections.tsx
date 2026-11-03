import { BRAND_NAME } from '@/lib/brand';
import { FlowDiagram } from '@/features/guide/FlowDiagram';
import { ConceptCard, H2, P } from '@/features/guide/GuideParts';
import { AnnotatedShot, Callout, Clip, CodeBlock, type Pin } from './DocsParts';

const IMG = '/images/landing';

/** System architecture: browser → API → engines → storage, plus the AI layer. */
export function ArchitectureSection() {
  const nodes = [
    { id: 'ui', x: 10, y: 120, w: 130, h: 54, label: 'React web app', sub: 'Vite · shadcn · Recharts' },
    { id: 'mcp', x: 10, y: 220, w: 130, h: 54, label: 'Your AI (MCP)', sub: 'Claude · ChatGPT · Cursor', tone: 'ai' as const },
    { id: 'api', x: 200, y: 160, w: 130, h: 64, label: 'FastAPI backend', sub: 'routers → services' },
    { id: 'guard', x: 390, y: 40, w: 140, h: 50, label: 'Read-only SQL guard', sub: 'sqlglot validation', tone: 'alert' as const },
    { id: 'engine', x: 390, y: 130, w: 140, h: 50, label: 'DuckDB engine', sub: 'queries · Parquet' },
    { id: 'meta', x: 390, y: 210, w: 140, h: 50, label: 'Metadata store', sub: 'charts · dashboards' },
    { id: 'ai', x: 390, y: 290, w: 140, h: 50, label: 'AI providers', sub: 'Gemini · OpenAI · Claude…', tone: 'ai' as const },
    { id: 'src', x: 590, y: 130, w: 130, h: 54, label: 'Your sources', sub: 'CSV · Postgres · REST…' },
  ];
  const edges = [
    { from: 'ui', to: 'api', label: '/api' }, { from: 'mcp', to: 'api', label: 'token' },
    { from: 'api', to: 'guard' }, { from: 'api', to: 'engine' }, { from: 'api', to: 'meta' }, { from: 'api', to: 'ai' },
    { from: 'engine', to: 'src', label: 'ingest' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <H2>How {BRAND_NAME} is built</H2>
      <P>A React app talks to one FastAPI backend. Data is pulled from your sources into DuckDB (stored as Parquet), and every query passes a read-only SQL guard before it runs. AI is optional and pluggable.</P>
      <div className="rounded-xl border bg-card p-4"><FlowDiagram nodes={nodes} edges={edges} width={730} height={350} /></div>
      <H2>The data pipeline</H2>
      <div className="rounded-xl border bg-card p-4">
        <FlowDiagram width={730} height={90} edges={['src', 'ds', 'q', 'c'].map((f, i) => ({ from: f, to: ['ds', 'q', 'c', 'd'][i] }))}
          nodes={[['src', 'Source', 'file · DB · API'], ['ds', 'Dataset', 'profiled + scored'], ['q', 'Query', 'SQL · builder · Ask'], ['c', 'Chart', '30+ types'], ['d', 'Dashboard', 'share · alert · report']]
            .map(([id, label, sub], i) => ({ id, label, sub, x: 10 + i * 148, y: 18, w: 118, h: 54, tone: id === 'q' ? 'ai' as const : undefined }))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConceptCard title="Safe by design">Every SQL statement — typed, built or written by AI — is checked to be read-only before DuckDB runs it.</ConceptCard>
        <ConceptCard title="Auditable answers">Explanations, confidence and "why" notes are rule-based, so you can see exactly where a number came from.</ConceptCard>
      </div>
    </div>
  );
}

/** Running it yourself. */
export function SetupSection() {
  return (
    <div className="flex flex-col gap-4">
      <H2>Run {BRAND_NAME} on your machine</H2>
      <P>You need Python 3.12 and Node 20+. The backend and the web app run in two terminals.</P>
      <h3 className="font-semibold">1 · Backend (port 8000)</h3>
      <CodeBlock code={`cd backend\npython -m venv .venv\n.venv\\Scripts\\activate        # macOS/Linux: source .venv/bin/activate\npip install -r requirements.txt\npython Main.py`} />
      <h3 className="font-semibold">2 · Web app (port 5174)</h3>
      <CodeBlock code={`cd frontend\nnpm install\nnpm run dev`} />
      <P>Open http://localhost:5174. The interactive API reference is at http://127.0.0.1:8000/docs.</P>
      <h3 className="font-semibold">3 · Optional settings (backend/.env)</h3>
      <CodeBlock title="backend/.env" code={`# Leave Supabase unset for single-user local mode (no login)\nSUPABASE_URL=...\nSUPABASE_ANON_KEY=...\nAPP_URL=http://localhost:5174`} />
      <Callout title="AI keys">Add a Gemini, OpenAI, Anthropic, Groq or OpenRouter key in <b>Settings → AI</b>. Keys are encrypted at rest. Without a key everything except AI features still works — or connect your own AI over MCP.</Callout>
      <h3 className="font-semibold">Deploy with Docker</h3>
      <P>Both <code>backend/</code> and <code>frontend/</code> ship a Dockerfile. Point any Docker host (Dokploy, Coolify, Fly…) at each folder, set the same .env values on the backend and you're live.</P>
    </div>
  );
}

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
