import { useMemo } from 'react';
import type { ChartEncoding, ChartType, QueryResult } from '@/lib/types';
import { kindOf } from '../chartKinds';
import { ChartView } from '../render/ChartView';
import type { Suggestion } from '../suggest';
import { autoEncode } from '../templates';

const PREVIEW_ROWS = 60;   // mini previews only need the shape, not every row

/** Clickable suggestion cards, each a small live preview of the chart with its reason. Used under the preview and in Ask AI. */
export function SuggestionCards({ list, result, onPick, min = 190 }: {
  list: Suggestion[];
  result: QueryResult;
  onPick: (s: Suggestion, encoding: ChartEncoding) => void;
  min?: number;
}) {
  const small = useMemo(() => ({ ...result, rows: result.rows.slice(0, PREVIEW_ROWS) }), [result]);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {list.map((s) => {
        const type = s.type as ChartType;
        const encoding = { ...autoEncode(type, result), ...(s.encoding ?? {}) } as ChartEncoding;
        const Icon = kindOf(type).icon;
        return (
          <button key={`${s.type}-${s.title}`} type="button" onClick={() => onPick(s, encoding)} title={`Use ${s.title}: ${s.reason}`}
            className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary">
            <div className="pointer-events-none h-32 overflow-hidden border-b p-1">
              <ChartView spec={{ type, encoding, options: { ...s.options, animate: false, showLegend: false } }} result={small} height={120} plain />
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              <span className="flex items-center gap-1 text-xs font-semibold group-hover:text-primary"><Icon className="size-3.5" />{s.title}</span>
              <span className="line-clamp-3 text-[11px] text-muted-foreground">{s.reason}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
