import { useEffect, useRef } from 'react';

/** What the model is doing right now: its reasoning as it streams in, then a live tail of the answer it is writing. */
export function LiveThinking({ reasoning, answer, label }: { reasoning: string; answer: string; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [reasoning]);
  const writing = answer.length > 0;
  return (
    <div className="mt-2 rounded-md border bg-muted/40 p-2 text-xs animate-in fade-in duration-300" aria-live="off">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-primary">
        <span className="relative flex size-2"><span className="gen-ring absolute inset-0 rounded-full bg-primary/60" /><span className="relative size-2 rounded-full bg-primary" /></span>
        {label && <span className="text-foreground">{label} ·</span>}
        {writing ? 'Writing' : 'Thinking'}
        {writing && <span className="font-normal text-muted-foreground">{answer.length.toLocaleString()} characters</span>}
      </div>
      {(reasoning || !writing) && (
        <div ref={box} className="max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words italic leading-relaxed text-muted-foreground">{reasoning || 'Waiting for the model…'}</div>
      )}
      {writing && <pre className="mono mt-1.5 max-h-16 overflow-hidden whitespace-pre-wrap break-all text-[11px] text-foreground/80">{answer.slice(-220)}<span className="animate-pulse">▍</span></pre>}
    </div>
  );
}
