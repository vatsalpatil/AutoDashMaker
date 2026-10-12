import { Check, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReviewCheck { label: string; ok: boolean; detail: string }

/** The AI's self-review of a dashboard: a 0-100 score and what was checked. */
export function ReviewChecklist({ score, checks, compact }: { score: number; checks: ReviewCheck[]; compact?: boolean }) {
  const tone = score >= 85 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-destructive';
  return (
    <div className="rounded-lg border bg-card p-3 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <ShieldCheck className={cn('size-4', tone)} />
        <span className="text-sm font-semibold">Self-review</span>
        <span className={cn('ml-auto text-lg font-bold tabular-nums', tone)}>{score}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full bg-current transition-all duration-700', tone)} style={{ width: `${score}%` }} /></div>
      <ul className={cn('mt-2 grid gap-1', !compact && 'sm:grid-cols-2')}>
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-1.5 text-xs">
            {c.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <X className="mt-0.5 size-3.5 shrink-0 text-warning" />}
            <span><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">— {c.detail}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
