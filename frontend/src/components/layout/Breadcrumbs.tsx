import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CRUMB_LABELS } from './nav';

/** URL segment → where that crumb leads (a dataset's list is the Data Sources page). */
const LIST_ROUTE: Record<string, string> = { datasets: '/sources' };
const NAMED = new Set(['datasets', 'charts', 'dashboards']);  // /<kind>/<id> pages whose id is shown as the item's name
const names = new Map<string, string>();

/** The display name of an entity (dataset / chart / dashboard) for its crumb; the id is shown only while loading. */
function useEntityName(kind: string | undefined, id: string | undefined): string | undefined {
  const key = kind && id ? `${kind}/${id}` : '';
  const [name, setName] = useState<string | undefined>(names.get(key));
  useEffect(() => {
    if (!key || id === 'new') { setName(undefined); return; }
    setName(names.get(key));
    let alive = true;
    api.get<{ name?: string }>(`/${key}`)
      .then((r) => { if (r.name) { names.set(key, r.name); if (alive) setName(r.name); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [key, id]);
  return name;
}

/** Home › Section › item name. Every crumb but the last is a link; a back arrow goes up one level. */
export function Breadcrumbs() {
  const nav = useNavigate();
  const parts = useLocation().pathname.split('/').filter(Boolean);
  const entity = useEntityName(NAMED.has(parts[0]) ? parts[0] : undefined, parts[1]);

  if (parts.length === 0) return <span className="truncate text-sm font-medium">Home</span>;

  const crumbs = parts.map((p, i) => ({
    label: i === 1 && entity ? entity : p === 'new' ? 'New' : CRUMB_LABELS[p] ?? p,
    to: i === 0 ? (LIST_ROUTE[p] ?? `/${p}`) : `/${parts.slice(0, i + 1).join('/')}`,
  }));
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].to : '/';

  return (
    <div className="flex min-w-0 items-center gap-1">
      {parts.length > 1 && (
        <button type="button" onClick={() => nav(parent)} aria-label="Back" title="Back"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="size-4" />
        </button>
      )}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="hidden hover:text-foreground sm:inline">Home</Link>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={c.to} className={cn('flex min-w-0 items-center gap-1', !last && 'hidden sm:flex')}>
              <ChevronRight className="hidden size-3 shrink-0 sm:block" />
              {last
                ? <span className="truncate font-medium text-foreground" title={c.label}>{c.label}</span>
                : <Link to={c.to} className="truncate hover:text-foreground">{c.label}</Link>}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
