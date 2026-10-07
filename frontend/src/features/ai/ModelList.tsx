import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/kit';
import { Check, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiModel, AiModelList, AiProvider } from '@/lib/types';
import { ErrorBanner } from '@/components/common/ErrorBanner';

const MAX_ROWS = 100;

export function ctxLabel(n?: number | null) {
  if (!n) return null;
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M ctx` : `${Math.round(n / 1000)}k ctx`;
}

export function priceLabel(m: AiModel) {
  if (m.free || m.price_in == null || m.price_out == null) return null;
  const f = (v: number) => (v < 0.1 ? v.toFixed(3) : v.toFixed(2));
  return `$${f(m.price_in)} / $${f(m.price_out)} per 1M`;
}

/** The models one connected provider offers (live from the provider), searchable; click to switch. */
export function ModelList({ provider, onChanged }: { provider: AiProvider; onChanged: () => void }) {
  const [list, setList] = useState<AiModelList | null>(null);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setList(null);
    api.get<AiModelList>(`/ai/models?provider_id=${provider.id}`)
      .then(setList)
      .catch((e) => setList({ models: [], source: 'fallback', error: e.message }));
  }, [provider.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list?.models ?? []).filter(
      (m) => (!freeOnly || m.free) && (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
    );
  }, [list, query, freeOnly]);

  async function pick(m: AiModel) {
    try {
      await api.post(`/ai/providers/${provider.id}/model`, { model: m.id, make_default: true });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!list) return <p className="py-3 text-sm text-muted-foreground">Loading available models…</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${list.models.length} models…`}
            className="w-full rounded-lg border border-border bg-transparent py-2 pl-8 pr-3 text-sm outline-hidden focus:border-blue-500" />
        </div>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
          <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> Free only
        </label>
      </div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {list.source === 'fallback' && (
        <p className="text-xs text-warning">
          Showing the built-in shortlist — couldn’t load the live list{list.error ? `: ${list.error.split('\n')[0]}` : ''}.
        </p>
      )}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No models match.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.slice(0, MAX_ROWS).map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => pick(m)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40">
                  <span className="w-4 shrink-0">{provider.model === m.id && <Check className="h-4 w-4 text-success" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{m.id}</span>
                    {(ctxLabel(m.context) || priceLabel(m)) && (
                      <span className="block truncate text-xs text-muted-foreground/70">
                        {[ctxLabel(m.context), priceLabel(m)].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {m.free && <Badge variant="success" label="free" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length > MAX_ROWS ? `Showing ${MAX_ROWS} of ${filtered.length} — type to narrow` : `${filtered.length} model${filtered.length === 1 ? '' : 's'}`}
        {' · '}click a model to use it
      </p>
    </div>
  );
}

