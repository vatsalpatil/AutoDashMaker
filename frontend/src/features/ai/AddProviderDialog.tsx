import { useEffect, useState } from 'react';
import { Badge, Button, Dialog, TextInput } from '@/components/ui/kit';
import { api } from '@/lib/api';
import type { AiCatalogEntry, AiProvider } from '@/lib/types';
import { ErrorBanner } from '@/components/common/ErrorBanner';

export function AddProviderDialog({ open, catalog, connected, isFirst, onClose, onConnected }: {
  open: boolean;
  catalog: AiCatalogEntry[];
  connected: Map<string, number>; // provider id -> keys already connected
  isFirst: boolean;
  onClose: () => void;
  onConnected: (id: string) => void;
}) {
  const [entry, setEntry] = useState<AiCatalogEntry | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setEntry(null); setApiKey(''); setBaseUrl(''); setName(''); setError(null); } }, [open]);
  const available = catalog;
  const n = entry ? (connected.get(entry.id) ?? 0) : 0;

  async function connect() {
    if (!entry) return;
    const model = entry.models?.[0] ?? '';
    setBusy(true);
    setError(null);
    try {
      const t = await api.post<{ ok?: boolean; detail?: string }>('/ai/providers/test', {
        provider: entry.id, model, api_key: apiKey, base_url: baseUrl || undefined,
      });
      if (t.ok === false) throw new Error(t.detail ?? 'connection failed');
      const row = await api.post<AiProvider>('/ai/providers', {
        provider: entry.id, model, label: name.trim() || (n ? `${entry.label} · key ${n + 1}` : `${entry.id} (${model})`),
        api_key: apiKey, base_url: baseUrl || undefined, is_default: isFirst,
      });
      onConnected(row.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex w-[30rem] max-w-full flex-col gap-4 p-6">
        {!entry ? (
          <>
            <h2 className="text-lg font-bold">Add a provider</h2>
            {(
              <ul className="flex flex-col gap-2">
                {available.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setEntry(c)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/40 ">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold uppercase text-muted-foreground ">{c.label[0]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-medium">{c.label}{c.free && <Badge variant="success" label="free" />}
                          {!!connected.get(c.id) && <Badge variant="neutral" label={`${connected.get(c.id)} connected · add another key`} />}</span>
                        {c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end"><Button variant="ghost" label="Cancel" onClick={onClose} /></div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold">{n ? `Add another ${entry.label} key` : `Connect ${entry.label}`}</h2>
              {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
            </div>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <TextInput label="API key" type="password" value={apiKey} onChange={setApiKey} />
            <TextInput label="Name (optional)" value={name} onChange={setName} placeholder={n ? `${entry.label} · key ${n + 1}` : 'e.g. Personal key'} />
            <TextInput label="Custom base URL (optional)" value={baseUrl} onChange={setBaseUrl} />
            <p className="text-xs text-muted-foreground">The key is stored on this server only and is never shown again.</p>
            <div className="flex justify-between">
              <Button variant="ghost" label="Back" onClick={() => setEntry(null)} />
              <Button variant="primary" label={busy ? 'Testing…' : 'Test & connect'} onClick={connect}
                isDisabled={busy || !apiKey.trim()} />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

