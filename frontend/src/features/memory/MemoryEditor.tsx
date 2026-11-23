import { useState } from 'react';
import { Eye, Pencil, Save, Trash2 } from 'lucide-react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { Markdown } from '@/components/common/Markdown';
import { Button } from '@/components/ui/kit';
import type { MemoryState } from './useMemory';

/** Right column: edit the open memory file as Markdown, or preview it rendered. Ctrl+Enter saves. */
export function MemoryEditor({ m }: { m: MemoryState }) {
  const [preview, setPreview] = useState(false);
  const main = m.open === 'MEMORY.md';
  const onRename = () => {
    const to = window.prompt('New file name', m.open);
    if (to && to !== m.open) m.rename(m.open, to);
  };
  const onDelete = () => {
    if (window.confirm(main ? 'Reset MEMORY.md to the starter text?' : `Delete ${m.open}? This cannot be undone.`)) m.remove(m.open);
  };
  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        {main
          ? <span className="mono text-sm font-semibold">{m.open}</span>
          : <button type="button" onClick={onRename} title="Rename" className="mono text-sm font-semibold hover:underline">{m.open}</button>}
        {m.dirty && <span className="text-xs text-muted-foreground">· unsaved</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" label={preview ? 'Edit' : 'Preview'}
            icon={preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onClick={() => setPreview(!preview)} />
          <Button size="sm" variant="ghost" label={main ? 'Reset' : 'Delete'} icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} />
          <Button size="sm" variant="primary" label={m.saving ? 'Saving…' : 'Save'} icon={<Save className="h-4 w-4" />}
            onClick={() => m.save()} isDisabled={!m.dirty || m.saving} />
        </div>
      </div>
      {preview
        ? <div className="min-h-[24rem] overflow-auto px-5 py-4 text-sm"><Markdown text={m.draft || '*Empty*'} /></div>
        : <CodeEditor value={m.draft} onChange={m.setDraft} language="text" onRun={() => { if (m.dirty) m.save(); }}
            minHeight="24rem" maxHeight="65vh" placeholder="# Notes for the AI: preferences, business terms, how you like answers" />}
    </section>
  );
}
