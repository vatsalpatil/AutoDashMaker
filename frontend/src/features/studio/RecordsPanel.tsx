import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Database, Loader2, Sparkles } from 'lucide-react';
import { DataGrid } from '@/components/common/DataGrid';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { detectRecords, getPath, listRecordSets, toTable } from '@/lib/jsonTools';
import type { Dataset } from '@/lib/types';

/**
 * The "smart" part of the studio: finds the table-like array in any JSON, previews it as a flattened table, and turns
 * it into a dataset (a snapshot) or, when `onSaveSource` is given, a refreshable data source.
 */
export function RecordsPanel({ value, defaultName, onSaveSource }: {
  value: unknown;
  defaultName: string;
  /** Save the request as a refreshable source using this record path ('' = auto-detect). */
  onSaveSource?: (name: string, recordPath: string) => Promise<void>;
}) {
  const sets = useMemo(() => listRecordSets(value), [value]);
  const auto = useMemo(() => detectRecords(value), [value]);
  const [chosen, setChosen] = useState<string | null>(null);
  const pathKey = chosen ?? (auto ? auto.path.join('.') : '');
  const records = useMemo(() => {
    const node = pathKey === '' ? value : getPath(value, pathKey.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)));
    return Array.isArray(node) ? node.filter((r) => typeof r === 'object' && r !== null) : [];
  }, [value, pathKey]);
  const table = useMemo(() => toTable(records, 2000), [records]);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState<'dataset' | 'source' | null>(null);
  const [done, setDone] = useState<{ dataset?: Dataset; source?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (sets.length === 0) return <p className="p-4 text-sm text-muted-foreground">No list of records found in this response — pick another view, or query the JSON for the part you need.</p>;

  async function makeDataset() {
    setBusy('dataset'); setError(null);
    try {
      setDone({ dataset: await api.post<Dataset>('/studio/records-to-dataset', { name: name || defaultName, records: records.slice(0, 50000) }) });
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function makeSource() {
    if (!onSaveSource) return;
    setBusy('source'); setError(null);
    try { await onSaveSource(name || defaultName, pathKey); setDone({ source: name || defaultName }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b p-3">
        <p className="flex items-center gap-1.5 text-sm"><Sparkles className="size-4 text-primary" />
          Found <b>{records.length.toLocaleString()}</b> records × <b>{table.columns.length}</b> columns
          {pathKey && <> at <code className="mono rounded bg-muted px-1">{pathKey}</code></>}
        </p>
        {sets.length > 1 && (
          <div className="w-56">
            <SelectField aria-label="Records location" value={pathKey || '$root'} onChange={(e) => setChosen(e.target.value === '$root' ? '' : e.target.value)}>
              {sets.map((s) => <option key={s.path.join('.') || '$root'} value={s.path.join('.') || '$root'}>{(s.path.join('.') || '(root)')} · {s.count}</option>)}
            </SelectField>
          </div>
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Dataset name" placeholder="Dataset name"
          className="h-8 w-44 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        <Button variant="primary" size="sm" icon={busy === 'dataset' ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
          label="Create dataset" onClick={makeDataset} isDisabled={!!busy || records.length === 0} />
        {onSaveSource && <Button variant="secondary" size="sm" label="Save as refreshable source" onClick={makeSource} isDisabled={!!busy} icon={busy === 'source' ? <Loader2 className="size-4 animate-spin" /> : undefined} />}
        {done?.dataset && <span className="flex items-center gap-1 text-sm text-success"><Check className="size-4" /> Dataset created — <Link className="underline" to={`/datasets/${done.dataset.id}`}>open it</Link></span>}
        {done?.source && <span className="flex items-center gap-1 text-sm text-success"><Check className="size-4" /> Saved as a source. Import it from Data Sources → Connected Sources.</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto"><DataGrid bare columns={table.columns} rows={table.rows} maxHeight="100%" /></div>
    </div>
  );
}
