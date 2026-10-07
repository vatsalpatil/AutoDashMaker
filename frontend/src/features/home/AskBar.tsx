import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Sparkles } from 'lucide-react';
import { sendToAsk } from '@/lib/askHandoff';
import { greeting, todayLabel } from './recent';

/** One slim line to ask anything. Enter opens the Ask page and runs the question. */
export function AskBar({ hasData }: { hasData: boolean }) {
  const [text, setText] = useState('');
  const nav = useNavigate();
  const go = (q: string) => {
    if (!q.trim()) return;
    sendToAsk(q);
    nav('/ask');
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h1 className="text-xl font-semibold tracking-tight">{greeting()}</h1>
        <span className="text-sm text-muted-foreground">{todayLabel()}</span>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); go(text); }}
        className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Ask a question about your data"
          placeholder={hasData ? 'Ask your data anything… e.g. revenue by month, top 10 customers' : 'Add data first, then ask it anything'}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground" />
        <button type="submit" disabled={!text.trim()} aria-label="Ask"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
