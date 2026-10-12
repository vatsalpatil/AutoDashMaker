import { useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { SelectField } from '@/components/common/SelectField';
import type { Dataset } from '@/lib/types';
import { AttachImageButton, AttachmentTray } from '@/features/ai/attachments/Attachments';
import { useImageAttachments } from '@/features/ai/attachments/useImageAttachments';

/** Chat input: Enter sends, Shift+Enter adds a line. The scope picker limits the analyst to one table. */
export function Composer({ datasets, scope, onScope, busy, followUp, onSend }: {
  datasets: Dataset[];
  scope: string;
  onScope: (id: string) => void;
  busy: boolean;
  followUp: boolean;
  onSend: (q: string, images: string[]) => void;
}) {
  const [text, setText] = useState('');
  const att = useImageAttachments();
  const send = () => {
    if (!text.trim() || busy) return;
    onSend(text, att.take());
    setText('');
  };
  return (
    <div onDrop={att.dropProps.onDrop} onDragOver={att.dropProps.onDragOver} className="mx-auto w-full max-w-4xl rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
      <AttachmentTray att={att} className="px-2 pt-1" />
      <textarea
        value={text} rows={2} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} onPaste={att.dropProps.onPaste}
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
        <span className="ml-auto" /><AttachImageButton att={att} disabled={busy} />
        <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label="Send"
          className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
    </div>
  );
}
