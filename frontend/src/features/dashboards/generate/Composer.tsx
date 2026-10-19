import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AttachImageButton, AttachmentTray } from '@/features/ai/attachments/Attachments';
import { MicButton } from '@/features/ai/voice/MicButton';
import { useImageAttachments } from '@/features/ai/attachments/useImageAttachments';

/** The chat box at the bottom of the session: grows with the text, Enter sends (Shift+Enter = new line), Stop while the AI works.
 * `actions` are context chips for the current phase (skip, build, start over…). */
export function Composer({ placeholder, busy, disabled, sendLabel, allowEmpty, onSend, onStop, actions, hint }: {
  placeholder: string; busy: boolean; disabled?: boolean; sendLabel?: string; allowEmpty?: boolean;
  onSend: (text: string, images: string[]) => void; onStop: () => void; actions?: ReactNode; hint?: string;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const att = useImageAttachments();
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);
  const can = !busy && !disabled && (allowEmpty || text.trim().length > 0 || att.images.length > 0);
  const send = () => { if (!can) return; onSend(text.trim(), att.take()); setText(''); };

  return (
    <div className="w-full px-4 pb-4 lg:px-6">
      {actions && <div className="mb-2 flex flex-wrap gap-1.5">{actions}</div>}
      <div onDrop={att.dropProps.onDrop} onDragOver={att.dropProps.onDragOver} className={cn('rounded-2xl border bg-card shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-primary/30', disabled && 'opacity-70')}>
        <AttachmentTray att={att} className="px-4 pt-3" />
        <textarea ref={box} rows={1} value={text} disabled={disabled} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)} onPaste={att.dropProps.onPaste}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="block max-h-52 w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted-foreground" />
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
          <MicButton value={text} onChange={setText} disabled={disabled || busy} /><AttachImageButton att={att} disabled={disabled || busy} />
          <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" className="ml-auto flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs hover:bg-accent">
              <Square className="size-3 fill-current" /> Stop
            </button>
          ) : (
            <button type="button" onClick={send} disabled={!can} aria-label={sendLabel ?? 'Send'}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40">
              {sendLabel && <span>{sendLabel}</span>}<ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A small rounded action chip for the composer row. */
export function ActionChip({ label, onClick, icon, disabled }: { label: string; onClick: () => void; icon?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 rounded-full border bg-card/80 px-3 py-1 text-xs backdrop-blur transition-colors hover:border-primary hover:text-primary disabled:opacity-40">
      {icon}{label}
    </button>
  );
}
