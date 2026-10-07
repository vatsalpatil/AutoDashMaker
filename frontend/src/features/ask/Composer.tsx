import { useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import type { Dataset } from '@/lib/types';

/** Chat input: Enter sends, Shift+Enter adds a line. The scope picker limits the analyst to one table. */
export function Composer({ datasets, scope, onScope, busy, followUp, onSend }: {
  datasets: Dataset[];
  scope: string;
  onScope: (id: string) => void;
  busy: boolean;
  followUp: boolean;
  onSend: (q: string) => void;
}) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="mx-auto w-full max-w-4xl rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
      <textarea
        value={text} rows={2} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={followUp ? 'Ask a follow-up — “only 2024”, “break it down by product”…' : 'Ask anything about your data — “top 5 regions by revenue last quarter”'}
        className="block w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-hidden placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <div className="w-56">
          <SelectField aria-label="Data scope" value={scope || 'all'} onChange={(e) => onScope(e.target.value === 'all' ? '' : e.target.value)}>
            <option value="all">All tables &amp; saved queries</option>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
        </div>
        <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label="Send"
          className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
    </div>
  );
}
