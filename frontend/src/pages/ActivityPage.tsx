import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DataGrid } from '@/components/common/DataGrid';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { UnderlineTabs } from '@/components/common/ListControls';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, EmptyState } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import type { AuditItem } from '@/lib/types';

const CATEGORIES = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'ask', label: 'Questions', test: (a: AuditItem) => a.action.startsWith('ai.') },
  { id: 'query', label: 'Queries', test: (a: AuditItem) => a.action.startsWith('query.') },
  { id: 'data', label: 'Data & sources', test: (a: AuditItem) => /^(dataset|source)\./.test(a.action) },
  { id: 'problems', label: 'Blocked / errors', test: (a: AuditItem) => a.status !== 'ok' },
] as const;
const COLUMNS = ['when', 'action', 'status', 'ms', 'detail'];

/** Who ran what, when — the audit trail (§58). Sort, search, filter and export come from the shared DataGrid. */
export default function ActivityPage() {
  const { data, error, reload } = useApi<{ items: AuditItem[] }>('/audit?limit=500');
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]['id']>('all');
  const items = data?.items;

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, (items ?? []).filter(c.test).length])), [items]);
  const rows = useMemo(() => {
    const test = CATEGORIES.find((c) => c.id === cat)!.test;
    return (items ?? []).filter(test).map((a) => ({
      when: a.created_at ? a.created_at.replace('T', ' ').slice(0, 19) : '',
      action: a.action, status: a.status, ms: a.duration_ms != null ? Math.round(a.duration_ms) : null, detail: a.detail ?? '',
    }));
  }, [items, cat]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Activity" description="Every query, AI question, data import and source change — including SQL that was blocked."
        actions={<Button variant="secondary" label="Refresh" icon={<RefreshCw className="size-4" />} onClick={reload} />} />
      <ErrorBanner message={error} />
      <div className="overflow-x-auto"><UnderlineTabs tabs={CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: counts[c.id] }))} value={cat} onChange={setCat} /></div>
      {!items ? <Loading /> : rows.length === 0
        ? <EmptyState title="Nothing here yet" description="Run a query or ask a question and it will appear here." />
        : <DataGrid columns={COLUMNS} rows={rows} maxHeight="68vh" />}
    </div>
  );
}
