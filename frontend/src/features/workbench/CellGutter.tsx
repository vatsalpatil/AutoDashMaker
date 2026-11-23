import { Check, FileText, Loader2, Play, X } from 'lucide-react';

/**
 * Left rail of a notebook cell: its number, a run button, and what happened on the last run
 * (not run yet · running · ✓ time · ✗ error). Replaces the cryptic Jupyter "In [ ]:".
 */
export function CellGutter({ index, kind = 'sql', running, runCount, ms, error, canRun, onRun }: {
  index: number;
  kind?: 'sql' | 'md';
  running?: boolean;
  runCount?: number | null;
  ms?: number | null;
  error?: boolean;
  canRun?: boolean;
  onRun?: () => void;
}) {
  const status = running
    ? <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" />running</span>
    : error
      ? <span className="flex items-center gap-0.5 text-destructive" title={`Run #${runCount} failed`}><X className="h-3 w-3" />error</span>
      : runCount
        ? <span className="flex items-center gap-0.5 text-success" title={`Run #${runCount}`}><Check className="h-3 w-3" />{ms != null ? `${ms} ms` : 'done'}</span>
        : <span className="text-muted-foreground/60">not run</span>;
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-border px-1 pt-2.5">
      <span className="mono text-[11px] font-medium text-muted-foreground" title={`Cell ${index + 1}`}>#{index + 1}</span>
      {kind === 'md' ? (
        <span className="rounded-full bg-muted p-1.5 text-muted-foreground" title="Text cell (Markdown): not run"><FileText className="h-3.5 w-3.5" /></span>
      ) : (
        <>
          <button type="button" onClick={onRun} disabled={running || !canRun} title="Run cell (Ctrl+Enter)" aria-label={`Run cell ${index + 1}`}
            className="rounded-full bg-primary p-1.5 text-primary-foreground hover:bg-primary/85 disabled:opacity-40">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <span className="text-[10px] leading-none">{status}</span>
        </>
      )}
    </div>
  );
}
