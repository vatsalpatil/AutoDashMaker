import { Plus, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { kv, type KV } from './studioModel';

/** Hoppscotch-style rows: enable checkbox, key, value, delete. A blank row is always kept at the end. */
export function KeyValueEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: {
  rows: KV[];
  onChange: (rows: KV[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (id: string, patch: Partial<KV>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    const last = next[next.length - 1];
    onChange(last && (last.key || last.value) ? [...next, kv()] : next);
  };
  const input = 'h-8 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground';
  return (
    <div className="flex flex-col divide-y rounded-lg border">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-1 px-2">
          <Checkbox checked={r.on} onCheckedChange={(c) => update(r.id, { on: !!c })} aria-label="Enabled" />
          <input value={r.key} onChange={(e) => update(r.id, { key: e.target.value })} placeholder={keyPlaceholder} className={input} />
          <input value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder={valuePlaceholder} className={input} />
          <button type="button" aria-label="Remove row" onClick={() => onChange(rows.length > 1 ? rows.filter((x) => x.id !== r.id) : [kv()])}
            className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, kv()])} className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="size-3.5" /> Add row
      </button>
    </div>
  );
}
