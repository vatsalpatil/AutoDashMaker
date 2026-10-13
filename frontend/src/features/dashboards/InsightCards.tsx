import { AlertTriangle, ArrowDownRight, ArrowUpRight, Award, Compass, GitCompare, PieChart, Sigma, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Insight { label: string; value: string; detail: string; tone: 'up' | 'down' | 'neutral' | 'warn'; kind: 'total' | 'trend' | 'rank' | 'share' | 'compare' | 'risk' }

const KIND = { total: Sigma, trend: TrendingUp, rank: Award, share: PieChart, compare: GitCompare, risk: AlertTriangle } as const;
const TONE = {
  up: 'text-success bg-success/10 border-success/30',
  down: 'text-destructive bg-destructive/10 border-destructive/30',
  warn: 'text-warning bg-warning/10 border-warning/30',
  neutral: 'text-primary bg-primary/10 border-primary/30',
} as const;

/** AI insights as scannable stat cards: icon by kind, headline value, one supporting sentence, tone colour; plus a "look next" prompt. */
export function InsightCards({ items, lookNext }: { items: Insight[]; lookNext?: string }) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto @container">
      <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4">
        {items.map((it, i) => {
          const Icon = KIND[it.kind] ?? Sigma;
          return (
            <div key={i} className="group flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
              style={{ animationDelay: `${i * 50}ms` }}>
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border', TONE[it.tone] ?? TONE.neutral)}><Icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{it.label}</p>
                <p className="flex items-center gap-1 truncate text-xl font-bold tabular-nums leading-tight" title={it.value}>
                  {it.value}
                  {it.tone === 'up' && <ArrowUpRight className="size-4 shrink-0 text-success" />}
                  {it.tone === 'down' && <ArrowDownRight className="size-4 shrink-0 text-destructive" />}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{it.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
      {lookNext && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/30 p-3 text-sm">
          <Compass className="mt-0.5 size-4 shrink-0 text-primary" /><span><b>Look next:</b> {lookNext}</span>
        </p>
      )}
    </div>
  );
}
