import { useState } from 'react';
import { Check, Copy, Info, Loader2, TriangleAlert, X } from 'lucide-react';
import { Markdown } from '@/components/common/Markdown';
import { cn } from '@/lib/utils';

export interface Check { level: 'info' | 'warn'; title: string; detail: string; fix?: string }
export type Panel =
  | { kind: 'explain'; text: string; checks: Check[]; pending?: boolean; error?: string }
  | { kind: 'optimize'; sql: string; original: string; notes: string[]; changed: boolean; checks: Check[]; pending?: boolean; error?: string }
  | { kind: 'convert'; sql: string; dialect: string }
  | { kind: 'info'; text: string };

const iconBtn = 'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground';

function Checks({ checks, empty }: { checks: Check[]; empty?: string }) {
  if (checks.length === 0) return empty ? <p className="flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" /> {empty}</p> : null;
  return (
    <ul className="space-y-1.5">
      {checks.map((c, i) => (
        <li key={i} className="flex gap-2 text-xs">
          {c.level === 'warn' ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> : <Info className="mt-0.5 size-3.5 shrink-0 text-info" />}
          <span><span className="font-semibold">{c.title}.</span> <span className="text-muted-foreground">{c.detail}</span>
            {c.fix && <code className="mono mt-0.5 block rounded bg-background px-1.5 py-0.5 text-[11px]">{c.fix}</code>}</span>
        </li>
      ))}
    </ul>
  );
}

const Pending = ({ what }: { what: string }) => <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin text-primary" /> {what}</p>;
const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;

/** Result area under a cell: rule-based checks appear instantly, the AI's reply fills in when it arrives. */
export function AssistPanel({ panel, onApply, onClose }: { panel: Panel; onApply: (sql: string) => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = (t: string) => { navigator.clipboard?.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const sql = 'sql' in panel ? panel.sql : null;
  return (
    <div className="relative mx-3 mb-2 space-y-2 rounded-md border border-border bg-muted/40 p-3 pr-16 text-sm">
      <div className="absolute right-1.5 top-1.5 flex">
        {sql && <button type="button" className={iconBtn} onClick={() => copy(sql)} title="Copy">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>}
        <button type="button" className={iconBtn} onClick={onClose} aria-label="Close"><X className="size-3.5" /></button>
      </div>

      {panel.kind === 'info' && <Markdown text={panel.text} />}

      {panel.kind === 'explain' && (
        <>
          {panel.pending ? <Pending what="Explaining in plain words…" /> : panel.error ? <p className="text-xs text-destructive">{panel.error}</p> : <Markdown text={panel.text} />}
          {panel.checks.length > 0 && <div><Label>Things to watch</Label><Checks checks={panel.checks} /></div>}
        </>
      )}

      {panel.kind === 'optimize' && (
        <>
          <div><Label>Checks</Label><Checks checks={panel.checks} empty="No problems found by the rule-based checks." /></div>
          {panel.pending ? <Pending what="Asking the AI for a faster version…" /> : panel.error ? <p className="text-xs text-destructive">AI suggestion unavailable: {panel.error}</p> : (
            <div className="space-y-1.5">
              <Label>AI suggestion</Label>
              {panel.notes.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs">{panel.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
              {!panel.changed && <p className="text-xs text-success">The query already looks efficient: no rewrite suggested.</p>}
              {panel.changed && (
                <>
                  <div className="grid gap-2 lg:grid-cols-2">
                    <div><p className="mb-0.5 text-[11px] text-muted-foreground">Before</p><pre className="mono max-h-52 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-xs">{panel.original}</pre></div>
                    <div><p className="mb-0.5 text-[11px] text-success">After</p><pre className={cn('mono max-h-52 overflow-auto whitespace-pre-wrap rounded border border-success/40 bg-background p-2 text-xs')}>{panel.sql}</pre></div>
                  </div>
                  <button type="button" className="rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90" onClick={() => { onApply(panel.sql); onClose(); }}>Apply to cell</button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {panel.kind === 'convert' && (
        <>
          <Label>{panel.dialect}</Label>
          <pre className="mono max-h-56 overflow-auto whitespace-pre-wrap text-xs">{panel.sql}</pre>
          <button type="button" className="rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90" onClick={() => { onApply(panel.sql); onClose(); }}>Replace the cell with this</button>
        </>
      )}
    </div>
  );
}
