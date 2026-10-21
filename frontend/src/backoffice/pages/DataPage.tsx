import { useState } from 'react';
import { RefreshCw, Trash2, Ban, Download } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Badge, Button, Tab, TabList, TextInput } from '@/components/ui/kit';
import { ago, bytes, num } from '../format';
import { SimpleTable, type Col } from '../parts/SimpleTable';
import { downloadCsv, useAdminAction, useSearch } from '../parts/useAdmin';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Kind = 'datasets' | 'dashboards' | 'sources' | 'shares' | 'storage';

const COLS: Record<Exclude<Kind, 'storage'>, Col<Row>[]> = {
  datasets: [
    { label: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
    { label: 'Kind', cell: (r) => <>{r.kind}{r.live && <Badge variant="info" label="live" className="ml-1" />}</> },
    { label: 'Rows', cell: (r) => num(r.row_count), className: 'text-right tabular-nums' },
    { label: 'Cols', cell: (r) => num(r.column_count), className: 'text-right tabular-nums' },
    { label: 'Refreshed', cell: (r) => ago(r.refreshed_at ?? r.created_at) },
    { label: 'Health', cell: (r) => r.last_refresh_error ? <Badge variant="error" label="refresh failing" /> : r.auto_refresh ? <Badge variant="success" label="auto" /> : '—' },
  ],
  dashboards: [
    { label: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
    { label: 'Widgets', cell: (r) => num(r.widgets), className: 'text-right tabular-nums' },
    { label: 'Created', cell: (r) => ago(r.created_at) },
    { label: 'Updated', cell: (r) => ago(r.updated_at) },
  ],
  sources: [
    { label: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
    { label: 'Type', cell: (r) => r.type },
    { label: 'Status', cell: (r) => r.status },
    { label: 'Created', cell: (r) => ago(r.created_at) },
  ],
  shares: [
    { label: 'Dashboard', cell: (r) => <span className="font-mono text-xs">{r.dashboard_id}</span> },
    { label: 'State', cell: (r) => r.revoked ? <Badge variant="neutral" label="revoked" /> : <Badge variant="success" label="active" /> },
    { label: 'Views', cell: (r) => num(r.views), className: 'text-right tabular-nums' },
    { label: 'Last view', cell: (r) => ago(r.last_viewed_at) },
    { label: 'Expires', cell: (r) => r.expires_at ? new Date(r.expires_at).toLocaleDateString() : 'never' },
  ],
};

export function DataPage() {
  const [kind, setKind] = useState<Kind>('datasets');
  const [q, setQ] = useState('');
  const state = useApi<Row[]>(`/admin/data/${kind}`);
  const act = useAdminAction(state.reload);
  const rows = useSearch(state.data, q, ['name', 'owner', 'type', 'kind', 'dashboard_id', 'id']);

  const actions: Col<Row> = {
    label: '', className: 'text-right whitespace-nowrap', cell: (r) => (
      <div className="flex justify-end gap-1">
        {kind === 'datasets' && <Button size="sm" variant="ghost" isDisabled={act.busy} icon={<RefreshCw className="size-4" />} title="Refresh now"
          onClick={() => act.run('post', `/admin/data/datasets/${r.id}/refresh`)} />}
        {kind === 'shares' ? !r.revoked && <Button size="sm" variant="ghost" isDisabled={act.busy} icon={<Ban className="size-4" />} title="Revoke link"
          onClick={() => act.run('post', `/admin/data/shares/${r.id}/revoke`, undefined, 'Revoke this public link? Anyone using it loses access.')} />
          : <Button size="sm" variant="ghost" isDisabled={act.busy} icon={<Trash2 className="size-4 text-destructive" />} title="Delete"
            onClick={() => act.run('del', `/admin/data/${kind}/${r.id}`, undefined, `Permanently delete "${r.name}" owned by ${r.owner}?`)} />}
      </div>
    ),
  };
  const owner: Col<Row> = { label: 'Owner', cell: (r) => <span className="text-muted-foreground">{r.owner}</span> };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Data" description="Every workspace's data. Actions run inside the owner's workspace, exactly as if they did it."
        actions={<>
          <TextInput value={q} onChange={setQ} placeholder="Search name, owner…" className="w-60" />
          <Button size="sm" icon={<Download className="size-4" />} label="CSV" onClick={() => downloadCsv(`dashtor-${kind}`, rows)} />
          <Button size="sm" icon={<RefreshCw className="size-4" />} label="Reload" onClick={state.reload} />
        </>} />
      <div className="max-w-full overflow-x-auto">
      <TabList value={kind} onChange={(v) => { setKind(v as Kind); setQ(''); }}>
        {['datasets', 'dashboards', 'sources', 'shares', 'storage'].map((k) => <Tab key={k} value={k} label={k[0].toUpperCase() + k.slice(1)} />)}
      </TabList>
      </div>
      {act.error && <ErrorBanner message={act.error} />}
      <AsyncView state={state.loading ? { ...state, data: null } : state}>{() => kind === 'storage' ? (
        <SimpleTable rows={rows} cols={[
          { label: 'Owner', cell: (r) => r.owner }, { label: 'Workspace', cell: (r) => <span className="font-mono text-xs">{r.workspace_id}</span> },
          { label: 'Disk used', cell: (r) => bytes(r.bytes), className: 'text-right tabular-nums' },
        ]} />
      ) : (
        <SimpleTable rows={rows} cols={[...COLS[kind], owner, actions]} empty={`No ${kind}.`} />
      )}</AsyncView>
    </div>
  );
}
