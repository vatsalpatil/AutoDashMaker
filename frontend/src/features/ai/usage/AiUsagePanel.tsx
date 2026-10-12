import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Coins, RefreshCw, Timer } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Card } from '@/components/ui/kit';
import { AsyncView } from '@/components/common/AsyncView';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import { ProviderUsageCard } from './ProviderUsageCard';
import { compact, type UsageReport, type UsageSum } from './usageModel';

const PERIODS = [{ days: 1, label: 'Today' }, { days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }];

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const tokens = (s: UsageSum) => s.tokens_in + s.tokens_out;

/** Settings → AI usage: per-provider limits left (with reset and pause countdowns), then usage over a chosen period. Refreshes every 30 s. */
export default function AiUsagePanel() {
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState<'requests' | 'tokens'>('requests');
  const q = useApi<UsageReport>(`/ai/usage?days=${days}`);
  useEffect(() => { const id = setInterval(q.reload, 30000); return () => clearInterval(id); }, [q.reload]);

  return (
    <AsyncView state={q}>
      {(r) => {
        const s = r.selected;
        const maxFeature = Math.max(1, ...r.by_feature.map((f) => f.requests));
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Every AI call is counted. Limits come from your providers’ replies, their published free tiers, or your own budget.</p>
              <button type="button" onClick={q.reload} className="flex items-center gap-1 text-xs text-primary"><RefreshCw className="size-3.5" />Refresh</button>
            </div>
            {r.providers.length === 0 && <Card padding={4}><p className="text-sm text-muted-foreground">Connect an AI provider in the AI models tab to start tracking.</p></Card>}
            {r.providers.map((p) => <ProviderUsageCard key={p.id} p={p} onChanged={q.reload} />)}

            <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1 w-fit" role="tablist" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p.days} type="button" role="tab" aria-selected={days === p.days} onClick={() => setDays(p.days)}
                  className={cn('rounded-md px-3 py-1 text-sm', days === p.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{p.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile icon={<Activity className="size-3.5" />} label="Requests" value={compact(s.requests)} sub={`today ${r.periods.today.requests} · all time ${compact(r.periods.all.requests)}`} />
              <Tile icon={<Coins className="size-3.5" />} label="Tokens" value={compact(tokens(s))} sub={`${compact(s.tokens_in)} in · ${compact(s.tokens_out)} out`} />
              <Tile icon={<AlertTriangle className="size-3.5" />} label="Failed" value={compact(s.errors)} sub={s.requests ? `${Math.round((100 * s.errors) / s.requests)}% of calls` : undefined} />
              <Tile icon={<Timer className="size-3.5" />} label="Avg response" value={`${(s.avg_ms / 1000).toFixed(1)} s`} />
            </div>

            <Card padding={4}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Usage per day</p>
                <div className="flex gap-2 text-xs">
                  {(['requests', 'tokens'] as const).map((m) => <button key={m} type="button" onClick={() => setMetric(m)} className={cn(metric === m ? 'font-semibold text-primary' : 'text-muted-foreground')}>{m}</button>)}
                </div>
              </div>
              {r.daily.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No AI calls in this period.</p> : (
                <ChartContainer config={{ [metric]: { label: metric, color: 'var(--primary)' }, errors: { label: 'failed', color: 'var(--destructive)' } }} className="aspect-auto h-48 w-full">
                  <BarChart data={r.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} tickFormatter={(v: number) => compact(v)} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey={metric} stackId="a" fill={`var(--color-${metric})`} radius={metric === 'tokens' ? 3 : 0} />
                    {metric === 'requests' && <Bar dataKey="errors" stackId="a" fill="var(--color-errors)" radius={[3, 3, 0, 0]} />}
                  </BarChart>
                </ChartContainer>
              )}
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card padding={4}>
                <p className="mb-2 text-sm font-semibold">By feature</p>
                <ul className="flex flex-col gap-2">
                  {r.by_feature.map((f) => (
                    <li key={f.feature} className="text-xs">
                      <div className="flex justify-between"><span>{f.feature}</span><span className="tabular-nums text-muted-foreground">{f.requests} req · {compact(f.tokens)} tok</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(100 * f.requests) / maxFeature}%` }} /></div>
                    </li>
                  ))}
                  {r.by_feature.length === 0 && <li className="text-xs text-muted-foreground">Nothing yet.</li>}
                </ul>
              </Card>
              <Card padding={4}>
                <p className="mb-2 text-sm font-semibold">By model</p>
                <ul className="flex flex-col gap-1.5 text-xs">
                  {r.by_model.map((m) => (
                    <li key={m.provider + m.model} className="flex justify-between gap-2"><span className="truncate font-mono">{m.model}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{m.requests} req · {compact(m.tokens)} tok · {(m.avg_ms / 1000).toFixed(1)} s</span></li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card padding={4}>
              <p className="mb-2 text-sm font-semibold">Latest calls</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">When</th><th className="pr-3 font-medium">Feature</th><th className="pr-3 font-medium">Model</th><th className="pr-3 text-right font-medium">Tokens</th><th className="pr-3 text-right font-medium">Time</th><th className="font-medium">Result</th></tr></thead>
                  <tbody>
                    {r.recent.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 pr-3 whitespace-nowrap">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="pr-3">{c.feature}</td>
                        <td className="max-w-40 truncate pr-3 font-mono">{c.model}</td>
                        <td className="pr-3 text-right tabular-nums">{compact(c.tokens_in + c.tokens_out)}</td>
                        <td className="pr-3 text-right tabular-nums">{(c.ms / 1000).toFixed(1)} s</td>
                        <td className={cn('max-w-56 truncate', c.ok ? 'text-success' : c.status === 429 ? 'text-warning' : 'text-destructive')} title={c.error ?? ''}>
                          {c.ok ? 'ok' : c.status === 429 ? 'limit reached' : c.error ?? 'failed'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }}
    </AsyncView>
  );
}
