import { BarChart3, Database, LayoutDashboard, ShieldCheck, Sparkles, Workflow, type LucideIcon } from 'lucide-react';

/** Real screenshots of the app (captured from a local workspace), served from `public/images/landing/`. */
export const SHOTS = {
  hero: { src: '/images/landing/dashboard-overview.webp', alt: 'A Dashtor dashboard with revenue KPIs, a monthly revenue area chart and revenue by category' },
  showcase: [
    { src: '/images/landing/home-screen.webp', title: 'Your data at a glance', text: 'Home shows your datasets, dashboards and recent work, with a box to ask your data anything.' },
    { src: '/images/landing/dataset-profile.webp', title: 'Understand every dataset', text: 'Upload a file and Dashtor profiles it: types, nulls, distinct values, quality and versions.' },
    { src: '/images/landing/chart-editor.webp', title: 'Charts without the fiddling', text: '20+ chart types, live preview and suggestions that fit the shape of your data.' },
    { src: '/images/landing/chart-library.webp', title: 'Reuse what you build', text: 'Every chart is backed by a saved query and can be dropped into any dashboard.' },
  ],
};

export const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Sparkles, title: 'Ask in plain English', text: 'Type a question, get the query, the answer and a chart. The SQL is checked before it runs.' },
  { icon: Database, title: 'Bring any data', text: 'CSV, Excel, Parquet, JSON, databases and APIs, loaded into a fast DuckDB engine.' },
  { icon: Workflow, title: 'Build without SQL', text: 'A visual query builder for everyone, and a SQL notebook for those who prefer it.' },
  { icon: BarChart3, title: 'Charts that explain', text: 'Pick from 20+ types, style them, and let Dashtor suggest the clearest one.' },
  { icon: LayoutDashboard, title: 'Dashboards in minutes', text: 'Drag-and-drop layouts, filters, pages, presenting, PDF export and share links.' },
  { icon: ShieldCheck, title: 'Data you can trust', text: 'Quality scores, tests, lineage, alerts and an audit trail for every change.' },
];
