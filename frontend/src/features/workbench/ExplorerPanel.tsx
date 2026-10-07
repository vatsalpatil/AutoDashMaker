import { useMemo, useState } from 'react';
import { Bookmark, FileText, History, PanelLeftClose, PanelLeftOpen, Search, Table2 } from 'lucide-react';
import { ResizeHandle, useResizableWidth } from '@/components/common/ResizeHandle';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Dataset, SavedQuery } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HistoryTab } from './explorer/HistoryTab';
import { NotebooksTab } from './explorer/NotebooksTab';
import { SavedTab } from './explorer/SavedTab';
import { TablesTab } from './explorer/TablesTab';
import type { Notebook } from './useNotebook';

type Tab = 'tables' | 'saved' | 'notebooks' | 'history';
interface Prefs { collapsed: boolean; tab: Tab }

const DEFAULT_PREFS: Prefs = { collapsed: typeof window !== 'undefined' && window.innerWidth < 1150, tab: 'tables' };

/** Left panel of the workbench: Tables (tree), Saved queries and run History; collapsible and resizable. */
export function ExplorerPanel({ datasets, savedQueries, notebooks, onInsertText, onLoadSql, onLoadSaved, onAddStep, onDeleteSaved }: {
  datasets: Dataset[];
  savedQueries: SavedQuery[];
  notebooks: Notebook['notebooks'];
  onInsertText: (text: string) => void;
  onLoadSql: (sql: string) => void;
  onLoadSaved: (q: SavedQuery) => void;
  onAddStep: (sql: string) => void;
  onDeleteSaved: (id: string) => void;
}) {
  const [prefs, setPrefs] = useLocalStorage<Prefs>('workbench.explorer', DEFAULT_PREFS);
  const [filter, setFilter] = useState('');
  const { width, handleProps } = useResizableWidth({ key: 'workbench.width.explorer', initial: 256, min: 180, max: 560, edge: 'right' });
  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  const q = filter.trim().toLowerCase();
  const tables = useMemo(() => datasets.filter((d) => !q || (d.physical_name ?? d.name).toLowerCase().includes(q) || d.name.toLowerCase().includes(q)), [datasets, q]);
  const saved = useMemo(() => savedQueries.filter((s) => !q || s.name.toLowerCase().includes(q) || s.sql.toLowerCase().includes(q)), [savedQueries, q]);

  if (prefs.collapsed) {
    const rail = (tab: Tab, label: string, icon: React.ReactNode) => (
      <button type="button" onClick={() => update({ collapsed: false, tab })} aria-label={label} title={label} className="text-muted-foreground hover:text-primary">{icon}</button>
    );
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center gap-2 border-r bg-card py-2">
        <button type="button" onClick={() => update({ collapsed: false })} aria-label="Expand explorer" title="Expand explorer" className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_70%,black)]"><PanelLeftOpen className="size-4" /></button>
        {rail('tables', `Tables (${datasets.length})`, <Table2 className="size-4" />)}
        {rail('saved', `Saved queries (${savedQueries.length})`, <Bookmark className="size-4" />)}
        {rail('notebooks', `Notebooks (${notebooks.items.length})`, <FileText className="size-4" />)}
        {rail('history', 'History', <History className="size-4" />)}
      </aside>
    );
  }

  const tabBtn = (id: Tab, label: string, count?: number) => (
    <button type="button" onClick={() => update({ tab: id })} aria-pressed={prefs.tab === id}
      className={cn('flex-1 rounded-md px-2 py-1 text-xs font-semibold', prefs.tab === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
      {label}{count !== undefined && <span className="ml-1 opacity-70">{count}</span>}
    </button>
  );

  return (
    <>
      <aside className="flex min-h-0 shrink-0 flex-col gap-2 border-r bg-card p-2.5" style={{ width, minWidth: 160 }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Explorer</h3>
          <button type="button" onClick={() => update({ collapsed: true })} aria-label="Collapse explorer" title="Collapse explorer" className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_70%,black)]"><PanelLeftClose className="size-4" /></button>
        </div>
        <div className="flex gap-1.5">{tabBtn('tables', 'Tables', datasets.length)}{tabBtn('saved', 'Saved', savedQueries.length)}{tabBtn('notebooks', 'Notebooks', notebooks.items.length)}{tabBtn('history', 'History')}</div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1.5 size-3.5 text-muted-foreground" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${prefs.tab}…`}
            className="w-full rounded-md border bg-transparent py-1 pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {prefs.tab === 'tables' && <TablesTab datasets={tables} onInsert={onInsertText} onRun={onLoadSql} />}
          {prefs.tab === 'saved' && <SavedTab queries={saved} onLoad={onLoadSaved} onAddStep={onAddStep} onDelete={onDeleteSaved} />}
          {prefs.tab === 'notebooks' && <NotebooksTab notebooks={notebooks} filter={filter} />}
          {prefs.tab === 'history' && <HistoryTab filter={filter} onLoadSql={onLoadSql} onAddStep={onAddStep} />}
        </div>
      </aside>
      <ResizeHandle {...handleProps} label="Resize explorer" />
    </>
  );
}
