import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PauseCircle, Sparkles } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import { compact, duration, tone, useCountdown, type UsageSummary } from './usageModel';

/** Top-bar AI budget: requests left today for the active provider, or a live "paused · back in 2h 13m" when its limit is hit. */
export function AiUsagePill() {
  const navigate = useNavigate();
  const [, setTab] = useLocalStorage('settings.tab', 'ai');
  const q = useApi<UsageSummary>('/ai/usage/summary');
  useEffect(() => {
    const id = setInterval(q.reload, 60000);
    const onFocus = () => q.reload();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [q.reload]);
  const s = q.data;
  const pausedFor = useCountdown(s?.blocked?.until);
  const resetIn = useCountdown(s?.window?.resets_at);
  if (!s?.provider) return null;
  const paused = (pausedFor ?? 0) > 0;
  const left = s.remaining?.requests ?? null;
  const pct = s.remaining?.pct ?? null;
  const open = () => { setTab('usage'); navigate('/settings'); };
  const title = paused ? `${s.provider} hit its limit. Works again in ${duration(pausedFor!)}.`
    : `${s.provider} · ${s.today} requests today${left !== null ? `, ${left} left` : ''} · resets in ${duration(resetIn ?? 0)}`;

  return (
    <button type="button" onClick={open} title={title}
      className={cn('flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors hover:bg-accent', paused && 'border-warning/50 bg-warning/10')}>
      {paused ? <PauseCircle className="size-3.5 text-warning" /> : <Sparkles className={cn('size-3.5', tone(pct))} />}
      {paused ? <span className="tabular-nums">AI back in {duration(pausedFor!)}</span>
        : left !== null ? <span className="tabular-nums"><b className={tone(pct)}>{compact(left)}</b><span className="text-muted-foreground">/{compact(s.limits?.rpd ?? null)} left</span></span>
          : <span className="tabular-nums text-muted-foreground">{s.today} today</span>}
    </button>
  );
}
