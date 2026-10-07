import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Columns3, Eye, List, Loader2, Pencil, Play, Plus, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step } from './useAgent';

const ICON: Record<string, typeof Play> = { list_tables: List, describe_table: Columns3, sample_rows: Eye, run_sql: Play, add_cell: Plus, edit_cell: Pencil };
const TITLE: Record<string, string> = {
  list_tables: 'Listed tables', describe_table: 'Looked at columns', sample_rows: 'Sampled rows', run_sql: 'Ran a query', add_cell: 'Add a notebook cell', edit_cell: 'Edit the active cell',
};
const arg = (s: Step) => String(s.args.sql ?? s.args.table ?? '');

function Preview({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="max-h-40 overflow-auto rounded border">
      <table className="min-w-full text-[11px]">
        <thead className="sticky top-0 bg-muted"><tr>{columns.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1 text-left font-semibold">{c}</th>)}</tr></thead>
        <tbody className="divide-y">
          {rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c} className="mono whitespace-nowrap px-2 py-0.5">{r[c] === null ? <span className="text-muted-foreground">NULL</span> : String(r[c])}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** One tool call of the agent: what it was for, the query / table it used, and what came back. */
export function StepCard({ step, running, onApprove, onUndo }: { step: Step; running: boolean; onApprove?: () => void; onUndo?: () => void }) {
  const [open, setOpen] = useState(false);
  const Icon = ICON[step.tool] ?? Play;
  const waiting = running && !step.obs;
  const failed = step.obs && !step.obs.ok;
  const p = step.proposal;
  return (
    <div className={cn('rounded-md border bg-card text-xs', failed && 'border-destructive/40')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left" aria-expanded={open}>
        {waiting ? <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" /> : failed ? <TriangleAlert className="size-3.5 shrink-0 text-destructive" />
          : <Icon className="size-3.5 shrink-0 text-primary" />}
        <span className="font-medium">{TITLE[step.tool] ?? step.tool}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{step.thought || arg(step)}</span>
        {step.obs?.row_count != null && <span className="shrink-0 text-muted-foreground">{step.obs.row_count} rows{step.obs.ms != null ? ` · ${Math.round(step.obs.ms)} ms` : ''}</span>}
        {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
      </button>
      {open && (
        <div className="space-y-1.5 border-t p-2">
          {step.thought && <p className="text-muted-foreground">{step.thought}</p>}
          {arg(step) && <pre className="mono max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5">{arg(step)}</pre>}
          {step.obs?.columns && step.obs.rows ? <Preview columns={step.obs.columns} rows={step.obs.rows} />
            : step.obs && <p className={cn('whitespace-pre-wrap', failed && 'text-destructive')}>{step.obs.text}</p>}
        </div>
      )}
      {p && (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-2 py-1.5">
          {p.undone ? <span className="text-muted-foreground">Edit undone</span>
            : p.applied ? <span className="flex items-center gap-1 text-success"><Check className="size-3.5" /> {p.kind === 'add_cell' ? 'Added to the notebook' : 'Applied to the active cell'}
              {p.before && <button type="button" onClick={onUndo} className="ml-1 rounded px-1 font-medium text-muted-foreground underline hover:text-foreground">Undo</button>}</span>
            : <button type="button" onClick={onApprove} className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground hover:opacity-90">
              {p.kind === 'add_cell' ? 'Add cell' : 'Apply to cell'}{p.run ? ' & run' : ''}
            </button>}
          <pre className="mono min-w-0 flex-1 truncate">{p.sql.replace(/\s+/g, ' ')}</pre>
        </div>
      )}
    </div>
  );
}
