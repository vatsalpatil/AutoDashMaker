import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
// Standalone diagrams generated with the archify skill (sources in .archify/dashtor/*.json; re-run its finalize to update).
import systemUrl from '../architecture/system.html?url';
import flowUrl from '../architecture/flow.html?url';
import askUrl from '../architecture/ask.html?url';
import genUrl from '../architecture/gen.html?url';

const VIEWS = [
  { id: 'system', label: 'System', url: systemUrl, about: 'Every running part: browser apps, FastAPI, services, query engine, stores, Supabase and AI providers.' },
  { id: 'flow', label: 'Data pipeline', url: flowUrl, about: 'How data moves: sources → connectors → Parquet + metadata → SQL guard → charts, dashboards, Ask.' },
  { id: 'ask', label: 'Ask request', url: askUrl, about: 'One Ask question end to end: auth, AI writes SQL, validation, run, answer.' },
  { id: 'gen', label: 'AI dashboards', url: genUrl, about: 'The understand → plan → build → self-review workflow behind AI-generated dashboards.' },
];

/** How Dashtor is built and how a request flows through it (interactive archify diagrams). */
export function ArchitecturePage() {
  const [id, setId] = useState(VIEWS[0].id);
  const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
  return (
    <div className="flex h-[calc(100svh-6rem)] flex-col gap-3">
      <PageHeader title="Architecture" description={view.about}
        actions={<Button size="sm" label="Open full screen" onClick={() => window.open(view.url, '_blank', 'noopener')} />} />
      <div className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => setId(v.id)}
            className={cn('rounded-md px-3 py-1.5 text-sm', v.id === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
            {v.label}
          </button>
        ))}
      </div>
      <iframe key={view.id} src={view.url} title={view.label} className="min-h-0 flex-1 rounded-lg border bg-card" />
    </div>
  );
}
