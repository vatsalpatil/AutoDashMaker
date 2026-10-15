import { useEffect } from 'react';
import { Loader2, Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechInput } from './useSpeechInput';

const BARS = [0.55, 0.85, 1, 0.75, 0.5];   // relative bar heights, so the meter looks like a voice, not a block
const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/**
 * Mic button for any AI chat box. Click and speak: the words appear in the box as you talk, a live level meter and
 * timer show it is listening, pauses are fine; click stop when done (it also stops by itself after 30 s of silence).
 * Same size/look as the attach-image button so it sits next to it. Errors show as a small note above the button.
 */
export function MicButton({ value, onChange, disabled, className }: {
  value: string; onChange: (text: string) => void; disabled?: boolean; className?: string;
}) {
  const s = useSpeechInput(value, onChange);
  useEffect(() => { if (!s.error) return; const t = setTimeout(s.clearError, 6000); return () => clearTimeout(t); }, [s.error]);  // eslint-disable-line react-hooks/exhaustive-deps
  const label = s.transcribing ? 'Finishing the transcript…' : s.listening ? 'Stop voice typing' : s.supported ? 'Voice typing: speak your message' : 'Voice typing (not available in this browser)';
  return (
    <span className="relative inline-flex shrink-0 items-center gap-2">
      {s.listening && (
        <span className="flex items-center gap-2 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium tabular-nums text-destructive" aria-live="polite">
          <span className="flex h-4 items-center gap-0.5" aria-hidden>
            {BARS.map((h, i) => (
              <span key={i} className="w-0.5 rounded-full bg-destructive transition-[height] duration-75"
                style={{ height: `${Math.max(15, Math.min(100, s.level * h * 140))}%` }} />
            ))}
          </span>
          <span aria-label="Recording time">{clock(s.elapsed)}</span>
        </span>
      )}
      <button type="button" onClick={s.toggle} disabled={disabled || s.transcribing} aria-label={label} title={label} aria-pressed={s.listening}
        className={cn('grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40',
          s.listening && 'bg-destructive text-white hover:bg-destructive/90 hover:text-white', className)}>
        {s.transcribing ? <Loader2 className="size-4 animate-spin" /> : s.listening ? <Square className="size-3.5 fill-current" /> : s.supported ? <Mic className="size-4" /> : <MicOff className="size-4" />}
      </button>
      {s.error && (
        <span role="status" className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">{s.error}</span>
      )}
    </span>
  );
}
