import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { FunnelIcon } from './FunnelIcon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { RuleEditor, isRule, summary, type ColKind } from './ColumnRuleFilter';

export interface FilterValue { value: string; count: number }
type Col = {
  getFilterValue: () => unknown; setFilterValue: (v: unknown) => void;
  getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void; clearSorting: () => void;
};
const MAX_SHOWN = 10000;   // every distinct value of the loaded rows
const KIND_WORD = { num: 'Number', date: 'Date', text: 'Text' } as const;

/**
 * Excel-style column filter: sort A→Z / Z→A, search, (Select all), a checkbox per distinct value with its row count, OK / Cancel,
 * and "Number / Date / Text filters…" for operator rules (greater than, between, contains …).
 */
export function ColumnFilter({ column, title, kind, values }: { column: Col; title: string; kind: ColKind; values: FilterValue[] }) {
  const raw = column.getFilterValue();
  const applied = Array.isArray(raw) ? new Set(raw as string[]) : null;
  const rule = isRule(raw) ? raw : undefined;
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const start = (o: boolean) => {
    setOpen(o);
    if (o) { setDraft(applied ? new Set(applied) : new Set(values.map((v) => v.value))); setQ(''); setCustom(isRule(column.getFilterValue())); }
  };
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return values.filter((v) => !needle || (v.value || '(blanks)').toLowerCase().includes(needle));
  }, [values, q]);
  const allShown = shown.length > 0 && shown.every((v) => draft.has(v.value));
  const someShown = shown.some((v) => draft.has(v.value));
  const toggle = (v: string) => setDraft((d) => { const n = new Set(d); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const toggleAll = () => setDraft((d) => { const n = new Set(d); shown.forEach((v) => (allShown ? n.delete(v.value) : n.add(v.value))); return n; });
  const ok = () => { column.setFilterValue(draft.size === values.length ? undefined : [...draft]); setOpen(false); };
  const active = !!applied || !!rule;
  const sorted = column.getIsSorted();
  const tip = rule ? `${title}: ${summary(rule, kind)}` : applied ? `${title}: ${applied.size} of ${values.length} values` : `Filter ${title}`;
  const menuItem = (on: boolean) => cn('flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent', on && 'text-primary');

  return (
    <Popover open={open} onOpenChange={start}>
      <PopoverTrigger render={
        <Button variant="ghost" size="icon-sm" aria-label={`Filter ${title}`} title={tip}
          className={cn('size-6 shrink-0', active ? 'bg-primary/15 text-primary' : 'text-muted-foreground')}><FunnelIcon className="size-4" /></Button>
      } />
      <PopoverContent className="w-72 gap-0 p-0" align="start">
        {custom ? (
          <div className="flex flex-col gap-2 p-3">
            <button type="button" className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setCustom(false)}><ChevronLeft className="size-3.5" />Back to values</button>
            <p className="text-xs font-medium text-muted-foreground">{KIND_WORD[kind]} filter · {title}</p>
            <RuleEditor column={column} kind={kind} />
            <div className="flex justify-between pt-1">
              <Button size="sm" variant="ghost" onClick={() => column.setFilterValue(undefined)}>Clear</Button>
              <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col border-b p-1">
              <button type="button" onClick={() => (sorted === 'asc' ? column.clearSorting() : column.toggleSorting(false))} className={menuItem(sorted === 'asc')}><ArrowDownAZ className="size-4" />Sort {kind === 'text' ? 'A to Z' : 'smallest to largest'}</button>
              <button type="button" onClick={() => (sorted === 'desc' ? column.clearSorting() : column.toggleSorting(true))} className={menuItem(sorted === 'desc')}><ArrowUpZA className="size-4" />Sort {kind === 'text' ? 'Z to A' : 'largest to smallest'}</button>
              <button type="button" onClick={() => setCustom(true)} className={menuItem(!!rule)}><SlidersHorizontal className="size-4" />{KIND_WORD[kind]} filters…{rule && <span className="ml-auto truncate text-xs">{summary(rule, kind)}</span>}</button>
            </div>
            <div className="p-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search values" className="h-8" /></div>
            <div className="max-h-60 overflow-y-auto px-1 pb-1">
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <Checkbox checked={allShown} indeterminate={!allShown && someShown} onCheckedChange={toggleAll} />
                <span className="font-medium">(Select all{q ? ' search results' : ''})</span>
              </label>
              {shown.slice(0, MAX_SHOWN).map((v) => (
                <label key={v.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                  <Checkbox checked={draft.has(v.value)} onCheckedChange={() => toggle(v.value)} />
                  <span className={cn('min-w-0 flex-1 truncate', !v.value && 'italic text-muted-foreground')} title={v.value}>{v.value || '(Blanks)'}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{v.count.toLocaleString()}</span>
                </label>
              ))}
              {shown.length === 0 && <p className="px-2 py-4 text-center text-sm text-muted-foreground">No matching values</p>}
              {shown.length > MAX_SHOWN && <p className="px-2 py-1 text-xs text-muted-foreground">Showing {MAX_SHOWN} of {shown.length.toLocaleString()} — search to narrow down</p>}
            </div>
            <div className="flex items-center justify-between border-t p-2">
              <Button size="sm" variant="ghost" disabled={!active} onClick={() => { column.setFilterValue(undefined); setOpen(false); }}>Clear filter</Button>
              <span className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" disabled={draft.size === 0} onClick={ok}>OK</Button>
              </span>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
