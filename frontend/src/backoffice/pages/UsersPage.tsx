import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, TextInput } from '@/components/ui/kit';
import { ago, num } from '../format';
import type { AdminUser } from '../types';
import { SimpleTable } from '../parts/SimpleTable';
import { downloadCsv } from '../parts/useAdmin';
import { Button } from '@/components/ui/kit';

export function UsersPage() {
  const state = useApi<AdminUser[]>('/admin/users');
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const rows = useMemo(() => (state.data ?? [])
    .filter((u) => !q || `${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? '')), [state.data, q]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Users" description={state.data ? `${state.data.length} accounts` : undefined}
        actions={<>
          <TextInput value={q} onChange={setQ} placeholder="Search email or id…" className="w-64" />
          <Button size="sm" label="CSV" onClick={() => downloadCsv('dashtor-users', rows as unknown as Record<string, unknown>[])} />
        </>} />
      <AsyncView state={state}>{() => (
        <SimpleTable rows={rows} onRow={(u) => nav(`/users/${u.id}`)} cols={[
          { label: 'Email', cell: (u) => <span className="font-medium">{u.email}</span> },
          { label: 'Status', cell: (u) => u.suspended ? <Badge variant="error" label="Suspended" />
            : u.email_confirmed ? <Badge variant="success" label="Active" /> : <Badge variant="warning" label="Unconfirmed" /> },
          { label: 'Flags', cell: (u) => <span className="flex gap-1">{u.ai_blocked && <Badge variant="warning" label="no AI" />}{(u.quota_mb || u.max_datasets) && <Badge variant="info" label="custom limits" />}</span> },
          { label: 'Sign-in', cell: (u) => u.provider ?? '—' },
          { label: 'Joined', cell: (u) => ago(u.created_at), className: 'whitespace-nowrap' },
          { label: 'Last active', cell: (u) => ago(u.last_active_at), className: 'whitespace-nowrap' },
          { label: 'Datasets', cell: (u) => num(u.datasets), className: 'text-right tabular-nums' },
          { label: 'Dashboards', cell: (u) => num(u.dashboards), className: 'text-right tabular-nums' },
          { label: 'AI (30d)', cell: (u) => num(u.ai_calls_30d), className: 'text-right tabular-nums' },
        ]} />
      )}</AsyncView>
    </div>
  );
}
