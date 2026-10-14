import { useState } from 'react';
import { Globe, PanelTop, Trash2 } from 'lucide-react';
import { Button, Dialog } from '@/components/ui/kit';
import type { ColumnInfo } from '../dashboardFilters';
import type { PinnedFilter, PinnedKind } from './pinnedModel';

const pretty = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const KIND_LABEL: Record<PinnedKind, string> = { select: 'Pick a value', year: 'Year', month: 'Month' };

/** Owner's dialog: pin a field as a labelled dropdown, choose whether it filters every tab or only one tab. */
export function ManageFiltersDialog({ open, onClose, filters, columns, pages, activePage, onSave }: {
  open: boolean;
  onClose: () => void;
  filters: PinnedFilter[];
  columns: Record<string, ColumnInfo>;
  pages: { id: string; name: string }[];
  activePage: string;
  onSave: (filters: PinnedFilter[]) => Promise<void> | void;
}) {
  const [list, setList] = useState<PinnedFilter[]>(filters);
  const fields = Object.keys(columns).sort();
  const [field, setField] = useState('');
  const date = !!field && (columns[field]?.months.size ?? 0) > 0;   // a date column can also be filtered by year or month
  const [kind, setKind] = useState<PinnedKind>('select');
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState('all');
  const pick = (f: string) => {
    setField(f);
    const isDate = (columns[f]?.months.size ?? 0) > 0;
    setKind(isDate ? 'year' : 'select');
    setLabel(isDate ? 'Year' : pretty(f));
  };
  const add = () => {
    if (!field) return;
    setList((l) => [...l, { id: Math.random().toString(36).slice(2, 9), field, label: label.trim() || pretty(field), kind, scope }]);
    setField(''); setLabel('');
  };
  const pageName = (id: string) => (id === 'all' ? 'All tabs' : pages.find((p) => p.id === id)?.name ?? id);
  const sel = 'h-8 rounded-md border bg-transparent px-2 text-sm';
  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()} className="w-[min(600px,100%)]">
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Filters for viewers</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pin the fields people should filter by. Each one shows as a labelled dropdown. <b>All tabs</b> filters every tab; <b>a tab</b> filters only that tab.</p>
        </div>
        <ul className="divide-y rounded-md border">
          {list.length === 0 && <li className="p-3 text-sm text-muted-foreground">No filters yet.</li>}
          {list.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {f.scope === 'all' ? <Globe className="size-4 text-primary" /> : <PanelTop className="size-4 text-primary" />}
              <span className="font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.field} · {KIND_LABEL[f.kind]} · {pageName(f.scope)}</span>
              <button type="button" aria-label={`Remove ${f.label}`} onClick={() => setList((l) => l.filter((x) => x.id !== f.id))} className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Field
            <select value={field} onChange={(e) => pick(e.target.value)} className={sel}><option value="">Choose a field…</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Label shown to viewers
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Country" className={sel} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Filter by
            <select value={kind} onChange={(e) => setKind(e.target.value as PinnedKind)} className={sel} disabled={!date}>
              <option value="select">Pick a value</option>{date && <><option value="year">Year</option><option value="month">Month</option></>}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Applies to
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={sel}>
              <option value="all">All tabs</option>
              {pages.map((p) => <option key={p.id} value={p.id}>Only “{p.name}”{p.id === activePage ? ' (this tab)' : ''}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" label="Add filter" onClick={add} isDisabled={!field} />
          <span className="ml-auto" />
          <Button variant="secondary" label="Cancel" onClick={onClose} />
          <Button variant="primary" label="Save filters" onClick={async () => { await onSave(list); onClose(); }} />
        </div>
      </div>
    </Dialog>
  );
}
