import { Layer, Rectangle, Sankey, Tooltip } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import type { ChartSpec, QueryResult } from '@/lib/types';
import { formatValue, opt, toNumber, type Opts } from '../format';
import { paletteColors } from '../palettes';

/** Drops links that would close a loop (a Sankey cannot draw circular flows). */
function acyclic(links: { source: number; target: number; value: number }[]) {
  const out: typeof links = [];
  const reaches = (from: number, to: number): boolean => from === to || out.some((l) => l.source === from && reaches(l.target, to));
  for (const l of links) if (!reaches(l.target, l.source)) out.push(l);
  return out;
}

/** Sankey: flow from a source column to a target column sized by a count (Metabase's Sankey chart). */
export function SankeyView({ spec, result, o, height }: { spec: ChartSpec; result: QueryResult; o: Opts; height: number }) {
  const { x, y, color } = spec.encoding;
  if (!x || !color || !y) return <p className="p-6 text-center text-sm text-muted-foreground">Pick a source, a target and a count column.</p>;
  const names: string[] = [];
  const idx = (n: string) => { let i = names.indexOf(n); if (i < 0) { names.push(n); i = names.length - 1; } return i; };
  const merged = new Map<string, number>();
  for (const r of result.rows) {
    const k = `${idx(String(r[x] ?? ''))}\u0001${idx(String(r[color] ?? ''))}`;
    merged.set(k, (merged.get(k) ?? 0) + toNumber(r[y]));
  }
  const all = [...merged].map(([k, value]) => { const [s, t] = k.split('\u0001').map(Number); return { source: s, target: t, value }; }).filter((l) => l.value > 0 && l.source !== l.target);
  const links = acyclic(all);
  if (links.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">No flows to draw.</p>;
  const palette = paletteColors(o.palette);
  const edge = opt.str(o.edgeColor, 'gray');
  const fmt = { numberFormat: opt.str(o.edgeLabels, 'compact') === 'full' ? 'decimal' : 'compact' };
  const Link = (p: { sourceX: number; targetX: number; sourceY: number; targetY: number; sourceControlX: number; targetControlX: number; linkWidth: number; index: number; payload: { source: { index: number }; target: { index: number }; value: number } }) => {
    const stroke = edge === 'source' ? palette[p.payload.source.index % palette.length] : edge === 'target' ? palette[p.payload.target.index % palette.length] : 'var(--muted-foreground)';
    return (
      <path d={`M${p.sourceX},${p.sourceY} C${p.sourceControlX},${p.sourceY} ${p.targetControlX},${p.targetY} ${p.targetX},${p.targetY}`} fill="none" stroke={stroke} strokeOpacity={0.3} strokeWidth={Math.max(p.linkWidth, 1)} />
    );
  };
  const Node = (p: { x: number; y: number; width: number; height: number; index: number; payload: { name: string; value: number } }) => (
    <Layer>
      <Rectangle x={p.x} y={p.y} width={p.width} height={p.height} fill={palette[p.index % palette.length]} fillOpacity={0.95} />
      {p.height > 12 && <text x={p.x + p.width + 6} y={p.y + p.height / 2 + 4} fontSize={11} fill="var(--foreground)">{p.payload.name}{o.showDataLabels === true ? ` · ${formatValue(p.payload.value, fmt)}` : ''}</text>}
    </Layer>
  );
  return (
    <ChartContainer config={{}} className="aspect-auto w-full" style={{ height }}>
      <Sankey data={{ nodes: names.map((name) => ({ name })), links }} nodePadding={opt.num(o.nodePadding, 18)} nodeWidth={10} margin={{ top: 8, right: 110, bottom: 8, left: 8 }} link={Link as never} node={Node as never}>
        {o.showTooltip !== false && <Tooltip formatter={(v) => formatValue(v, fmt)} />}
      </Sankey>
    </ChartContainer>
  );
}
