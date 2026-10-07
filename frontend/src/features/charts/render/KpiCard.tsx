import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMeasure } from '@/hooks/useMeasure';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { exactValue, formatValue, opt, toNumber, type Opts } from '../format';

const ALIGN = { left: 'items-start text-left', right: 'items-end text-right', center: 'items-center text-center' } as const;

/** "<50:#dc2626; >=50:#16a34a" -> the colour of the first rule the value satisfies (Metabase's conditional colours for numbers). */
export function ruleColor(v: number, rules: string): string | undefined {
  for (const r of rules.split(';')) {
    const m = r.trim().match(/^(<=|>=|<|>|=)\s*(-?[\d.]+)\s*:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)$/);
    if (!m) continue;
    const n = Number(m[2]);
    if ((m[1] === '<' && v < n) || (m[1] === '<=' && v <= n) || (m[1] === '>' && v > n) || (m[1] === '>=' && v >= n) || (m[1] === '=' && v === n)) return m[3];
  }
  return undefined;
}

/** Big-number card with optional change-vs-previous-row badge and a sparkline over the rows. */
export function KpiCard({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const { x, y } = spec.encoding;
  const [boxRef, box] = useMeasure();
  const rows = result.rows;
  const last = rows[rows.length - 1];
  const value = last ? (last[y] ?? last[x]) : null;
  const prev = rows.length > 1 ? toNumber(rows[rows.length - 2][y]) : null;
  const delta = prev !== null && prev !== 0 ? (toNumber(value) - prev) / Math.abs(prev) : null;
  const good = delta === null ? true : (delta >= 0) === (opt.str(o.deltaGood, 'up') === 'up');
  const align = ALIGN[opt.str(o.kpiAlign, 'center') as keyof typeof ALIGN] ?? ALIGN.center;
  const color = ruleColor(toNumber(value), opt.str(o.valueRules, '')) ?? (typeof o.valueColor === 'string' && o.valueColor ? o.valueColor : undefined);
  const spark = o.showSparkline === true && rows.length > 2;
  // optional percentage: value as a share of another column of the result, or of a fixed target
  const second = opt.str(o.percentColumn, '') || result.columns.find((c) => c !== y && c !== x && last && Number.isFinite(Number(last[c])));
  const base = o.percentOf === 'column' ? toNumber(last?.[second ?? '']) : o.percentOf === 'fixed' ? opt.num(o.percentBase, 0) : 0;
  const pct = (o.percentOf === 'column' || o.percentOf === 'fixed') && base ? (toNumber(value) / base) * 100 : null;
  const pctText = pct === null ? '' : `${pct.toFixed(opt.num(o.percentDecimals, 1))}%`;
  const pctLabel = opt.str(o.percentLabel, o.percentOf === 'column' ? `of ${second}` : 'of target');
  const exact = exactValue(value, o);
  const shown = o.percentMain === true && pct !== null ? pctText : formatValue(value, o);
  // shrink the number to fit its card (about 0.6em per character), never above the chosen size
  const wanted = opt.num(o.valueFontSize, 48);
  const fontSize = box.w > 0 ? Math.max(14, Math.min(wanted, (box.w - 48) / Math.max(shown.length * 0.62, 1))) : wanted;

  return (
    <div ref={boxRef} className={`relative flex h-full flex-col justify-center gap-1 overflow-hidden p-6 ${align}`} style={{ minHeight: height }}>
      {o.showLabel !== false && <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{String(o.chartTitle || y || x)}</div>}
      <Tooltip>
        <TooltipTrigger render={<div className={`cursor-default font-semibold tabular-nums leading-tight ${color ? '' : 'text-foreground'}`} style={{ fontSize, color }} />}>
          {shown}
        </TooltipTrigger>
        <TooltipContent className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium">Exact value: {exact}</span>
          {pct !== null && <span>{pct.toFixed(opt.num(o.percentDecimals, 1))}% {pctLabel}{o.percentOf === 'fixed' || base ? ` (${exactValue(base, o)})` : ''}</span>}
          {delta !== null && <span>{delta >= 0 ? '+' : '−'}{Math.abs(delta * 100).toFixed(2)}% vs previous row</span>}
        </TooltipContent>
      </Tooltip>
      {pct !== null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {o.percentMain === true ? `${formatValue(value, o)} ${pctLabel.replace(/^of /, 'of ')}` : `${pctText} ${pctLabel}`}
        </span>
      )}
      {o.showDelta === true && delta !== null && (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${good ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
          {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(delta * 100).toFixed(1)}% vs previous
        </span>
      )}
      {spark && (
        <ChartContainer config={{ v: { color: color ?? 'var(--primary)' } }} className="pointer-events-none absolute inset-x-0 bottom-0 aspect-auto h-1/3 opacity-60">
          <AreaChart data={rows.map((r) => ({ v: toNumber(r[y]) }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
            <Area dataKey="v" type="monotone" stroke="var(--color-v)" fill="var(--color-v)" fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
