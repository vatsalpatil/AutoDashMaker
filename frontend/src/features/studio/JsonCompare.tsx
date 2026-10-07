import { useMemo, useState } from 'react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { diffJson, parseLoose, type JsonChange } from '@/lib/jsonTools';
import { cn } from '@/lib/utils';

const tone: Record<JsonChange['kind'], string> = { added: 'text-success', removed: 'text-destructive', changed: 'text-warning' };
const show = (v: unknown) => { const s = JSON.stringify(v); return s && s.length > 80 ? s.slice(0, 80) + '…' : s; };

/** Compare the current document with a second one pasted here; lists every added / removed / changed path. */
export function JsonCompare({ value }: { value: unknown }) {
  const [other, setOther] = useState('');
  const parsed = useMemo(() => (other.trim() ? parseLoose(other) : null), [other]);
  const changes = useMemo(() => (parsed?.value !== undefined ? diffJson(value, parsed.value) : null), [value, parsed]);

  return (
    <div className="flex h-full flex-col">
      <div className="h-40 shrink-0 border-b">
        <CodeEditor value={other} onChange={setOther} language="json" height="100%" placeholder="Paste the JSON to compare against…" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        {!parsed ? <p className="text-muted-foreground">Paste a second document above to see the differences.</p>
          : changes === null ? <p className="text-destructive">{parsed.error}</p>
          : changes.length === 0 ? <p className="text-success">✓ The documents are identical.</p>
          : <>
              <p className="mb-2 text-muted-foreground">{changes.length} difference{changes.length === 1 ? '' : 's'} (left → right)</p>
              <ul className="space-y-1 font-mono">
                {changes.map((c, i) => (
                  <li key={i} className="flex gap-2"><span className={cn('w-16 shrink-0 font-semibold', tone[c.kind])}>{c.kind}</span>
                    <span className="shrink-0">{c.path}</span>
                    <span className="truncate text-muted-foreground">{c.kind === 'changed' ? `${show(c.before)} → ${show(c.after)}` : show(c.kind === 'added' ? c.after : c.before)}</span></li>
                ))}
              </ul>
            </>}
      </div>
    </div>
  );
}
