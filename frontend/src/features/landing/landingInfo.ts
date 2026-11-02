import { Bell, BriefcaseBusiness, Code2, Eye, FileCheck2, History, KeyRound, LineChart, Lock, Smartphone, Users, Zap, type LucideIcon } from 'lucide-react';

/** Bullet points shown under each showcase screenshot (same order as SHOTS.showcase). */
export const SHOWCASE_POINTS: string[][] = [
  ['Counts of datasets, dashboards, charts and active alerts', 'One box to ask a question from anywhere', 'Recent work and suggested questions built from your own columns'],
  ['Automatic profiling: type, null %, distinct values and samples per column', 'Quality score, data tests and a "Why?" view that explains changes', 'Transforms and versions, so every change can be traced and undone'],
  ['Bar, line, area, combo, pie, funnel, treemap, sankey, gauge, pivot and more', 'Labels, colours, legends, number formats and tooltips in one panel', 'Suggestions that match the shape of your data, plus "Ask AI" for styling'],
  ['Every chart backed by a saved, validated query', 'See where each chart is used before you change it', 'Search, filter and clean up unused charts in one place'],
];

/** "Built for every role" cards. */
export const AUDIENCES: { icon: LucideIcon; title: string; text: string; points: string[] }[] = [
  { icon: BriefcaseBusiness, title: 'Business teams', text: 'Get answers without waiting for a report.',
    points: ['Ask in plain English', 'Ready-made dashboards', 'Scheduled reports and alerts'] },
  { icon: LineChart, title: 'Analysts', text: 'Go from question to dashboard in minutes.',
    points: ['Visual query builder', 'Rich chart editor', 'Filters, pages and parameters'] },
  { icon: Code2, title: 'Data engineers', text: 'Full control when you need it.',
    points: ['SQL notebook on DuckDB', 'Linked sources and refresh schedules', 'Lineage, tests and versions'] },
];

/** Security & trust grid. */
export const TRUST: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: 'Read-only by design', text: 'Every query is checked before it runs; nothing can change or delete your data.' },
  { icon: Users, title: 'Private workspaces', text: 'Each account gets its own isolated workspace and storage.' },
  { icon: Eye, title: 'Explainable answers', text: 'See the SQL, the steps and the confidence behind every AI answer.' },
  { icon: FileCheck2, title: 'Quality checks', text: 'Scores and tests flag missing, duplicate or out-of-range values early.' },
  { icon: History, title: 'Full audit trail', text: 'Every query, edit and share is recorded in the activity log.' },
  { icon: KeyRound, title: 'Your choice of AI', text: 'Use Gemini, OpenAI, Anthropic, Groq or OpenRouter with your own keys.' },
  { icon: Bell, title: 'Alerts that watch for you', text: 'Get notified when a metric crosses a threshold or data goes stale.' },
  { icon: Zap, title: 'Fast by default', text: 'An in-process DuckDB engine and a result cache keep pages quick, even on big tables.' },
  { icon: Smartphone, title: 'Works everywhere', text: 'Responsive on phone, tablet and desktop, with light and dark themes.' },
];

/** Default per-account limits on the hosted site (backend config: MAX_UPLOAD_MB, USER_QUOTA_MB, MAX_ROWS_PER_DATASET, MAX_DATASETS). Keep in sync. */
export const UPLOAD_LIMITS: { value: string; label: string; note: string }[] = [
  { value: '50 MB', label: 'per file', note: 'Larger files are stopped during upload' },
  { value: '250 MB', label: 'storage per account', note: 'Counted after compression' },
  { value: '5M', label: 'rows per dataset', note: 'Up to 5,000,000 rows each' },
  { value: '20', label: 'datasets per account', note: 'Delete one to add another' },
];

export const UPLOAD_RULES: string[] = [
  'Files: CSV, TSV, Excel (.xlsx, .xls), Parquet, JSON and NDJSON.',
  'Connections: PostgreSQL, MySQL, SQLite, REST APIs and web links (CSV / JSON).',
  'Your first row should hold column names; types (numbers, dates, text) are detected automatically.',
  'Data is stored compressed, so a 50 MB CSV usually takes far less of your 250 MB.',
  'Your data is private to your workspace and is only ever read, never changed at the source.',
  'Queries return up to 10,000 rows on screen and stop after 30 seconds, to keep the app fast for everyone.',
  'Uploads pause if the server runs low on disk space; try again later or remove old datasets.',
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'Do I need to know SQL?', a: 'No. Ask in plain English or use the visual query builder. The SQL is generated for you, and you can always view or edit it.' },
  { q: 'What data can I bring?', a: 'CSV, Excel, Parquet and JSON files, plus databases and REST APIs. Data is loaded into a fast DuckDB engine for analysis.' },
  { q: 'Is my data safe?', a: 'Each account has its own private workspace, and every query is validated as read-only before it runs. Your source data is never modified.' },
  { q: 'Which AI does it use?', a: 'Gemini by default, or OpenAI, Anthropic, Groq and OpenRouter. Answers include the query and an explanation, so you can check them.' },
  { q: 'Can I share dashboards?', a: 'Yes: present them full screen, export to PDF, schedule reports, or share a read-only link with anyone.' },
];
