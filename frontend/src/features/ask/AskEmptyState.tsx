import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Upload } from 'lucide-react';
import { AttentionPanel } from '@/components/AttentionPanel';

/**
 * What Ask shows before the first question. With no data it points to the one thing to do first;
 * with data it offers starter questions generated from the real schema and says what an answer contains.
 */
export function AskEmptyState({ hasData, starters, onAsk, history }: {
  hasData: boolean; starters: string[]; onAsk: (q: string) => void; history: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" /></span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What do you want to know?</h1>
        <p className="mt-1 text-sm text-muted-foreground">I can see all your tables, saved queries and metrics. I write the SQL, run it, chart it and explain it.</p>
      </div>
      {!hasData ? (
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-5">
          <p className="text-sm text-muted-foreground">There is no data to ask about yet. Add a file or connect a source, then come back here.</p>
          <Link to="/sources" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Upload className="size-4" /> Add data <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : starters.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Suggested from your tables</span>
          <div className="flex max-w-3xl flex-wrap justify-center gap-2">
            {starters.map((q) => <button key={q} onClick={() => onAsk(q)} className="rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-xs transition-colors hover:border-primary hover:text-primary">{q}</button>)}
          </div>
        </div>
      )}
      {hasData && (
        <p className="max-w-xl text-xs text-muted-foreground">
          Every answer shows its SQL, the tables it used and a confidence badge. Like it? Press <span className="font-medium text-foreground">Save as chart</span> to keep it and add it to a dashboard.
        </p>
      )}
      {history}
      <div className="w-full text-left"><AttentionPanel /></div>
    </div>
  );
}
