import { useState } from 'react';
import { Button, Dialog } from '@/components/ui/kit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Widget } from '@/lib/types';

export type ContentKind = 'text' | 'link' | 'iframe';
export interface ContentValue { kind: ContentKind; title: string; settings: Record<string, unknown> }

const HELP: Record<ContentKind, string> = {
  text: 'Markdown: **bold**, lists, tables, `code`. Write {{Column}} to show that column\'s current dashboard filter value.',
  link: 'A card that opens a page. Use https://… for outside links, or /charts, /dashboards … for pages in this app.',
  iframe: 'Embeds another page, a video or a document viewer. The site must allow being embedded.',
};
const LABEL: Record<ContentKind, string> = { text: 'text card', link: 'link card', iframe: 'embed card' };

/** Create or edit a text / link / embed card. */
export function ContentDialog({ open, kind, widget, onSave, onClose }: {
  open: boolean; kind: ContentKind; widget?: Widget | null; onSave: (v: ContentValue) => void; onClose: () => void;
}) {
  const s = widget?.settings ?? {};
  const [title, setTitle] = useState(widget?.title ?? '');
  const [content, setContent] = useState(String(s.content ?? ''));
  const [url, setUrl] = useState(String(s.url ?? ''));
  const [description, setDescription] = useState(String(s.description ?? ''));
  const ok = kind === 'text' ? content.trim() !== '' : /^(https?:\/\/|\/)/i.test(url.trim());
  const field = (label: string, value: string, set: (v: string) => void, placeholder = '') => (
    <div className="flex flex-col gap-1.5"><Label className="font-normal text-muted-foreground">{label}</Label><Input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} /></div>
  );
  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()}>
      <div className="flex w-[30rem] max-w-full flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold">{widget ? 'Edit' : 'Add'} {LABEL[kind]}</h2>
        <p className="text-xs text-muted-foreground">{HELP[kind]}</p>
        {field('Heading (optional)', title, setTitle)}
        {kind === 'text' ? (
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} aria-label="Text" placeholder={'## Heading\nSome **notes** for this dashboard'}
            className="rounded-md border bg-transparent p-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        ) : (
          <>
            {field('URL', url, setUrl, 'https://…')}
            {kind === 'link' && field('Description (optional)', description, setDescription)}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" label="Cancel" onClick={onClose} />
          <Button variant="primary" label={widget ? 'Save' : 'Add'} isDisabled={!ok}
            onClick={() => onSave({ kind, title: title.trim(), settings: kind === 'text' ? { content } : { url: url.trim(), ...(kind === 'link' ? { description } : {}) } })} />
        </div>
      </div>
    </Dialog>
  );
}
