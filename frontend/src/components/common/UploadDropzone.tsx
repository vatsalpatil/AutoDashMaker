import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Drag-and-drop (or click) file picker. Reusable for any "give me a file" step. */
export function UploadDropzone({ onFile, busy = false, title, busyTitle, hint = 'Or click anywhere in this box to select a file' }: {
  onFile: (file: File) => void;
  busy?: boolean;
  title: string;
  busyTitle?: string;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => input.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition-all',
        dragging ? 'border-primary bg-primary/5' : 'border-input text-muted-foreground hover:border-primary/60 hover:bg-muted/50',
      )}
    >
      <UploadCloud className="h-8 w-8 text-primary" />
      <span className="font-semibold text-foreground">{busy ? busyTitle ?? 'Uploading…' : title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
