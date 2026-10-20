import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui/kit';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiCatalogEntry, AiProvider } from '@/lib/types';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { AddProviderDialog } from './AddProviderDialog';
import { ProviderCard } from './ProviderCard';
import { EditProviderDialog } from './EditProviderDialog';
import { AutoSwitchCard } from './AutoSwitchCard';

export default function AiSettings() {
  const [catalog, setCatalog] = useState<AiCatalogEntry[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<AiCatalogEntry[]>('/ai/catalog').then(setCatalog).catch((e) => setError(e.message));
    api.get<AiProvider[]>('/ai/providers').then(setProviders).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const active = providers.find((p) => p.is_default) ?? providers[0];
  const kindOf = (p: AiProvider) => catalog.find((c) => c.id === p.provider)?.label ?? p.provider;
  // a custom name ("OpenRouter · key 2", "Work key") wins over the auto label "openrouter (model)"
  const nameOf = (p: AiProvider) => (p.label && !p.label.startsWith(`${p.provider} (`) ? p.label : kindOf(p));
  const connected = new Map<string, number>();
  providers.forEach((p) => connected.set(p.provider, (connected.get(p.provider) ?? 0) + 1));

  async function remove(p: AiProvider) {
    if (!confirm(`Disconnect ${nameOf(p)}? Its stored key is deleted.`)) return;
    await api.del(`/ai/providers/${p.id}`).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <Card padding={4}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active model</p>
            {active ? (
              <p className="mt-0.5 text-lg font-semibold">
                {active.model}
                <span className="ml-2 text-sm font-normal text-muted-foreground">via {nameOf(active)}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">No provider connected yet — add one to enable Ask and the SQL assistant.</p>
            )}
          </div>
          <div className="flex gap-2">
            {active && <Button variant="secondary" label="Change model" onClick={() => setExpanded(active.id)} />}
            <Button variant="primary" label="Add provider" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)} />
          </div>
        </div>
      </Card>

      {active && <AutoSwitchCard active={active} count={providers.length} onChanged={load} />}

      {providers.map((p) => (
        <ProviderCard key={p.id} p={p} label={(connected.get(p.provider) ?? 0) > 1 ? `${nameOf(p)} ${p.api_key ?? ''}`.trim() : nameOf(p)} expanded={expanded === p.id}
          onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
          onCollapse={() => setExpanded((cur) => (cur === p.id ? null : cur))} onChanged={load} onEdit={() => setEditing(p)} onRemove={() => remove(p)} />
      ))}


      <EditProviderDialog provider={editing} name={editing ? nameOf(editing) : ''} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }} />
      <AddProviderDialog open={adding} catalog={catalog} connected={connected}
        isFirst={providers.length === 0} onClose={() => setAdding(false)}
        onConnected={(id) => { setAdding(false); load(); setExpanded(id); }} />
    </div>
  );
}
