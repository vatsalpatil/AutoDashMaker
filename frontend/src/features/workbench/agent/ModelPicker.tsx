import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Cpu, Search, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ctxLabel, priceLabel } from '@/features/ai/ModelList';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { AiModelList, AiProvider } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Active AI provider + model, switchable from the chat (like Roo Code's model picker). Changes the app-wide default. */
export function ModelPicker({ disabled }: { disabled?: boolean }) {
  const providers = useApi<AiProvider[]>('/ai/providers');
  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);    // provider whose models are listed
  const [list, setList] = useState<AiModelList | null>(null);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = providers.data ?? [];
  const active = all.find((p) => p.is_default) ?? all[0];
  const shown = all.find((p) => p.id === viewId) ?? active;

  useEffect(() => {
    if (!open || !shown) return;
    setList(null);
    setError(null);
    api.get<AiModelList>(`/ai/models?provider_id=${shown.id}`).then(setList).catch((e) => setList({ models: [], source: 'fallback', error: e.message }));
  }, [open, shown?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const models = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list?.models ?? []).filter((m) => (!freeOnly || m.free) && (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))).slice(0, 120);
  }, [list, query, freeOnly]);

  async function pick(modelId: string) {
    if (!shown) return;
    try {
      await api.post(`/ai/providers/${shown.id}/model`, { model: modelId, make_default: true });
      providers.reload();
      setOpen(false);
    } catch (e) { setError((e as Error).message); }
  }

  if (providers.data && all.length === 0) {
    return <Link to="/settings" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-warning hover:bg-accent"><Cpu className="size-3" /> Connect an AI model</Link>;
  }
  const label = active ? (active.model ?? active.provider) : '…';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" disabled={disabled} title={active ? `${active.label} — ${label}` : 'AI model'}
        className="flex min-w-0 max-w-[11rem] items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50" />}>
        <Cpu className="size-3 shrink-0" /><span className="truncate">{label}</span><ChevronDown className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-0">
        <div className="flex flex-wrap gap-1 border-b p-2">
          {all.map((p) => (
            <button key={p.id} type="button" onClick={() => setViewId(p.id)}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', p.id === shown?.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
              {p.label.replace(/\s*\(.*\)$/, '')}{p.is_default && <Check className="size-3" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={list ? `Search ${list.models.length} models…` : 'Loading models…'} autoFocus
            className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> Free</label>
        </div>
        <ul className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Models">
          {!list && <li className="p-2 text-xs text-muted-foreground">Loading…</li>}
          {list && models.length === 0 && <li className="p-2 text-xs text-muted-foreground">No model matches.</li>}
          {models.map((m) => {
            const current = shown?.is_default && shown.model === m.id;
            return (
              <li key={m.id}>
                <button type="button" onClick={() => pick(m.id)} role="option" aria-selected={current}
                  className={cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent', current && 'bg-accent')}>
                  <span className="min-w-0 flex-1 truncate" title={m.id}>{m.name || m.id}</span>
                  {m.free && <span className="rounded bg-success/15 px-1 text-[10px] text-success">free</span>}
                  <span className="shrink-0 text-[10px] text-muted-foreground">{ctxLabel(m.context) ?? priceLabel(m) ?? ''}</span>
                  {current && <Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
        {(error || list?.error) && <p className="border-t px-2 py-1 text-[11px] text-destructive">{error ?? `Showing a built-in list: ${list?.error}`}</p>}
        <Link to="/settings" className="flex items-center gap-1 border-t px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"><Settings2 className="size-3" /> Manage providers in Settings</Link>
      </PopoverContent>
    </Popover>
  );
}
