import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, FunctionSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FormulaEditor } from './FormulaEditor';
import type { ColOpt, QbStage } from './qbModel';
import { Step, patchAt, removeAt } from './ui';

type Check = { state: 'idle' | 'busy' | 'ok' | 'error'; text: string };

/** Runs the formula on 3 rows (with the stage's joins and its other custom columns) so mistakes show up while typing. */
function useFormulaCheck(st: QbStage, index: number): Check {
  const [res, setRes] = useState<Check>({ state: 'idle', text: '' });
  const c = st.custom?.[index];
  const key = JSON.stringify([st.table, st.joins, c?.expr, st.custom?.filter((_, j) => j !== index).map((x) => [x.name, x.expr])]);
  useEffect(() => {
    if (!c?.expr.trim() || !st.table) { setRes({ state: 'idle', text: '' }); return; }
    let live = true;
    setRes({ state: 'busy', text: 'Checking…' });
    const t = setTimeout(() => {
      const stage = { table: st.table, joins: st.joins, custom: [...(st.custom ?? []).filter((_, j) => j !== index).map((x) => ({ ...x, hidden: true })), { name: '__check', expr: c.expr }], columns: ['__check'], limit: 3 };
      api.post<{ rows: Record<string, unknown>[] }>('/qb/run', { spec: { stages: [stage] }, row_limit: 3 })
        .then((r) => live && setRes({ state: 'ok', text: r.rows.map((x) => String(x.__check ?? 'NULL')).join('  ·  ') || '(no rows)' }))
        .catch((e: Error) => live && setRes({ state: 'error', text: e.message.replace(/^Binder Error: |^Parser Error: /, '').split('\n')[0].slice(0, 160) }));
    }, 500);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return res;
}

/** When a column list is picked, keep a custom column's entry in it in step with the column's name. */
function renameIn(st: QbStage, from: string, to: string): Partial<QbStage> {
  return st.columns?.length ? { columns: st.columns.map((r) => (r === from ? to : r)) } : {};
}

/** Write or repair a formula with the AI: describe it in words (or fix the current one using its error). */
function AiFormula({ st, expr, error, cols, onExpr }: { st: QbStage; expr: string; error: string; cols: ColOpt[]; onExpr: (e: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async (prompt: string, fix = false) => {
    setBusy(true); setMsg('');
    try {
      const r = await api.post<{ status: string; expr?: string; explanation?: string; detail?: string }>('/qb/ai/formula', {
        prompt, table: st.table, expr: fix ? expr : text.trim() && expr ? expr : '', error: fix ? error : '',
        columns: cols.map((c) => ({ name: c.column, kind: c.kind })),
      });
      if (r.status === 'ok' && r.expr) { onExpr(r.expr); setText(''); setMsg(r.explanation ?? ''); } else setMsg(r.detail ?? 'The AI could not help with this one.');
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        <Input value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) go(text); }}
          aria-label="Describe the formula" placeholder="Or describe it: profit as a percent of revenue, rounded" className="h-8 flex-1 text-xs" />
        <Button size="sm" variant="outline" label={busy ? '…' : 'Write it'} isDisabled={busy || !text.trim() || !st.table} onClick={() => go(text)} />
        {error && <Button size="sm" variant="primary" label="Fix with AI" isDisabled={busy} onClick={() => go('fix the formula', true)} />}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

function CustomCard({ st, i, cols, set }: { st: QbStage; i: number; cols: ColOpt[]; set: (p: Partial<QbStage>) => void }) {
  const cs = st.custom ?? [];
  const c = cs[i];
  const check = useFormulaCheck(st, i);
  const dup = c.name && cs.findIndex((x) => x.name === c.name) !== i;
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border bg-muted/20 p-2.5', c.hidden && 'opacity-80')}>
      <div className="flex items-center gap-1.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info/10 text-xs font-semibold text-info" title={`Custom column ${i + 1}`}>{i + 1}</span>
        <Input value={c.name} placeholder="New column name (symbols like % are fine)" aria-label="Column name" className="h-8 flex-1 font-medium"
          onChange={(e) => set({ custom: patchAt(cs, i, { name: e.target.value }), ...renameIn(st, c.name, e.target.value) })} />
        <Button size="sm" variant="ghost" aria-label={c.hidden ? 'Show in result' : 'Hide from result'} title={c.hidden ? 'Hidden from the result (still usable in filters and summaries). Click to show' : 'Shown in the result. Click to hide (helper column)'}
          icon={c.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} onClick={() => set({ custom: patchAt(cs, i, { hidden: !c.hidden }) })} />
        <Button size="sm" variant="ghost" aria-label="Duplicate" title="Duplicate" icon={<Copy className="size-3.5" />}
          onClick={() => set({ custom: [...cs.slice(0, i + 1), { ...c, name: `${c.name}_copy` }, ...cs.slice(i + 1)] })} />
        <Button size="sm" variant="ghost" aria-label="Remove custom column" title="Remove" icon={<Trash2 className="size-3.5" />} onClick={() => set({ custom: removeAt(cs, i), ...(st.columns?.length ? { columns: st.columns.filter((r) => r !== c.name) } : {}) })} />
      </div>
      {dup && <p className="text-xs text-destructive">Another custom column already uses this name.</p>}
      <FormulaEditor value={c.expr} cols={cols.filter((x) => x.column !== c.name)} onChange={(expr) => set({ custom: patchAt(cs, i, { expr }) })} />
      {st.table && <AiFormula st={st} expr={c.expr} error={check.state === 'error' ? check.text : ''} cols={cols} onExpr={(expr) => set({ custom: patchAt(cs, i, { expr }) })} />}
      {check.state !== 'idle' && (
        <p className={cn('truncate rounded-md px-2 py-1 font-mono text-xs', check.state === 'ok' ? 'bg-success/10 text-success' : check.state === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')} title={check.text}>
          {check.state === 'ok' ? `Result: ${check.text}` : check.text}
        </p>
      )}
    </div>
  );
}

export function CustomStep({ st, cols, set }: { st: QbStage; cols: ColOpt[]; set: (p: Partial<QbStage>) => void }) {
  const cs = st.custom ?? [];
  return (
    <Step icon={<FunctionSquare />} title="Custom columns" tone="info" defaultOpen={cs.length > 0}
      badge={cs.length > 0 && <span className="text-xs text-muted-foreground">{cs.length} column{cs.length === 1 ? '' : 's'}</span>}>
      {cs.map((_, i) => <CustomCard key={i} st={st} i={i} cols={cols} set={set} />)}
      <div><Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} label="Add custom column" onClick={() => { const name = `custom_${cs.length + 1}`; set({ custom: [...cs, { name, expr: '' }], ...(st.columns?.length ? { columns: [...st.columns, name] } : {}) }); }} /></div>
    </Step>
  );
}
