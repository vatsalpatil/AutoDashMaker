import { CalendarRange } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tab, TabList } from '@/components/ui/kit';

/** A preset ("24" in hours/days) or a custom inclusive date range (YYYY-MM-DD). */
export interface Range { preset: string; from?: string; to?: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const YEARS = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - i));

/** Query string for the monitor API: `hours=24` / `days=7`, or `start=…&end=…` for a custom range. */
export function rangeQuery(r: Range, param: 'hours' | 'days') {
  if (r.preset !== 'custom') return `${param}=${r.preset}`;
  return [r.from && `start=${r.from}`, r.to && `end=${r.to}`].filter(Boolean).join('&') || `${param}=30`;
}

/** Presets + Custom: from/to dates, or pick a whole month or year in one go. */
export function RangePicker({ presets, value, onChange }: {
  presets: [string, string][]; value: Range; onChange: (r: Range) => void;
}) {
  const custom = value.preset === 'custom';
  const setMonth = (m: string) => {
    if (!m) return;
    const [y, mo] = m.split('-').map(Number);
    onChange({ preset: 'custom', from: `${m}-01`, to: iso(new Date(Date.UTC(y, mo, 0))) });
  };
  const month = custom && value.from?.endsWith('-01') && value.from.slice(0, 7) === value.to?.slice(0, 7) ? value.from.slice(0, 7) : '';
  const year = custom && value.from?.endsWith('-01-01') && value.to === `${value.from.slice(0, 4)}-12-31` ? value.from.slice(0, 4) : '';
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <TabList value={value.preset} onChange={(p) => onChange(p === 'custom' ? { preset: p, from: value.from ?? iso(new Date(Date.now() - 30 * 864e5)), to: value.to ?? today() } : { preset: p })}>
        {presets.map(([v, l]) => <Tab key={v} value={v} label={l} />)}
        <Tab value="custom" label={<span className="flex items-center gap-1"><CalendarRange className="size-3.5" />Custom</span>} />
      </TabList>
      {custom && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Input type="date" aria-label="From date" className="h-8 w-36" value={value.from ?? ''} max={value.to ?? today()}
            onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} />
          <span>→</span>
          <Input type="date" aria-label="To date" className="h-8 w-36" value={value.to ?? ''} min={value.from} max={today()}
            onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} />
          <Input type="month" aria-label="Whole month" className="h-8 w-36" value={month} max={today().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
          <select aria-label="Whole year" className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" value={year}
            onChange={(e) => e.target.value && onChange({ preset: 'custom', from: `${e.target.value}-01-01`, to: `${e.target.value}-12-31` })}>
            <option value="">Year…</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
