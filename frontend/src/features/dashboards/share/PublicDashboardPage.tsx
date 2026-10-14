import { useEffect, useState } from 'react';
import { BRAND_NAME } from '@/lib/brand';
import { prime } from '@/lib/dataCache';
import type { Dashboard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SavedLayout } from '../SavedLayout';

type Shared = Dashboard & { expires_at: string | null };

async function get<T>(path: string, method = 'GET'): Promise<T> {
  const r = await fetch(`/api/public/shares/${path}`, { method });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? `HTTP ${r.status}`);
  return r.json();
}

/** What someone opening a share link sees: the dashboard, read-only, no login. Data comes from the public endpoints only. */
export function PublicDashboardPage({ token }: { token: string }) {
  const [d, setD] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    Promise.all([get<Shared>(token), get<Parameters<typeof prime>[0]>(`${token}/data`, 'POST')])
      .then(([dash, data]) => { prime(data); setD(dash); })
      .catch((e) => setError((e as Error).message));
  }, [token]);

  if (error) return <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-sm text-muted-foreground">{error}</div>;
  if (!d) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading dashboard…</div>;
  const pages = d.pages?.length ? d.pages : [{ id: 'main', name: 'Main' }];
  const cur = pages[Math.min(page, pages.length - 1)];
  const widgets = (d.widgets ?? []).filter((w) => (w.page ?? 'main') === cur.id && !w.settings?.parked);
  return (
    <div className="flex h-screen flex-col bg-background p-4 text-foreground">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{d.name}</h1>
        {pages.length > 1 && (
          <nav className="flex gap-1">
            {pages.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setPage(i)} className={cn('rounded-md px-2 py-1 text-xs', i === page ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>{p.name}</button>
            ))}
          </nav>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Read-only view · shared from {BRAND_NAME}</span>
      </header>
      {d.description && <p className="mb-2 text-sm text-muted-foreground">{d.description}</p>}
      <SavedLayout widgets={widgets} />
    </div>
  );
}
