import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { ChartEncoding, ChartType, QueryResult } from '@/lib/types';
import { suggestCharts, type Suggestion } from '../suggest';
import { SuggestionCards } from './SuggestionCards';

/** "Suggested for this data" under the preview: the rule engine's best picks for the query's columns (instant, no AI). */
export function SuggestionStrip({ result, current, onPick }: {
  result: QueryResult;
  current: ChartType;
  onPick: (s: Suggestion, encoding: ChartEncoding) => void;
}) {
  const list = useMemo(() => suggestCharts(result.columns, result.rows as Record<string, unknown>[], current), [result, current]);
  if (list.length === 0) return null;
  return (
    <section className="mt-4" aria-label="Suggested charts">
      <h3 className="mb-2 flex flex-wrap items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Suggested for this data
        <span className="text-xs font-normal text-muted-foreground">· for a goal-based pick, open the Ask AI tab in settings</span></h3>
      <SuggestionCards list={list} result={result} onPick={onPick} />
    </section>
  );
}
