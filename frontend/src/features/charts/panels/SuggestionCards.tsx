import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import type { ChartEncoding, ChartType, QueryResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { kindOf } from '../chartKinds';
import { ChartView } from '../render/ChartView';
import type { Suggestion } from '../suggest';
import { autoEncode } from '../templates';

const PREVIEW_ROWS = 200;   // the preview only needs the shape, not every row

const encodingFor = (s: Suggestion, result: QueryResult) =>
  ({ ...autoEncode(s.type as ChartType, result), ...(s.encoding ?? {}) }) as ChartEncoding;

/**
 * Suggestions as a list of options: clicking one previews just that option; "Use this chart" puts it in the main chart
 * (nothing is saved until Save). Used under the studio preview and in the Ask AI tab; wraps to one column when narrow.
 */
export function SuggestionCards({ list, result, onPick }: {
  list: Suggestion[];
  result: QueryResult;
  onPick: (s: Suggestion, encoding: ChartEncoding) => void;
}) {
  const [sel, setSel] = useState(0);
  const small = useMemo(() => ({ ...result, rows: result.rows.slice(0, PREVIEW_ROWS) }), [result]);
  const cur = list[Math.min(sel, list.length - 1)];
  if (!cur) return null;
  const type = cur.type as ChartType;
  const encoding = encodingFor(cur, result);
  return (
    <div className="flex flex-wrap gap-3">
      <ul className="flex min-w-[200px] flex-1 basis-[220px] flex-col gap-1" role="listbox" aria-label="Suggested elements">
        {list.map((s, i) => {
          const Icon = kindOf(s.type as ChartType).icon;
          const on = s === cur;
          return (
            <li key={`${s.type}-${s.title}`}>
              <button type="button" role="option" aria-selected={on} onClick={() => setSel(i)}
                className={cn('flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors hover:border-primary',
                  on ? 'border-primary bg-primary/10' : 'bg-card')}>
                <Icon className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs font-semibold">{s.title}</span>
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">{s.reason}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex min-w-[260px] flex-[2] basis-[320px] flex-col gap-2 rounded-lg border bg-card p-2">
        <div className="pointer-events-none min-h-0 overflow-hidden">
          <ChartView key={`${cur.type}-${cur.title}`} spec={{ type, encoding, options: { ...cur.options, animate: false } }} result={small} height={260} plain />
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <span className="truncate text-xs text-muted-foreground">Preview: <b className="text-foreground">{cur.title}</b></span>
          <Button type="button" size="sm" icon={<Check className="size-3.5" />} onClick={() => onPick(cur, encoding)}>Use this chart</Button>
        </div>
      </div>
    </div>
  );
}
