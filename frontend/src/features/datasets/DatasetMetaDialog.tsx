import { useEffect, useId, useState } from 'react';
import { Folder } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Button, Dialog, TextInput } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';

export interface DatasetMeta { name: string; folder: string; description?: string }
export interface FolderInfo { name: string; count: number }

/** Folder text box that suggests the folders already in use ('Finance/2026' nests). Shared by every dataset form. */
export function FolderField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const listId = useId();
  const folders = useApi<FolderInfo[]>('/datasets/folders').data ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <TextInput label="Folder (optional)" value={value} onChange={onChange} list={listId} isDisabled={disabled}
        placeholder="e.g. Finance or Finance/2026" />
      <datalist id={listId}>{folders.map((f) => <option key={f.name} value={f.name} />)}</datalist>
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {folders.slice(0, 8).map((f) => (
            <button key={f.name} type="button" disabled={disabled} onClick={() => onChange(f.name)}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent">
              <Folder className="size-3" /> {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Name + folder (+ description) for a dataset: used when adding a file and when editing a dataset later. */
export function DatasetMetaDialog({ open, title, hint, initial, submitLabel, withDescription, onClose, onSubmit }: {
  open: boolean; title: string; hint?: string; initial: DatasetMeta; submitLabel: string; withDescription?: boolean;
  onClose: () => void; onSubmit: (meta: DatasetMeta) => Promise<unknown>;
}) {
  const [meta, setMeta] = useState<DatasetMeta>(initial);
  useEffect(() => { if (open) setMeta(initial); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset per opening
  const [submit, { busy, error }] = useAsyncAction(async () => { await onSubmit({ ...meta, name: meta.name.trim(), folder: meta.folder.trim() }); onClose(); });
  const set = (k: keyof DatasetMeta) => (v: string) => setMeta((m) => ({ ...m, [k]: v }));

  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <form className="flex w-[28rem] max-w-full flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        <ErrorBanner message={error} />
        <TextInput label="Dataset name" value={meta.name} onChange={set('name')} isDisabled={busy} autoFocus required maxLength={80}
          placeholder="What you'll call it in Ask, SQL and charts" />
        <FolderField value={meta.folder} onChange={set('folder')} disabled={busy} />
        {withDescription && <TextInput label="Description (optional)" value={meta.description ?? ''} onChange={set('description')} isDisabled={busy} maxLength={500} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" label="Cancel" onClick={onClose} isDisabled={busy} />
          <Button type="submit" variant="primary" label={busy ? 'Saving…' : submitLabel} isDisabled={busy || !meta.name.trim()} />
        </div>
      </form>
    </Dialog>
  );
}
