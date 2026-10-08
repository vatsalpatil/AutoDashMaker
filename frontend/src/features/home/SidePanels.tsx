import { Link } from 'react-router-dom';
import { Database, Plus, Sparkles } from 'lucide-react';
import { sendToAsk } from '@/lib/askHandoff';
import { fmt } from '@/lib/utils';
import type { Dataset } from '@/lib/types';
import { QUICK_ACTIONS } from './homeModel';
import { Panel } from './Panel';

export function DataPanel({ datasets }: { datasets: Dataset[] }) {
  return (
    <Panel title="Your data" to="/sources" linkLabel="Manage">
      {datasets.length === 0
        ? <p className="px-4 py-4 text-sm text-muted-foreground">No datasets yet.</p>
        : <ul className="divide-y">
            {datasets.slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link to={`/datasets/${d.id}`} className="group flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-accent/50">
                  <Database className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-primary" title={d.name}>{d.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmt(d.row_count)} rows</span>
                </Link>
              </li>
            ))}
          </ul>}
      <Link to="/sources" className="flex items-center gap-1.5 border-t px-4 py-2 text-xs text-muted-foreground hover:text-primary"><Plus className="size-3.5" /> Add data</Link>
    </Panel>
  );
}

/** Starter questions built from the user's own tables; one click runs them in Ask. */
export function TryAsking({ questions, onAsk }: { questions: string[]; onAsk: () => void }) {
  if (!questions.length) return null;
  return (
    <Panel title="Try asking">
      <ul className="divide-y">
        {questions.slice(0, 4).map((q) => (
          <li key={q}>
            <button onClick={() => { sendToAsk(q); onAsk(); }} className="flex w-full items-start gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/50 hover:text-primary">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{q}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** One compact row of shortcuts under the stat tiles. */
export function QuickActions() {
  return (
    <section aria-label="Shortcuts" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {QUICK_ACTIONS.map(({ to, title, text, icon: Icon }) => (
        <Link key={to} to={to} title={text} className="group flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-sm font-medium shadow-xs transition-colors hover:border-primary hover:text-primary">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="size-4" /></span>
          <span className="truncate">{title}</span>
        </Link>
      ))}
    </section>
  );
}
