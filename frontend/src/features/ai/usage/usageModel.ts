import { useEffect, useState } from 'react';

export interface UsageSum { requests: number; tokens_in: number; tokens_out: number; errors: number; avg_ms: number }
export interface Blocked { until: string; reason: string; seconds: number }
export interface ProviderUsage {
  id: string; provider: string; label: string; model: string; is_default: boolean;
  limits: { rpd: number | null; rpm: number | null; tpd: number | null; source: string; note: string; tz: string; mine: { rpd: number | null; rpm: number | null; tpd: number | null } };
  window: { start: string; resets_at: string; seconds_to_reset: number };
  today: UsageSum; last_minute: number;
  remaining: { requests: number | null; tokens: number | null; pct: number | null; minute: number | null };
  live: { limit_requests: number | null; remaining_requests: number | null; limit_tokens: number | null; remaining_tokens: number | null; reset_requests?: string; reset_tokens?: string; seen?: string };
  blocked: Blocked | null;
  runs_left: { feature: string; calls_per_run: number; runs_left: number }[];
  account: { usage_usd: number | null; limit_usd: number | null; remaining_usd: number | null; free_tier: boolean | null; usage_daily_usd?: number | null } | null;
}
export interface UsageReport {
  days: number; periods: Record<'today' | '7d' | '30d' | 'all', UsageSum>; selected: UsageSum;
  daily: { day: string; requests: number; tokens: number; errors: number }[];
  by_feature: { feature: string; requests: number; tokens: number }[];
  by_model: { provider: string; model: string; requests: number; tokens: number; avg_ms: number }[];
  recent: { created_at: string; provider: string; model: string; feature: string; ok: boolean; status: number | null; tokens_in: number; tokens_out: number; ms: number; error: string | null }[];
  providers: ProviderUsage[]; active: string | null; now: string;
}
export interface UsageSummary { provider: string | null; model?: string; remaining?: ProviderUsage['remaining']; limits?: { rpd: number | null }; today?: number; window?: ProviderUsage['window']; blocked?: Blocked | null }

export const compact = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : Intl.NumberFormat(undefined, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);

/** '3h 05m' / '4m 09s' / '12s' */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
}

/** Seconds left until an ISO time, ticking every second (null when no time). */
export function useCountdown(iso: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  return iso ? Math.max(0, (new Date(iso).getTime() - now) / 1000) : null;
}

export const localTime = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** green / amber / red by how much is left */
export const tone = (pct: number | null) => (pct === null ? 'text-primary' : pct > 40 ? 'text-success' : pct > 15 ? 'text-warning' : 'text-destructive');
