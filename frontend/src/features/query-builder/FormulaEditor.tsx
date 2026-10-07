import { useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPR_CATEGORIES, EXPR_EXAMPLES, FUNCTION_LIST } from './exprCatalog';
import type { ColOpt } from './qbModel';

const KINDS = { num: '123', text: 'Abc', time: 'date', bool: 'T/F' } as const;
const quote = (c: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(c) ? c : `"${c.replace(/"/g, '""')}"`);
const WORD = /[A-Za-z_][A-Za-z0-9_]*$/;

interface Suggestion { key: string; label: string; detail: string; kind: 'column' | 'function'; insert: string; caret?: number }

/**
 * Formula box with (1) autocomplete while typing — column names and functions, ↑/↓ + Enter/Tab to accept, Esc to close,
 * Ctrl+Space to open the list — and (2) a tabbed click-to-insert palette (columns, math, logic, text, date, convert).
 */
export function FormulaEditor({ value, onChange, cols }: { value: string; onChange: (v: string) => void; cols: ColOpt[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState('columns');
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);

  const word = WORD.exec(value.slice(0, caret))?.[0] ?? '';
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!open) return [];
    const w = word.toLowerCase();
    if (!w && !open) return [];
    const score = (name: string) => { const n = name.toLowerCase(); return n.startsWith(w) ? 0 : w.length >= 2 && n.includes(w) ? 1 : -1; };
    const colHits = cols.map((c) => ({ c, s: score(c.column) })).filter((x) => x.s >= 0)
      .map(({ c, s }): Suggestion & { s: number } => ({ s, key: `c:${c.key}`, label: c.column, detail: KINDS[c.kind], kind: 'column', insert: quote(c.column) }));
    const fnHits = FUNCTION_LIST.map((f) => ({ f, s: score(f.name) })).filter((x) => x.s >= 0)
      .map(({ f, s }): Suggestion & { s: number } => ({ s, key: `f:${f.sig}`, label: f.name, detail: `${f.sig} · ${f.group}`, kind: 'function', insert: f.sig.includes('(') ? `${f.name}()` : f.name, caret: f.sig.includes('()') || !f.sig.includes('(') ? undefined : -1 }));
    return [...colHits, ...fnHits].sort((a, b) => a.s - b.s).slice(0, 9);
  }, [open, word, cols]);

  const apply = (text: string, from: number, to: number, caretBack = 0) => {
    onChange(value.slice(0, from) + text + value.slice(to));
    const at = from + text.length + caretBack;
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(at, at); setCaret(at); });
  };
  const accept = (s: Suggestion) => { apply(s.insert, caret - word.length, caret, s.caret === -1 ? -1 : 0); setOpen(false); };
  const insert = (template: string) => {
    const el = ref.current;
    const [a, b] = el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
    const picked = value.slice(a, b);
    apply(template.includes('{}') ? template.replace('{}', picked || 'value') : template, a, b);
  };
  const track = (el: HTMLTextAreaElement) => setCaret(el.selectionStart);
  const tabs = [{ id: 'columns', label: 'Columns' }, ...EXPR_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];
  const cat = EXPR_CATEGORIES.find((c) => c.id === tab);
  const showList = open && suggestions.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea ref={ref} value={value} rows={2} spellCheck={false} aria-label="Formula" aria-autocomplete="list" aria-expanded={showList}
          placeholder="Type a formula — column names and functions are suggested as you type"
          onChange={(e) => { onChange(e.target.value); track(e.target); setActive(0); setOpen(!!WORD.exec(e.target.value.slice(0, e.target.selectionStart))); }}
          onKeyUp={(e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) track(e.currentTarget); }}
          onClick={(e) => { track(e.currentTarget); setOpen(false); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === ' ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setOpen(true); setActive(0); return; }
            if (!showList) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(suggestions[active] ?? suggestions[0]); }
            else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
          }}
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        {showList && (
          <ul role="listbox" className="absolute left-2 right-2 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg">
            {suggestions.map((s, i) => (
              <li key={s.key} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); accept(s); }} onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1', i === active && 'bg-accent')}>
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold', s.kind === 'column' ? 'bg-info/15 text-info' : 'bg-primary/15 text-primary')}>{s.kind === 'column' ? 'C' : 'ƒ'}</span>
                <span className="font-mono">{s.label}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{s.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!value && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">Examples:
          {EXPR_EXAMPLES.map((x) => <button key={x} type="button" onClick={() => onChange(x)} className="rounded-md border bg-card px-1.5 py-0.5 font-mono hover:bg-accent">{x}</button>)}
        </div>
      )}
      <div className="flex flex-wrap gap-1 border-b pb-1.5" role="tablist" aria-label="Insert">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setExpanded(true); }}
            className={cn('rounded-md px-2 py-1 text-xs font-medium', tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>{t.label}</button>
        ))}
        <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? 'Collapse' : 'Expand'} title={expanded ? 'Collapse' : 'Expand'}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          <ChevronDown className={cn('size-3.5 transition-transform', !expanded && '-rotate-90')} />
        </button>
      </div>
      {expanded && <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {tab === 'columns' ? (cols.length ? cols.map((c) => (
          <button key={c.key} type="button" onClick={() => insert(quote(c.column))} title={`Insert ${c.label}`}
            className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-accent">
            <span className="text-[10px] text-muted-foreground">{KINDS[c.kind]}</span>{c.label}
          </button>
        )) : <p className="text-xs text-muted-foreground">Pick a table first to see its columns.</p>)
          : cat?.snippets.map((s) => (
            <button key={s.label} type="button" onClick={() => insert(s.template)} title={`${s.template}${s.hint ? ` — ${s.hint}` : ''}`}
              className="rounded-md border bg-card px-2 py-1 text-xs hover:bg-accent">{s.label}</button>
          ))}
      </div>}
    </div>
  );
}
