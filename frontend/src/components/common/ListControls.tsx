import type { ReactNode } from 'react';
import { Grid, ListFilter, Search } from 'lucide-react';
import type { ListViewMode } from '@/hooks/useListView';
import { cn } from '@/lib/utils';

/** Small controls shared by every list page: search box, table/grid switch, underline tabs. */

export function SearchBox({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground/70" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-60 rounded-md border border-input bg-card pl-9 pr-3 text-xs shadow-xs focus:border-ring focus:outline-hidden focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

export function ViewToggle({ value, onChange }: { value: ListViewMode; onChange: (v: ListViewMode) => void }) {
  const option = (mode: ListViewMode, label: string, icon: ReactNode) => (
    <button
      onClick={() => onChange(mode)}
      title={`${label} presentation`}
      aria-pressed={value === mode}
      className={cn(
        'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
        value === mode ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <div className="flex items-center rounded-lg border bg-muted p-0.5">
      {option('table', 'Table', <ListFilter className="h-3.5 w-3.5" />)}
      {option('grid', 'Grid', <Grid className="h-3.5 w-3.5" />)}
    </div>
  );
}

export interface UnderlineTab<Id extends string> {
  id: Id;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function UnderlineTabs<Id extends string>({ tabs, value, onChange }: {
  tabs: UnderlineTab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-pressed={value === t.id}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-all',
            value === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.icon}
          <span>{t.label}</span>
          {t.count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
