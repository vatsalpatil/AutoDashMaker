import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, TextInput } from '@/components/ui/kit';
import { ago } from '../format';
import { SimpleTable } from '../parts/SimpleTable';
import { downloadCsv } from '../parts/useAdmin';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** What happened (not just which URL was hit): data changes, AI questions, and every admin action. */
export function AuditPage() {
  const [q, setQ] = useState('');
  const state = useApi<Row[]>(`/admin/audit?limit=1000${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit trail" description="Data changes, queries, AI questions and every backoffice action (admin.*)."
        actions={<>
          <TextInput value={q} onChange={setQ} placeholder="Filter action or detail (try admin.)" className="w-64" />
          <Button size="sm" label="Admin actions" onClick={() => setQ('admin.')} />
          <Button size="sm" label="CSV" onClick={() => downloadCsv('dashtor-audit', state.data ?? [])} />
        </>} />
      <AsyncView state={state}>{(rows) => (
        <SimpleTable rows={rows} cols={[
          { label: 'When', cell: (r) => <span title={r.created_at}>{ago(r.created_at)}</span>, className: 'whitespace-nowrap' },
          { label: 'User', cell: (r) => r.action.startsWith('admin.') ? <Badge variant="purple" label="admin" /> : r.owner },
          { label: 'Action', cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
          { label: 'On', cell: (r) => r.entity_type ? <span className="text-xs">{r.entity_type} <span className="font-mono text-muted-foreground">{r.entity_id}</span></span> : '—' },
          { label: 'Detail', cell: (r) => <span className="line-clamp-2 text-xs">{r.detail}</span> },
          { label: 'Status', cell: (r) => <Badge variant={r.status === 'ok' ? 'success' : 'error'} label={r.status} /> },
        ]} />
      )}</AsyncView>
    </div>
  );
}
