import { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { ChartEncoding, QueryResult } from '@/lib/types';
import { suggestCharts, type Suggestion } from '../suggest';
import { SuggestionCards } from './SuggestionCards';

/**
 * Settings tab "Ask AI": say what you want to show; the AI (seeing only column names and 8 sample rows) picks the best
 * elements. Its picks borrow the rule engine's options for that type so they look right at once. One click = one AI request.
 */
export function AskAiPanel({ result, onPick }: { result?: QueryResult; onPick: (s: Suggestion, encoding: ChartEncoding) => void }) {
  const [goal, setGoal] = useState('');
  const [picks, setPicks] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!result) return <p className="text-xs text-muted-foreground">Run a query first; then the AI can recommend elements for its data.</p>;
  const ask = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api.post<{ suggestions: { type: string; title: string; reason: string }[] }>('/charts/suggest-ai', { columns: result.columns, rows: result.rows.slice(0, 8), goal });
      const rules = suggestCharts(result.columns, result.rows as Record<string, unknown>[]);
      const list = r.suggestions.map((a) => ({ ...(rules.find((x) => x.type === a.type) ?? { score: 0, options: {} }), ...a, title: `✨ ${a.title}` }));
      if (list.length === 0) setErr('The AI gave no usable answer. Try rephrasing, or use the suggestions under the preview.');
      setPicks(list);
    } catch (e) { setErr(e instanceof Error ? e.message : 'AI request failed'); } finally { setBusy(false); }
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
      <label className="flex flex-col gap-1.5 text-sm font-medium">What do you want to show?
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="e.g. which city grew fastest, share of each category, trend by month (optional)"
          className="rounded-md border bg-background p-2 text-xs font-normal" />
      </label>
      <button type="submit" disabled={busy} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Ask AI for the best element
      </button>
      <p className="text-[11px] text-muted-foreground">The AI sees column names and 8 sample rows only. Uses 1 AI request.</p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {picks && picks.length > 0 && <SuggestionCards list={picks} result={result} onPick={onPick} min={150} />}
    </form>
  );
}
