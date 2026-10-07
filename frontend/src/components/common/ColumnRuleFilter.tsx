import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/common/SelectField';

export type ColKind = 'num' | 'date' | 'text';
export interface Rule { op: string; a?: string; b?: string }

const OPS: Record<ColKind, [string, string][]> = {
  num: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', 'between'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
  date: [['on', 'on'], ['before', 'before'], ['after', 'after'], ['between', 'between'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
  text: [['contains', 'contains'], ['not_contains', 'does not contain'], ['eq', 'equals'], ['neq', 'does not equal'], ['starts', 'starts with'], ['ends', 'ends with'], ['empty', 'is empty'], ['not_empty', 'is not empty']],
};
const NO_VALUE = new Set(['empty', 'not_empty']);
export const isRule = (v: unknown): v is Rule => !!v && typeof v === 'object' && !Array.isArray(v) && 'op' in v;

/** Does a cell value pass a rule? Numbers compare numerically, dates by their ISO text, text case-insensitively. */
export function ruleMatches(value: unknown, r: Rule, kind: ColKind): boolean {
  const blank = value === null || value === undefined || value === '';
  if (r.op === 'empty') return blank;
  if (r.op === 'not_empty') return !blank;
  if (r.a === undefined || r.a === '') return true;          // rule still waiting for its value: hide nothing
  if (blank) return false;
  if (kind === 'num') {
    const n = Number(value), a = Number(r.a), b = Number(r.b);
    return ({ eq: n === a, neq: n !== a, gt: n > a, gte: n >= a, lt: n < a, lte: n <= a, between: r.b === undefined || r.b === '' ? n >= a : n >= a && n <= b } as Record<string, boolean>)[r.op] ?? true;
  }
  if (kind === 'date') {
    const d = String(value).slice(0, 10);
    return ({ on: d === r.a, before: d < r.a, after: d > r.a, between: !r.b ? d >= r.a : d >= r.a && d <= r.b } as Record<string, boolean>)[r.op] ?? true;
  }
  const s = String(value).toLowerCase(), a = r.a.toLowerCase();
  return ({ contains: s.includes(a), not_contains: !s.includes(a), eq: s === a, neq: s !== a, starts: s.startsWith(a), ends: s.endsWith(a) } as Record<string, boolean>)[r.op] ?? true;
}

export const summary = (r: Rule, kind: ColKind) => {
  const label = OPS[kind].find(([v]) => v === r.op)?.[1] ?? r.op;
  return NO_VALUE.has(r.op) ? label : `${label} ${r.a ?? ''}${r.op === 'between' && r.b ? ` – ${r.b}` : ''}`;
};

type FilterCol = { getFilterValue: () => unknown; setFilterValue: (v: unknown) => void };

/** Operator + value editor for one column, typed by the column kind (number / date / text). Applies as you type. */
export function RuleEditor({ column, kind }: { column: FilterCol; kind: ColKind }) {
  const raw = column.getFilterValue();
  const rule: Rule | undefined = isRule(raw) ? raw : undefined;
  const set = (p: Partial<Rule>) => {
    const next = { ...(rule ?? { op: OPS[kind][0][0] }), ...p };
    column.setFilterValue(NO_VALUE.has(next.op) || next.a ? next : p.op && !NO_VALUE.has(p.op) ? next : undefined);
  };
  const inputType = kind === 'num' ? 'number' : kind === 'date' ? 'date' : 'text';
  const op = rule?.op ?? OPS[kind][0][0];
  return (
    <div className="flex flex-col gap-2">
      <SelectField value={op} aria-label="Operator" onChange={(e) => set({ op: e.target.value })}>
        {OPS[kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </SelectField>
      {!NO_VALUE.has(op) && <Input type={inputType} value={rule?.a ?? ''} placeholder="value" className="h-8" onChange={(e) => set({ a: e.target.value })} />}
      {op === 'between' && <Input type={inputType} value={rule?.b ?? ''} placeholder="and" className="h-8" onChange={(e) => set({ b: e.target.value })} />}
    </div>
  );
}
