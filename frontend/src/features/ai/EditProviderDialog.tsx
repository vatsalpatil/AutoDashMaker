import { useEffect, useState } from 'react';
import { Button, Dialog, TextInput } from '@/components/ui/kit';
import { api } from '@/lib/api';
import type { AiProvider } from '@/lib/types';
import { ErrorBanner } from '@/components/common/ErrorBanner';

/** Rename a connected provider, replace its API key or change its base URL (a new key/URL is tested first). */
export function EditProviderDialog({ provider, name, onClose, onSaved }: {
  provider: AiProvider | null;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provider) { setLabel(provider.label ?? ''); setApiKey(''); setBaseUrl(provider.base_url ?? ''); setError(null); }
  }, [provider]);

  async function save() {
    if (!provider) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/ai/providers/${provider.id}`, { label, api_key: apiKey || undefined, base_url: baseUrl });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog isOpen={!!provider} onOpenChange={(o) => !o && onClose()}>
      <div className="flex w-[30rem] max-w-full flex-col gap-4 p-6">
        <h2 className="text-lg font-bold">Edit {name}</h2>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <TextInput label="Name" value={label} onChange={setLabel} />
        <TextInput label={`New API key (current ${provider?.api_key || 'none'})`} type="password" value={apiKey} onChange={setApiKey} />
        <TextInput label="Custom base URL (optional)" value={baseUrl} onChange={setBaseUrl} />
        <p className="text-xs text-muted-foreground">Leave the key blank to keep the current one. A new key or URL is tested before saving.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button variant="primary" label={busy ? 'Testing…' : 'Save'} onClick={save} isDisabled={busy} />
        </div>
      </div>
    </Dialog>
  );
}
