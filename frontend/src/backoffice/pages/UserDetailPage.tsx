import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Trash2, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Badge, Button, Card } from '@/components/ui/kit';
import { ago, bytes, num } from '../format';
import type { ActivityRow, AdminUserDetail } from '../types';
import { StatGrid, StatTile } from '../parts/StatTile';
import { SimpleTable } from '../parts/SimpleTable';
import { ActivityTable } from '../parts/ActivityTable';
import { UserControls } from '../parts/UserControls';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const user = useApi<AdminUserDetail>(`/admin/users/${id}`);
  const activity = useApi<ActivityRow[]>(`/admin/activity?user_id=${encodeURIComponent(id)}&limit=100`);
  const [setSuspended, s] = useAsyncAction(async (suspended: boolean, reason: string) => {
    await api.post(`/admin/users/${id}/suspend`, { suspended, reason });
    user.reload();
  });
  const [remove, r] = useAsyncAction(async () => { await api.del(`/admin/users/${id}`); nav('/users'); });
  const busy = s.busy || r.busy;

  const toggle = (d: AdminUserDetail) => {
    const reason = d.suspended ? '' : prompt('Reason for suspending (kept in the audit log):');
    if (reason !== null) void setSuspended(!d.suspended, reason);
  };
  const confirmDelete = (d: AdminUserDetail) => {
    if (prompt(`Type the email to permanently delete this account and ALL its data:\n${d.email}`) === d.email) void remove();
  };

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="self-start" icon={<ArrowLeft className="size-4" />} label="All users" onClick={() => nav('/users')} />
      <AsyncView state={user}>{(d) => (
        <>
          <PageHeader title={d.email ?? d.id} description={<span className="font-mono text-xs">{d.id} · {d.workspace_id}</span>}
            actions={<>
              {d.suspended && <Badge variant="error" label="Suspended" />}
              <Button size="sm" isDisabled={busy} icon={d.suspended ? <UserCheck className="size-4" /> : <Ban className="size-4" />}
                label={d.suspended ? 'Unsuspend' : 'Suspend'} onClick={() => toggle(d)} />
              <Button size="sm" variant="danger" isDisabled={busy} icon={<Trash2 className="size-4" />} label="Delete" onClick={() => confirmDelete(d)} />
            </>} />
          {(s.error || r.error) && <ErrorBanner message={(s.error || r.error)!} />}
          {d.suspended && d.suspend_reason && <ErrorBanner message={`Suspended: ${d.suspend_reason}`} />}
          <UserControls key={`${d.quota_mb}-${d.max_datasets}-${d.ai_blocked}`} user={d} onSaved={user.reload} />
          <StatGrid>
            <StatTile label="Joined" value={ago(d.created_at)} hint={d.provider ?? undefined} />
            <StatTile label="Last sign-in" value={ago(d.last_sign_in_at)} />
            <StatTile label="Last active" value={ago(d.last_active_at)} />
            <StatTile label="Storage" value={bytes(d.storage_bytes)} />
            <StatTile label="Datasets / dashboards" value={`${d.datasets} / ${d.dashboards}`} hint={`${d.datasources} sources · ${d.charts} charts`} />
            <StatTile label="AI calls (30d)" value={num(d.ai_calls_30d)} />
          </StatGrid>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card><div className="mb-2 text-sm font-medium">Datasets</div>
              <SimpleTable rows={d.datasets_list} cols={[
                { label: 'Name', cell: (x) => x.name },
                { label: 'Rows', cell: (x) => num(x.row_count), className: 'text-right tabular-nums' },
                { label: 'Refreshed', cell: (x) => ago(x.refreshed_at ?? x.created_at) },
              ]} /></Card>
            <Card><div className="mb-2 text-sm font-medium">Dashboards</div>
              <SimpleTable rows={d.dashboards_list} cols={[
                { label: 'Name', cell: (x) => x.name }, { label: 'Updated', cell: (x) => ago(x.updated_at) },
              ]} /></Card>
          </div>
          <Card><div className="mb-2 text-sm font-medium">AI usage by model</div>
            <SimpleTable rows={d.ai_by_model} cols={[
              { label: 'Model', cell: (x) => `${x.provider} · ${x.model}` },
              { label: 'Calls', cell: (x) => num(x.calls), className: 'text-right tabular-nums' },
              { label: 'Tokens in/out', cell: (x) => `${num(x.tokens_in)} / ${num(x.tokens_out)}`, className: 'text-right tabular-nums' },
              { label: 'Errors', cell: (x) => num(x.errors), className: 'text-right tabular-nums' },
            ]} /></Card>
        </>
      )}</AsyncView>
      <Card><div className="mb-2 text-sm font-medium">Recent activity</div>
        <AsyncView state={activity}>{(rows) => <ActivityTable rows={rows} showUser={false} />}</AsyncView></Card>
    </div>
  );
}
