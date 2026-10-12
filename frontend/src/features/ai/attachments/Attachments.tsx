import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_IMAGES, type ImageAttachments } from './useImageAttachments';

/** Paperclip-style button that opens the file picker for images. */
export function AttachImageButton({ att, disabled, className }: { att: ImageAttachments; disabled?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={disabled || att.images.length >= MAX_IMAGES}
        aria-label="Attach images" title="Attach images (or paste / drop a screenshot)"
        className={cn('grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40', className)}>
        <ImagePlus className="size-4" />
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden
        onChange={(e) => { void att.add(e.target.files); e.target.value = ''; }} />
    </>
  );
}

/** Thumbnails of the attached images, each with a remove button, plus any attach error. */
export function AttachmentTray({ att, className }: { att: ImageAttachments; className?: string }) {
  if (!att.images.length && !att.error) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {att.images.map((src, i) => (
        <div key={i} className="group relative size-14 overflow-hidden rounded-lg border bg-muted animate-in zoom-in-95 duration-200">
          <img src={src} alt={`Attachment ${i + 1}`} className="size-full object-cover" />
          <button type="button" onClick={() => att.remove(i)} aria-label={`Remove image ${i + 1}`}
            className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100">
            <X className="size-3" />
          </button>
        </div>
      ))}
      {att.error && <span className="text-xs text-destructive">{att.error}</span>}
    </div>
  );
}

/** Images shown inside a sent message bubble. */
export function MessageImages({ images, className }: { images?: string[]; className?: string }) {
  if (!images?.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {images.map((src, i) => (
        <img key={i} src={src} alt={`Attached image ${i + 1}`} className="size-20 rounded-lg border bg-muted object-cover" />
      ))}
    </div>
  );
}
