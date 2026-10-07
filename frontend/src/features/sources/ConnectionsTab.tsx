import { useState } from 'react';
import { DatabaseZap, Pencil, Plug, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/common/IconButton';
import { ResourceList, type ListColumn } from '@/components/common/ResourceList';
import { SourceHealth } from '@/components/SourceHealth';
import { Badge, Button, Card } from '@/components/ui/kit';
import type { ListViewMode } from '@/hooks/useListView';
import { api } from '@/lib/api';
import type { Source } from '@/lib/types';
import { cn } from '@/lib/utils';
import { typeBadge, typeLabel } from './sourceSchemas';

type TestResult = { ok: boolean; detail: string };

/** Saved connections: live health, edit / test / delete. Test results are kept per source until reload. */
export function ConnectionsTab({ sources, view, onEdit, onImport, onRemove }: {
  sources: Source[];
  view: ListViewMode;
  onEdit: (s: Source) => void;
  onImport: (s: Source) => void;
  onRemove: (id: string) => void;
}) {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function test(s: Source) {
    setBusy((m) => ({ ...m, [s.id]: true }));
    let result: TestResult;
    try {
      const r = await api.post<{ ok?: boolean; detail?: string }>(`/sources/${s.id}/test-saved`);
      result = { ok: r.ok !== false, detail: r.detail ?? (r.ok === false ? 'Connection failed' : 'Connection OK') };
    } catch (e) {
      result = { ok: false, detail: (e as Error).message };
    }
    setResults((m) => ({ ...m, [s.id]: result }));
    setBusy((m) => ({ ...m, [s.id]: false }));
  }

  const testButton = (s: Source) => (
    <Button variant="secondary" label={busy[s.id] ? 'Testing…' : 'Test'} icon={<Plug className="h-3.5 w-3.5" />} onClick={() => test(s)} isDisabled={busy[s.id]} />
  );
  // files are imported by dropping them on the upload box; every other connection can list and import its tables
  const importButton = (s: Source) => s.type === 'file' ? null : (
    <Button variant="primary" label="Import tables" icon={<DatabaseZap className="h-3.5 w-3.5" />} onClick={() => onImport(s)} />
  );
  const editButton = (s: Source) => <Button variant="secondary" label="Edit" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(s)} />;

  const columns: ListColumn<Source>[] = [
    { header: 'Source Name', className: 'font-semibold', cell: (s) => s.name },
    { header: 'Type', cell: (s) => <Badge variant={typeBadge(s.type)} label={typeLabel(s.type)} /> },
    { header: 'Status', cell: (s) => s.status && <Badge label={s.status} /> },
    {
      header: 'Last Test Result', className: 'text-xs',
      cell: (s) => results[s.id]
        ? <span className={cn('font-semibold', results[s.id].ok ? 'text-success' : 'text-destructive')}>{results[s.id].ok ? '✓ ' : '✕ '}{results[s.id].detail}</span>
        : <span className="text-muted-foreground/70">Untested</span>,
    },
    {
      header: 'Actions', align: 'right',
      cell: (s) => (
        <div className="flex items-center justify-end gap-2">
          {importButton(s)}
          {editButton(s)}
          {testButton(s)}
          <IconButton title="Delete source" danger onClick={() => onRemove(s.id)}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <SourceHealth />
      <ResourceList
        items={sources}
        view={view}
        columns={columns}
        empty={{ title: 'No connected sources found', description: "Click 'Add connection' to connect PostgreSQL, MySQL, SQLite, or REST APIs." }}
        renderCard={(s) => (
          <Card padding={3}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="mt-2 flex gap-2">
                  <Badge variant={typeBadge(s.type)} label={typeLabel(s.type)} />
                  {s.status && <Badge label={s.status} />}
                </div>
              </div>
              <IconButton title="Delete source" danger onClick={() => onRemove(s.id)}><Trash2 className="h-4 w-4" /></IconButton>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">{importButton(s)}{editButton(s)}{testButton(s)}</div>
            {results[s.id] && (
              <p className={cn('mt-2 rounded-md p-2 text-xs', results[s.id].ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                {results[s.id].ok ? '✓ ' : '✕ '}{results[s.id].detail}
              </p>
            )}
          </Card>
        )}
      />
    </>
  );
}
