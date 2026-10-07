import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/hooks/useApi';
import { sendToAsk } from '@/lib/askHandoff';
import { firstName, greeting } from './homeModel';

/** Home's centrepiece: a greeting and one big box. Whatever is typed opens the Ask page and runs. */
export function HeroAsk({ hasData }: { hasData: boolean }) {
  const [text, setText] = useState('');
  const nav = useNavigate();
  const name = firstName(useAuth().email);
  const starters = useApi<{ questions: string[] }>(hasData ? '/ai/suggestions' : null).data?.questions ?? [];

  const go = (q: string) => {
    if (!q.trim()) return;
    sendToAsk(q);
    nav('/ask');
  };

  return (
    <section className="flex flex-col items-center gap-5 pt-4 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" /></span>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{greeting()}{name ? `, ${name}` : ''}</h1>
        <p className="mt-1 text-muted-foreground">{hasData ? 'What do you want to know about your data?' : 'Add some data, then ask it anything.'}</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); go(text); }}
        className="flex w-full max-w-2xl items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <textarea value={text} rows={2} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(text); } }}
          placeholder="Ask anything… e.g. What was revenue by month last year?"
          className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
        <button type="submit" disabled={!text.trim()} aria-label="Ask"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
          <ArrowUp className="size-4" />
        </button>
      </form>
      {starters.length > 0 && (
        <div className="flex max-w-3xl flex-wrap justify-center gap-2">
          {starters.slice(0, 4).map((q) => (
            <button key={q} onClick={() => go(q)}
              className="rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-xs transition-colors hover:border-primary hover:text-primary">{q}</button>
          ))}
        </div>
      )}
    </section>
  );
}
