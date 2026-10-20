import { Shuffle } from 'lucide-react';
import { Card } from '@/components/ui/kit';
import { Ring } from './ProviderUsageCard';
import { compact, type ProviderUsage } from './usageModel';

/** All connected keys together: requests left today across every key with a known limit, and which key auto-switch uses next. */
export function PoolSummary({ providers }: { providers: ProviderUsage[] }) {
  const capped = providers.filter((p) => p.limits.rpd);
  const left = capped.reduce((n, p) => n + (p.blocked ? 0 : p.remaining.requests ?? 0), 0);
  const total = capped.reduce((n, p) => n + (p.limits.rpd ?? 0), 0);
  const active = providers.find((p) => p.is_default) ?? providers[0];
  const score = (p: ProviderUsage) => (p.blocked ? 0 : p.remaining.pct ?? 100);
  const next = active.auto_switch && score(active) <= active.switch_below
    ? [...providers].sort((a, b) => score(b) - score(a))[0] : active;
  const unlimited = providers.length - capped.length;

  return (
    <Card padding={4}>
      <div className="flex flex-wrap items-center gap-5">
        <Ring pct={total ? Math.round((100 * left) / total) : null} label={total ? compact(left) : '∞'} sub={total ? `of ${compact(total)} left` : 'no fixed cap'} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">All keys together</p>
          <p className="text-muted-foreground">{providers.length} keys connected{unlimited ? ` · ${unlimited} without a fixed daily cap` : ''}.</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs">
            <Shuffle className="size-3.5 text-primary" />
            {active.auto_switch
              ? <>Auto-switch on (below {active.switch_below}% left). Next calls use <b>{next.name}</b>{next.key_hint ? ` ${next.key_hint}` : ''}.</>
              : <>Auto-switch off — <b>{active.name}</b> is used first.</>}
          </p>
        </div>
      </div>
    </Card>
  );
}
