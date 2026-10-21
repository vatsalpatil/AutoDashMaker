import { useState } from 'react';
import { Unlock } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Badge, Button, Tab, TabList } from '@/components/ui/kit';
import { ago, num } from '../format';
import { StatGrid, StatTile } from '../parts/StatTile';
import { TrendChart } from '../parts/TrendChart';
import { SimpleTable } from '../parts/SimpleTable';
import { Section } from '../parts/Section';
import { AiSwitch } from '../parts/AiSwitch';
import { useAdminAction } from '../parts/useAdmin';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface AiOverview {
  days: number; totals: Row; daily: { day: string; calls: number; errors: number; tokens: number }[];
  by_model: Row[]; by_feature: Row[]; by_user: Row[]; recent_errors: Row[]; providers: Row[];
}

const right = 'text-right tabular-nums';

export function AiPage() {
  const [days, setDays] = useState('30');
  const state = useApi<AiOverview>(`/admin/ai?days=${days}`);
  const act = useAdminAction(state.reload);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="AI" description="Every AI call on the platform: who, which model, what it cost, what failed."
        actions={<TabList value={days} onChange={setDays}>{['1', '7', '30', '90'].map((d) => <Tab key={d} value={d} label={`${d}d`} />)}</TabList>} />
      <AiSwitch />
      {act.error && <ErrorBanner message={act.error} />}
      <AsyncView state={state}>{(a) => (
        <>
          <StatGrid>
            <StatTile label="Calls" value={num(a.totals.calls)} />
            <StatTile label="Tokens in" value={num(a.totals.tokens_in)} />
            <StatTile label="Tokens out" value={num(a.totals.tokens_out)} />
            <StatTile label="Failed" value={num(a.totals.errors)} tone={a.totals.errors ? 'bad' : undefined}
              hint={a.totals.calls ? `${Math.round((a.totals.errors / a.totals.calls) * 100)}% of calls` : undefined} />
            <StatTile label="Avg latency" value={`${num(a.totals.avg_ms)} ms`} />
            <StatTile label="Keys connected" value={num(a.providers.length)} />
          </StatGrid>
          <TrendChart title="Calls & failures per day" data={a.daily} series={[{ key: 'calls', label: 'Calls' }, { key: 'errors', label: 'Failed' }]} />
          <div className="grid gap-3 xl:grid-cols-2">
            <Section title="By user">
              <SimpleTable rows={a.by_user} cols={[
                { label: 'User', cell: (r) => r.owner }, { label: 'Calls', cell: (r) => num(r.calls), className: right },
                { label: 'Tokens', cell: (r) => num(r.tokens_in + r.tokens_out), className: right },
                { label: 'Failed', cell: (r) => num(r.errors), className: right }, { label: 'Last', cell: (r) => ago(r.last_call) },
              ]} />
            </Section>
            <Section title="By model">
              <SimpleTable rows={a.by_model} cols={[
                { label: 'Model', cell: (r) => `${r.provider} · ${r.model}` }, { label: 'Calls', cell: (r) => num(r.calls), className: right },
                { label: 'Tokens', cell: (r) => num(r.tokens), className: right }, { label: 'Failed', cell: (r) => num(r.errors), className: right },
                { label: 'Avg', cell: (r) => `${num(r.avg_ms)} ms`, className: right },
              ]} />
            </Section>
            <Section title="By feature">
              <SimpleTable rows={a.by_feature} cols={[
                { label: 'Feature', cell: (r) => r.feature }, { label: 'Calls', cell: (r) => num(r.calls), className: right },
                { label: 'Tokens', cell: (r) => num(r.tokens), className: right },
              ]} />
            </Section>
            <Section title="Connected keys" description="Per user. Keys themselves are never shown.">
              <SimpleTable rows={a.providers} cols={[
                { label: 'User', cell: (r) => r.owner }, { label: 'Key', cell: (r) => <>{r.label || r.provider} <span className="text-muted-foreground">· {r.model}</span></> },
                { label: 'State', cell: (r) => r.blocked_until && new Date(r.blocked_until) > new Date()
                  ? <Badge variant="warning" label={`paused: ${r.block_reason ?? 'limit'}`} /> : r.is_default ? <Badge variant="success" label="active" /> : '—' },
                { label: '', className: 'text-right', cell: (r) => r.blocked_until && <Button size="sm" variant="ghost" icon={<Unlock className="size-4" />} title="Clear pause"
                  isDisabled={act.busy} onClick={() => act.run('post', `/admin/ai/providers/${r.id}/unblock`)} /> },
              ]} />
            </Section>
          </div>
          <Section title="Recent failures">
            <SimpleTable rows={a.recent_errors} empty="No failed AI calls." cols={[
              { label: 'When', cell: (r) => ago(r.created_at), className: 'whitespace-nowrap' }, { label: 'Model', cell: (r) => `${r.provider} · ${r.model}` },
              { label: 'Feature', cell: (r) => r.feature }, { label: 'Status', cell: (r) => r.status ?? '—' },
              { label: 'Error', cell: (r) => <span className="line-clamp-2 text-xs">{r.error}</span> },
            ]} />
          </Section>
        </>
      )}</AsyncView>
    </div>
  );
}
