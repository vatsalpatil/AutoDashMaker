import { useMemo } from 'react';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';

const NONE = '';

/** Group datasets by folder ('Finance/2026' sorts under Finance). Datasets without a folder come last. */
export function groupByFolder(datasets: Dataset[]): [string, Dataset[]][] {
  const m = new Map<string, Dataset[]>();
  for (const d of datasets) {
    const k = d.folder || NONE;
    m.set(k, [...(m.get(k) ?? []), d]);
  }
  return [...m].sort(([a], [b]) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b, undefined, { sensitivity: 'base' })));
}

/** Collapsible folder sections; `render` draws the datasets of one folder (the normal list/grid). Flat when no folders are used. */
export function DatasetFolders({ datasets, render }: { datasets: Dataset[]; render: (items: Dataset[]) => React.ReactNode }) {
  const groups = useMemo(() => groupByFolder(datasets), [datasets]);
  const [closed, setClosed] = useLocalStorage<string[]>('sources.closedFolders', []);
  if (groups.length === 0 || (groups.length === 1 && groups[0][0] === NONE)) return <>{render(datasets)}</>;

  const toggle = (k: string) => setClosed(closed.includes(k) ? closed.filter((x) => x !== k) : [...closed, k]);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([folder, items]) => {
        const open = !closed.includes(folder);
        const Icon = open ? FolderOpen : Folder;
        return (
          <section key={folder || '(none)'} className="flex flex-col gap-2">
            <button type="button" onClick={() => toggle(folder)} aria-expanded={open}
              className="flex items-center gap-2 self-start rounded-md px-1 py-0.5 text-sm font-semibold hover:bg-accent">
              <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
              <Icon className={cn('size-4', folder ? 'text-primary' : 'text-muted-foreground')} />
              {folder ? folder.split('/').join(' / ') : 'No folder'}
              <span className="font-normal text-muted-foreground">· {items.length}</span>
            </button>
            {open && render(items)}
          </section>
        );
      })}
    </div>
  );
}
