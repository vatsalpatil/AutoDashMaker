import { useRef, useState } from 'react';
import { FileKey, Loader2, Upload, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

/** Shown name of a stored certificate: the server prefixes uploads with an 8-char id. */
const shownName = (path: string) => path.split(/[\\/]/).pop()?.replace(/^[0-9a-f]{8}_/, '') ?? path;

/** Upload one certificate/key file to the server and keep its server path as the field value. */
export function FileField({ label, value, accept, onChange }: {
  label: string;
  value: string;
  accept?: string;
  onChange: (path: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.upload<{ path: string }>('/sources/files', file);
      onChange(r.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex h-8 items-center gap-2 rounded-lg border border-input px-2 text-sm">
        {value ? (
          <>
            <FileKey className="size-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate" title={value}>{shownName(value)}</span>
            <button type="button" aria-label={`Remove ${label}`} onClick={() => onChange('')} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
          </>
        ) : <span className="flex-1 text-muted-foreground">No file</span>}
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium hover:bg-accent disabled:opacity-50">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}{value ? 'Replace' : 'Choose'}
        </button>
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
