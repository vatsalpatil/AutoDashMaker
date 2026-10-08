import { MessageSquare, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, Card } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { MetricValue, SemanticMetric } from '@/lib/types';
import { formatValue, trendDelta } from './metricModel';
import { Sparkline } from './Sparkline';

/** One governed metric: its live value, the last months as a sparkline, and how it is defined. */
export function MetricCard({ metric, value, datasetName, onAsk, onDelete }: {
  metric: SemanticMetric; value?: MetricValue; datasetName?: string; onAsk: () => void; onDelete: () => void;
}) {
  const delta = value ? trendDelta(value.trend) : null;
  const filters = metric.filters ?? [];
  return (
    <Card padding={4} className="group flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold" title={metric.label}>{metric.label}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge label={datasetName ?? 'No dataset'} />
            {filters.length > 0 && <Badge label={`${filters.length} filter${filters.length > 1 ? 's' : ''}`} />}
          </div>
        </div>
        <button onClick={onAsk} title="Ask about this metric" className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 focus:opacity-100"><MessageSquare className="size-4" /></button>
        <button onClick={onDelete} title="Delete metric" className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-4" /></button>
      </div>
      {!value ? <div className="h-14 animate-pulse rounded-md bg-muted" /> : value.error ? (
        <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">{value.error}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{formatValue(value.value)}</span>
            {delta !== null && (
              <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', delta >= 0 ? 'text-success' : 'text-destructive')} title="Latest month vs the month before">
                {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
          <Sparkline values={value.trend.map((t) => t.value)} />
        </>
      )}
      {metric.description && <p className="text-xs text-muted-foreground">{metric.description}</p>}
      <code className="mono mt-auto block truncate rounded bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground" title={value?.sql ?? metric.expression}>
        {metric.expression}{filters.length > 0 && ` WHERE ${filters.join(' AND ')}`}
      </code>
    </Card>
  );
}
