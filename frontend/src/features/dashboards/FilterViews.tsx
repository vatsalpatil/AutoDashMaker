import { Bookmark, BookmarkPlus, X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { FilterQuery } from '@/components/reui/filters/filters-types';

interface SavedView { name: string; query: FilterQuery }

/** Saved filter views ("bookmarks"): name the current dashboard filters, bring them back with one click. Per dashboard, per browser. */
export function FilterViews({ dashboardId, query, active, onApply }: {
  dashboardId: string; query: FilterQuery; active: boolean; onApply: (q: FilterQuery) => void;
}) {
  const [views, setViews] = useLocalStorage<SavedView[]>(`dashboard.views.${dashboardId}`, []);
  if (!active && views.length === 0) return null;
  const save = () => {
    const name = window.prompt('Name this filter view')?.trim();
    if (name) setViews((v) => [...v.filter((x) => x.name !== name), { name, query }]);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Bookmark className="size-3.5 text-muted-foreground" />
      {views.map((v) => (
        <span key={v.name} className="inline-flex items-center overflow-hidden rounded-full border">
          <button type="button" onClick={() => onApply(v.query)} className="px-2.5 py-1 font-medium hover:bg-accent hover:text-primary">{v.name}</button>
          <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => setViews((all) => all.filter((x) => x.name !== v.name))} className="px-1.5 py-1 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
        </span>
      ))}
      {active && <button type="button" onClick={save} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-muted-foreground hover:border-primary hover:text-primary"><BookmarkPlus className="size-3.5" />Save view</button>}
    </div>
  );
}
