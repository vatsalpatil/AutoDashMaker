import { useEffect } from 'react';
import { Loader2, Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechInput } from './useSpeechInput';

/**
 * Mic button for any AI chat box: click, speak, click again to stop; the words appear in the box (live in Chrome/Edge,
 * right after you stop in Brave/Firefox, where the server transcribes the recording).
 * Same size/look as the attach-image button so it sits next to it. Errors show as a small note above the button.
 */
export function MicButton({ value, onChange, disabled, className }: {
  value: string; onChange: (text: string) => void; disabled?: boolean; className?: string;
}) {
  const s = useSpeechInput(value, onChange);
  useEffect(() => { if (!s.error) return; const t = setTimeout(s.clearError, 6000); return () => clearTimeout(t); }, [s.error]);  // eslint-disable-line react-hooks/exhaustive-deps
  const label = s.transcribing ? 'Turning your voice into text…' : s.listening ? 'Stop voice typing' : s.supported ? 'Voice typing: speak your message' : 'Voice typing (not available in this browser)';
  return (
    <span className="relative inline-flex shrink-0">
      <button type="button" onClick={s.toggle} disabled={disabled || s.transcribing} aria-label={label} title={label} aria-pressed={s.listening}
        className={cn('grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40',
          s.listening && 'bg-destructive text-white hover:bg-destructive/90 hover:text-white', className)}>
        {s.transcribing ? <Loader2 className="size-4 animate-spin" /> : s.listening ? <Square className="size-3.5 fill-current" /> : s.supported ? <Mic className="size-4" /> : <MicOff className="size-4" />}
      </button>
      {s.listening && <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-destructive/40" aria-hidden />}
      {s.error && (
        <span role="status" className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">{s.error}</span>
      )}
    </span>
  );
}
