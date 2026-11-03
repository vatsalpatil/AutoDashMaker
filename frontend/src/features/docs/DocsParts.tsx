import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Loop } from '@/features/landing/VideoSection';

/** Terminal-style code block with a copy button. */
export function CodeBlock({ title, code }: { title?: string; code: string }) {
  const [done, setDone] = useState(false);
  const copy = () => { void navigator.clipboard?.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); };
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono">{title ?? 'terminal'}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 hover:text-foreground" aria-label="Copy code">
          {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}{done ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-5 text-foreground"><code>{code}</code></pre>
    </div>
  );
}

/** A spot on a screenshot: x/y in % of the image, plus what it is. */
export interface Pin { x: number; y: number; label: string; text: string }

/** Screenshot with numbered pointers on it and a matching legend below. */
export function AnnotatedShot({ src, alt, pins }: { src: string; alt: string; pins: Pin[] }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure className="flex flex-col gap-3">
      <div className="relative">
        <img src={src} alt={alt} loading="lazy" className="lp-shot block w-full rounded-xl border bg-card shadow-lg" />
        {pins.map((p, i) => (
          <span key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className={`absolute flex size-7 -translate-1/2 cursor-default items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg ring-4 ring-primary/30 transition-transform ${hover === i ? 'scale-125' : 'animate-pulse'}`}>
            {i + 1}
          </span>
        ))}
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {pins.map((p, i) => (
          <li key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex gap-2.5 rounded-lg border p-2.5 text-sm transition-colors ${hover === i ? 'border-primary bg-primary/5' : 'bg-card'}`}>
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
            <span><b className="text-foreground">{p.label}</b> <span className="text-muted-foreground">— {p.text}</span></span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** A looping screen recording (plays like a GIF while on screen) with a caption. */
export function Clip({ id, caption }: { id: string; caption: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-card shadow-lg">
      <Loop id={id} />
      <figcaption className="border-t p-3 text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

/** Highlighted note box. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm leading-6">
      <b className="text-foreground">{title}</b>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  );
}
