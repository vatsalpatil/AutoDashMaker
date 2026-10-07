import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Loader2, Plus, Replace, RotateCw, Sparkles, Timer, TriangleAlert } from 'lucide-react';
import { Markdown } from '@/components/common/Markdown';
import { cn } from '@/lib/utils';
import { StepCard } from './StepCard';
import type { ChatMessage, NotebookActions } from './useAgent';

const Chip = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">{children}</button>
);

/** A SQL block from an answer, with copy / add-as-cell / replace-active-cell actions. */
function SqlBlock({ code, actions }: { code: string; actions: NotebookActions }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border bg-muted/50">
      <pre className="mono max-h-56 overflow-auto whitespace-pre-wrap p-2 text-xs">{code}</pre>
      <div className="flex flex-wrap items-center gap-0.5 border-t bg-card px-1 py-0.5">
        <Chip onClick={() => actions.add(code, true)}><Plus className="size-3" /> Add as cell & run</Chip>
        <Chip onClick={() => actions.edit(code, false)}><Replace className="size-3" /> Replace active cell</Chip>
        <Chip onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copy
        </Chip>
      </div>
    </div>
  );
}

export function AgentMessage({ m, actions, elapsed, onApprove, onUndo, onRetry }: {
  m: ChatMessage; actions: NotebookActions; elapsed: number; onApprove: (n: number) => void; onUndo: (n: number) => void; onRetry?: () => void;
}) {
  const running = m.status === 'running';
  const [showSteps, setShowSteps] = useState(true);
  if (m.role === 'user') {
    return <div className="ml-6 self-end whitespace-pre-wrap rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</div>;
  }
  const hasSqlInText = /```/.test(m.text);
  const steps = m.steps.filter((s) => s.tool !== 'final');   // the final step is the answer below, not a card
  return (
    <div className="flex flex-col gap-2">
      {steps.length > 0 && (
        <div className="space-y-1.5">
          <button type="button" onClick={() => setShowSteps((o) => !o)} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            {showSteps ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />} {steps.length} step{steps.length === 1 ? '' : 's'}
          </button>
          {showSteps && steps.map((s, i) => <StepCard key={s.n} step={s} running={running && i === steps.length - 1} onApprove={() => onApprove(s.n)} onUndo={() => onUndo(s.n)} />)}
        </div>
      )}
      {running && !m.text && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin text-primary" /> Working… <Timer className="size-3" /><span className="tabular-nums">{elapsed.toFixed(1)} s</span></div>
      )}
      {m.text && (
        <div className={cn('rounded-lg rounded-bl-sm border bg-card px-3 py-2', m.status === 'error' && 'border-destructive/40 bg-destructive/5')}>
          {m.status === 'error' && <p className="mb-1 flex items-center gap-1 text-xs font-medium text-destructive"><TriangleAlert className="size-3.5" /> Something went wrong</p>}
          <Markdown text={m.text} renderCode={(code, lang) => (lang === 'sql' || /^\s*(select|with)\b/i.test(code)
            ? <SqlBlock code={code} actions={actions} /> : <pre className="mono overflow-auto rounded-md bg-muted p-2 text-xs">{code}</pre>)} />
          {m.status === 'done' && m.sql && !hasSqlInText && <div className="mt-2"><SqlBlock code={m.sql} actions={actions} /></div>}
        </div>
      )}
      {!running && m.seconds != null && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Sparkles className="size-3" /> {m.status === 'stopped' ? 'stopped after' : 'took'} {m.seconds.toFixed(1)} s
          {onRetry && <button type="button" onClick={onRetry} className="ml-2 flex items-center gap-0.5 rounded px-1 font-medium hover:bg-accent hover:text-foreground"><RotateCw className="size-3" /> Retry</button>}</p>
      )}
    </div>
  );
}
