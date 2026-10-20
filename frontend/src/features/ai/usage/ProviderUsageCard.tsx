import { useState } from 'react';
import { Clock, Gauge, PauseCircle, Pencil, Zap } from 'lucide-react';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { compact, duration, localTime, tone, useCountdown, type ProviderUsage } from './usageModel';

/** A ring that fills with what is LEFT of a limit. */
export function Ring({ pct, label, sub, size = 96 }: { pct: number | null; label: string; sub: string; size?: number }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className={cn('-rotate-90', tone(pct))}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={9} />
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth={9} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - (pct ?? 100) / 100)} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold tabular-nums leading-none">{label}</span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}

function Bar({ used, total, label }: { used: number; total: number | null; label: string }) {
  const pct = total ? Math.min(100, (100 * used) / total) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{compact(used)}{total ? ` / ${compact(total)}` : ''}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full bg-current', tone(total ? 100 - pct : null))} style={{ width: `${total ? pct : 0}%` }} /></div>
    </div>
  );
}

/** One provider: what is left today, the per-minute window, reset countdown, pause banner, how many more runs, your own limits. */
export function ProviderUsageCard({ p, onChanged }: { p: ProviderUsage; onChanged: () => void }) {
  const resetIn = useCountdown(p.window.resets_at);
  const pausedFor = useCountdown(p.blocked?.until);
  const [editing, setEditing] = useState(false);
  const [rpd, setRpd] = useState(String(p.limits.mine.rpd ?? ''));
  const [tpd, setTpd] = useState(String(p.limits.mine.tpd ?? ''));
  const left = p.remaining.requests;
  const blocked = p.blocked && (pausedFor ?? 0) > 0;

  async function save() {
    await api.patch(`/ai/providers/${p.id}/limits`, { limit_rpd: Number(rpd) || null, limit_tpd: Number(tpd) || null });
    setEditing(false);
    onChanged();
  }

  return (
    <Card padding={4}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{p.name}</span>
          {p.key_hint && <span className="font-mono text-[11px] text-muted-foreground">{p.key_hint}</span>}
          {p.is_default && <Badge variant="success" label="active" />}
          <span className="truncate font-mono text-xs text-muted-foreground">{p.model}</span>
          <span className="ml-auto text-[11px] text-muted-foreground" title={p.limits.note}>limits: {p.limits.source}</span>
        </div>

        {blocked && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <PauseCircle className="size-5 text-warning" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Limit reached — paused, not broken</p>
              <p className="text-muted-foreground">Works again in <b className="tabular-nums text-foreground">{duration(pausedFor ?? 0)}</b> ({localTime(p.blocked!.until)}). Until then your other keys/providers take over automatically.</p>
            </div>
            <Button variant="secondary" size="sm" label="Try now" onClick={() => api.post(`/ai/providers/${p.id}/unblock`).then(onChanged)} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-5">
          <Ring pct={blocked ? 0 : p.remaining.pct} label={left === null ? '∞' : `${p.exact ? '' : '≈'}${compact(blocked ? 0 : left)}`} sub={left === null ? 'no fixed cap' : p.exact ? 'requests left' : 'left (estimate)'} />
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2.5">
            <Bar label="Requests today (counted against the limit)" used={p.today.requests} total={p.limits.rpd} />
            {p.limits.rpm && <Bar label="This minute" used={p.last_minute} total={p.limits.rpm} />}
            <Bar label="Tokens today" used={p.today.tokens_in + p.today.tokens_out} total={p.limits.tpd} />
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="size-3.5" />Resets in <b className="tabular-nums text-foreground">{duration(resetIn ?? 0)}</b></span>
              {p.today.errors > 0 && <span title="Failed calls rejected by the limit or the network do not use quota">{p.today.errors} failed today</span>}
              {p.today.avg_ms > 0 && <span className="flex items-center gap-1"><Zap className="size-3.5" />{(p.today.avg_ms / 1000).toFixed(1)} s avg</span>}
            </p>
          </div>
        </div>

        {p.runs_left.length > 0 && !blocked && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Gauge className="size-3.5 text-primary" /><span className="text-muted-foreground">With what is left:</span>
            {p.runs_left.map((r) => <span key={r.feature} className="rounded-full border bg-muted/40 px-2 py-0.5" title={`about ${r.calls_per_run} model calls each`}>≈ {r.runs_left} × {r.feature}</span>)}
          </div>
        )}
        {(p.live.remaining_requests !== null || p.live.remaining_tokens !== null) && (
          <p className="text-[11px] text-muted-foreground">Provider reports: {p.live.remaining_requests !== null && `${compact(p.live.remaining_requests)} / ${compact(p.live.limit_requests)} requests`}
            {p.live.remaining_tokens !== null && ` · ${compact(p.live.remaining_tokens)} / ${compact(p.live.limit_tokens)} tokens (per minute)`}</p>
        )}
        {p.account && (
          <p className="text-[11px] text-muted-foreground">OpenRouter account: ${(p.account.usage_usd ?? 0).toFixed(2)} used
            {p.account.limit_usd !== null ? ` of $${p.account.limit_usd}` : ''}{p.account.free_tier ? ' · free tier (50 free requests/day)' : ' · credits bought (1,000 free requests/day)'}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{p.limits.note}</p>
        {!p.exact && left !== null && (
          <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
            “Left” counts only calls made through Dashtor{p.tracked_since ? ` since ${new Date(p.tracked_since).toLocaleString()}` : ' (none yet)'}. Calls with the same key elsewhere
            (or before tracking started) are not visible to us, so the real number can be lower. The provider’s own dashboard is the source of truth;
            when it rejects a call, Dashtor learns the real reset time and shows it here.
          </p>
        )}

        {editing ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-36"><TextInput label="My requests / day" value={rpd} onChange={setRpd} placeholder="auto" /></div>
            <div className="w-36"><TextInput label="My tokens / day" value={tpd} onChange={setTpd} placeholder="auto" /></div>
            <Button variant="primary" size="sm" label="Save" onClick={save} />
            <Button variant="ghost" size="sm" label="Cancel" onClick={() => setEditing(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="flex w-fit items-center gap-1 text-xs text-primary hover:underline">
            <Pencil className="size-3" /> Set my own limit (budget)
          </button>
        )}
      </div>
    </Card>
  );
}
