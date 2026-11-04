import { ArchitectureSection } from '../DocsSections';
import { FeaturesReference } from '../FeaturesReference';
import { FaqSection } from '@/features/guide/sections/FaqSection';
import { Accordion, Code, H2, P, PageTitle, Table } from '../DocsKit';

export function ConfigPage() {
  return (
    <>
      <PageTitle eyebrow="Reference" title="Configuration" lead="Every backend setting, read from environment variables or backend/.env (names are case-insensitive)." />
      <H2>Core & storage</H2>
      <Table head={['Variable', 'Default', 'Meaning']} rows={[
        ['APP_URL', '(first CORS origin)', 'Public address; links in emails point here'],
        ['CORS_ORIGINS', 'localhost dev ports', 'Allowed browser origins (JSON list)'],
        ['MAX_UPLOAD_MB', '50', 'Largest file upload'],
        ['USER_QUOTA_MB', '250', 'Storage per user (hosted)'],
        ['MAX_ROWS_PER_DATASET', '5000000', 'Row cap per dataset'],
        ['MAX_DATASETS', '20', 'Datasets per user'],
        ['DISK_USAGE_LIMIT_PCT', '80', 'Uploads refused above this disk usage'],
      ]} />
      <H2>Query engine</H2>
      <Table head={['Variable', 'Default', 'Meaning']} rows={[
        ['DEFAULT_ROW_LIMIT', '10000', 'Rows returned to the browser'],
        ['QUERY_TIMEOUT_S', '30', 'Query is cancelled after this'],
        ['DUCKDB_MEMORY_LIMIT', '6GB', 'Engine memory before spilling to disk'],
        ['DUCKDB_THREADS', '3', 'CPU threads for queries'],
        ['RESULT_CACHE_TTL_S', '900', 'How long identical query results are reused'],
        ['RESULT_CACHE_ENTRIES', '512', 'Max cached results'],
      ]} />
      <H2>AI</H2>
      <Table head={['Variable', 'Default', 'Meaning']} rows={[
        ['DEFAULT_AI_PROVIDER', 'gemini', 'Provider used until one is set in Settings'],
        ['DEFAULT_AI_MODEL', 'gemini-2.0-flash', 'Model for that provider'],
        ['WHISPER_MODEL', 'base', 'Voice typing model: tiny | base | small'],
      ]} />
      <H2>Auth (hosted mode)</H2>
      <Table head={['Variable', 'Default', 'Meaning']} rows={[
        ['AUTH_ENABLED', 'false', 'Turn on login + per-user workspaces'],
        ['SUPABASE_URL / SUPABASE_ANON_KEY', '—', 'Your Supabase project (cloud or self-hosted)'],
        ['SUPABASE_SERVICE_KEY', '—', 'Secret; only used to change a user\'s email'],
        ['SUPABASE_JWT_SECRET', '—', 'Legacy HS256 projects; empty = verify via JWKS'],
        ['ADMIN_EMAILS', '[]', 'Who can open the backoffice'],
        ['ALLOW_USER_PYTHON', 'false', 'Allow Python transform layers for users'],
      ]} />
      <H2>Email & verification</H2>
      <Table head={['Variable', 'Default', 'Meaning']} rows={[
        ['SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM', '— / 587', 'Outgoing mail'],
        ['VERIFICATION_REQUIRED', 'false', 'Block unverified users after the grace period'],
        ['VERIFICATION_GRACE_DAYS', '7', 'Days before blocking'],
        ['SMS_PROVIDER', 'console', 'console (log only) or twilio + TWILIO_* keys'],
      ]} />
      <Code title="backend/.env (hosted example)" code={`AUTH_ENABLED=true\nSUPABASE_URL=https://xyz.supabase.co\nSUPABASE_ANON_KEY=...\nAPP_URL=https://dashtor.example.com\nADMIN_EMAILS=["you@example.com"]`} />
    </>
  );
}

export function ArchitecturePage() {
  return (
    <>
      <PageTitle eyebrow="Reference" title="Architecture" lead="How the pieces fit: React app, FastAPI, DuckDB, the metadata store, AI providers and MCP." />
      <ArchitectureSection />
      <H2>Request lifecycle of a chart</H2>
      <P>The browser asks <code>/api/charts/:id/data</code> → the router loads the chart from the metadata store → the SQL is validated read-only and rewritten for linked sources → the engine checks the result cache, else runs DuckDB with a timeout → rows are capped and returned with column types → the React chart renders them.</P>
      <H2>Code layout</H2>
      <Table head={['Folder', 'Role']} rows={[
        ['backend/app/routers', 'Thin HTTP endpoints (one file per area)'],
        ['backend/app/services', 'Business logic: engine, ingest, quality, ai, dashboards, mcp…'],
        ['backend/app/connectors', 'file, postgres, mysql, sqlite, rest, graphql, url'],
        ['backend/app/core', 'config, metadata store, security (SQL guard)'],
        ['frontend/src/features', 'Feature UIs (workbench, ai, dashboards, docs…)'],
      ]} />
      <P>Full HTTP reference with try-it-out: open <code>/docs</code> on your backend (FastAPI OpenAPI).</P>
    </>
  );
}

export function FeaturesPage() { return <FeaturesReference />; }

export function TroubleshootingPage() {
  return (
    <>
      <PageTitle eyebrow="Reference" title="Troubleshooting & FAQ" lead="Common errors, what they mean and how to fix them." />
      <H2>Common errors</H2>
      <Accordion items={[
        { q: '“Only read-only SELECT statements are allowed”', a: 'You sent a write, DDL or two statements. Remove the extra statement, or use a transform to create new data.' },
        { q: '“Table not found” / unknown column', a: 'Use the dataset\'s physical name (shown on the dataset page) and check column spelling; autocomplete in the Workbench lists both.' },
        { q: 'Query timed out', a: 'Filter earlier, aggregate, avoid SELECT * on wide tables, or raise QUERY_TIMEOUT_S on a self-hosted server.' },
        { q: 'Upload refused: disk / quota', a: 'Hosted users have 250 MB and 20 datasets — delete old datasets. Self-hosted: free disk space or raise DISK_USAGE_LIMIT_PCT.' },
        { q: 'AI says it is paused or out of quota', a: 'Your provider key hit its rate limit. Add a second key with auto-switch in Settings → AI, or wait for the daily reset.' },
        { q: 'Can\'t connect to my database', a: 'The host must be reachable from the server (not localhost on hosted). Check firewall, SSL mode and that the user has SELECT rights.' },
      ]} />
      <H2>FAQ</H2>
      <FaqSection />
    </>
  );
}
