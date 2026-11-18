import { MessageSquare, Pin, PinOff, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { MetricValue } from '@/lib/types';
import { formatValue, trendDelta } from './metricModel';
import { Sparkline } from './Sparkline';

/** What a tile needs: a saved metric or a suggestion, both have these. */
export interface NumberDef { label: string; expression: string; filters?: string[]; description?: string | null }

/** One live number: value, change vs last month, the last months as a sparkline. Pinned = saved as a metric (Ask knows it by name). */
export function MetricCard({ metric, value, datasetName, pinned, busy, onAsk, onPin, onUnpin }: {
  metric: NumberDef; value?: MetricValue; datasetName?: string; pinned: boolean; busy?: boolean;
  onAsk: () => void; onPin?: () => void; onUnpin?: () => void;
}) {
  const delta = value ? trendDelta(value.trend) : null;
  const filters = metric.filters ?? [];
  const how = `${metric.expression}${filters.length > 0 ? ` WHERE ${filters.join(' AND ')}` : ''}`;
  return (
    <Card padding={4} className="group flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold" title={metric.label}>{metric.label}</div>
          {datasetName && <div className="mt-0.5"><Badge label={datasetName} /></div>}
        </div>
        {pinned && onUnpin && (
          <button onClick={onUnpin} title="Unpin" className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"><PinOff className="size-4" /></button>
        )}
      </div>
      {!value ? <div className="h-14 animate-pulse rounded-md bg-muted" /> : value.error ? (
        <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">{value.error}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{formatValue(value.value)}</span>
            {delta !== null && (
              <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', delta >= 0 ? 'text-success' : 'text-destructive')} title="Latest month vs the month before">
                {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{Math.abs(delta).toFixed(1)}% vs last month
              </span>
            )}
          </div>
          <Sparkline values={value.trend.map((t) => t.value)} />
        </>
      )}
      {metric.description && <p className="text-xs text-muted-foreground">{metric.description}</p>}
      <div className="mt-auto flex items-center gap-1.5 pt-1">
        {!pinned && onPin && <Button size="sm" variant="primary" label="Pin" icon={<Pin className="size-3.5" />} onClick={onPin} isDisabled={busy} />}
        <Button size="sm" label="Ask why" icon={<MessageSquare className="size-3.5" />} onClick={onAsk} />
        <code className="mono ml-auto truncate text-[11px] text-muted-foreground" title={value?.sql ?? how}>{how}</code>
      </div>
    </Card>
  );
}
