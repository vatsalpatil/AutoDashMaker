import type { Layout } from 'react-grid-layout';
import { Columns2, Columns3, Rows3, Shuffle, Sparkles, Star } from 'lucide-react';
import type { Widget } from '@/lib/types';

/** One-click layouts for edit mode: KPIs always lead in one row, the charts below follow the chosen structure. Heights are kept. */
type Kind = (w: Widget) => string | undefined;
type Rows = string[][];

const chunk = (ids: string[], n: number): Rows => Array.from({ length: Math.ceil(ids.length / n) }, (_, i) => ids.slice(i * n, i * n + n));
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((p, q) => p[0] - q[0]).map(([, v]) => v);

const PRESETS: Record<string, { label: string; icon: React.ReactNode; rows: (charts: Widget[], kind: Kind) => Rows }> = {
  smart: {
    label: 'Smart', icon: <Sparkles className="size-3.5" />,
    // trends (line/area) get a full-width row, everything else pairs up
    rows: (cs, kind) => {
      const wide = cs.filter((w) => ['line', 'area'].includes(kind(w) ?? '')).map((w) => w.id);
      return [...chunk(cs.filter((w) => !wide.includes(w.id)).map((w) => w.id), 2), ...wide.map((id) => [id])];
    },
  },
  grid2: { label: '2 columns', icon: <Columns2 className="size-3.5" />, rows: (cs) => chunk(cs.map((w) => w.id), 2) },
  grid3: { label: '3 columns', icon: <Columns3 className="size-3.5" />, rows: (cs) => chunk(cs.map((w) => w.id), 3) },
  stack: { label: 'Stacked', icon: <Rows3 className="size-3.5" />, rows: (cs) => chunk(cs.map((w) => w.id), 1) },
  focus: { label: 'Focus', icon: <Star className="size-3.5" />, rows: (cs) => (cs.length ? [[cs[0].id], ...chunk(cs.slice(1).map((w) => w.id), 3)] : []) },
  shuffle: { label: 'Shuffle', icon: <Shuffle className="size-3.5" />, rows: (cs) => chunk(shuffle(cs).map((w) => w.id), 2 + Math.round(Math.random())) },
};

export function autoLayout(preset: string, widgets: Widget[], kind: Kind, gx: number, gy: number): Layout[] {
  const order = [...widgets].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const kpis = order.filter((w) => kind(w) === 'kpi').map((w) => w.id);
  const rows = [...chunk(kpis, 6), ...PRESETS[preset].rows(order.filter((w) => kind(w) !== 'kpi'), kind)];
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const out: Layout[] = [];
  let y = 0;
  for (const r of rows) {
    const width = Math.floor((12 * gx) / r.length);   // in fine grid columns, so 5 KPIs never overlap
    const h = Math.max(...r.map((id) => byId.get(id)!.position.h));
    r.forEach((id, k) => out.push({ i: id, x: k * width, y: Math.round(y * gy), w: width, h: Math.round(h * gy) }));
    y += h;
  }
  return out;
}

export function AutoLayoutBar({ onPick }: { onPick: (preset: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {Object.entries(PRESETS).map(([k, p]) => (
        <button key={k} type="button" onClick={() => onPick(k)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 hover:border-primary hover:text-primary">
          {p.icon}{p.label}
        </button>
      ))}
    </div>
  );
}
