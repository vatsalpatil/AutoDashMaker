import type { ReactNode } from 'react';
import { BookOpen, FileText, HelpCircle, Keyboard, Lightbulb, Map as MapIcon, Rocket, type LucideIcon } from 'lucide-react';
import { Code } from './GuideParts';

export type SectionId =
  | 'welcome'
  | 'getting-started'
  | 'concepts'
  | 'flows'
  | 'walkthroughs'
  | 'tips'
  | 'faq';

export interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

export const SECTIONS: SectionDef[] = [
  { id: 'welcome', label: 'Welcome', icon: BookOpen },
  { id: 'getting-started', label: 'Getting Started', icon: Rocket },
  { id: 'concepts', label: 'Concepts', icon: Lightbulb },
  { id: 'flows', label: 'Workflows', icon: MapIcon },
  { id: 'walkthroughs', label: 'Feature Walkthroughs', icon: FileText },
  { id: 'tips', label: 'Keyboard & Tips', icon: Keyboard },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

export const WALKTHROUGHS: { title: string; steps: string[] }[] = [
  {
    title: 'Ask page',
    steps: [
      'Open Ask from the sidebar, pick a dataset, and type a question in plain language.',
      'Press Enter to submit — the AI generates SQL, runs it, and explains the result with insights and a confidence score.',
      'Ask follow-up questions in the same thread to refine the analysis.',
      'Give feedback with the ✓ / ✕ buttons on any answer to teach the system.',
      'Mark a great answer as verified to add it to the verified query library for your team.',
    ],
  },
  {
    title: 'Workbench',
    steps: [
      'Open Workbench for a full SQL editor — pick a dataset, write SQL, and run it.',
      'Open the AI assistant panel to generate or fix SQL from a description; press Enter to send.',
      'Chain transform layers: SQL layers reference the previous layer as {df}, Python layers get it as the result variable.',
      'Save any result as a derived dataset or as a chart.',
    ],
  },
  {
    title: 'Datasets',
    steps: [
      'Open Datasets to see every ingested table with its freshness status.',
      'Click "why?" on a dataset to understand how a value or freshness state was computed.',
      'Use Transform to build derived datasets with SQL/Python layers.',
      'Use Blend to join multiple datasets into one.',
    ],
  },
  {
    title: 'Dashboards',
    steps: [
      'Open Dashboards and create a dashboard, then add saved charts to it.',
      'Drag to move and resize tiles in the editor; toggle fit/scroll layout modes.',
      'Organize with multiple pages per dashboard.',
      'Use fullscreen for presentations, Brief for an AI-generated summary, and Lineage to trace where each tile’s data comes from.',
    ],
  },
  {
    title: 'Alerts',
    steps: [
      'Open Alerts and create a rule on a chart or metric (threshold, change, or anomaly).',
      'The backend checks rules on a schedule and fires a notification when triggered.',
      'Acknowledge alerts to clear them and keep an audit trail.',
    ],
  },
  {
    title: 'Quality',
    steps: [
      'Open Quality to define checks (nulls, uniqueness, ranges, freshness) on datasets.',
      'Checks run on ingest and on schedule; failures surface as badges on the dataset.',
    ],
  },
  {
    title: 'Metrics (semantic layer)',
    steps: [
      'Open Metrics to define business metrics once — name, expression, dimensions, owner.',
      'Metrics feed the semantic context so the AI answers questions with consistent definitions.',
    ],
  },
];

export const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'Where is my data stored?',
    a: (
      <>
        Locally, in a DuckDB database under <Code>backend/data</Code> on the machine running the backend. Nothing is
        uploaded to a third-party storage service.
      </>
    ),
  },
  {
    q: 'Is my data safe when using the AI?',
    a: 'AI-generated queries run as read-only SELECT statements against the local database — they cannot modify or delete your data. Only schema metadata and small samples are sent to the LLM provider you configure.',
  },
  {
    q: 'Which AI providers are supported?',
    a: 'Providers are managed in Settings → AI providers. The catalog includes hosted providers (bring your own API key) and free options — Gemini offers a free tier that works well for getting started.',
  },
  {
    q: 'Do I need to know SQL?',
    a: 'No. The Ask page turns plain-language questions into SQL for you. SQL is there when you want full control in the Workbench, but it is never required.',
  },
  {
    q: 'What is the difference between a dataset and a metric?',
    a: 'A dataset is a physical table of data (ingested or derived). A metric is a semantic definition — a named calculation like "Monthly Revenue" — that lives in the semantic layer and keeps answers consistent.',
  },
  {
    q: 'Can I share a dashboard?',
    a: 'Dashboards live in the app and can be shown in fullscreen mode for presentations. Use the Brief feature to generate a shareable narrative summary of a dashboard.',
  },
  {
    q: 'Why does a dataset show a freshness warning?',
    a: 'Freshness compares the dataset’s last update against its expected schedule. Click "why?" on the dataset to see exactly how the status was computed and what to fix.',
  },
  {
    q: 'How do alerts get delivered?',
    a: 'Alert rules are evaluated on a schedule by the backend. Triggered alerts appear in the Alerts page and can be acknowledged there; check your alert rule settings for notification options.',
  },
];
