/** Scrolling gallery of tiny drawn charts (pure SVG in theme colours) under the hero. */
const C = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const BARS = [38, 62, 48, 80, 56, 92];
const LINE = 'M4 52 L22 40 L40 46 L58 24 L76 30 L94 12 L116 18';

const MINI: { name: string; svg: React.ReactNode }[] = [
  { name: 'Bar', svg: BARS.map((h, i) => <rect key={i} className="lp-grow" x={6 + i * 19} y={64 - h * 0.6} width="13" height={h * 0.6} rx="2" fill={C[0]} style={{ '--d': `${i * 0.08}s` } as React.CSSProperties} />) },
  { name: 'Line', svg: <path className="lp-draw" d={LINE} fill="none" stroke={C[1]} strokeWidth="3" strokeLinecap="round" /> },
  { name: 'Area', svg: <><path d={`${LINE} L116 64 L4 64 Z`} fill={C[0]} opacity=".3" /><path className="lp-draw" d={LINE} fill="none" stroke={C[0]} strokeWidth="2.5" /></> },
  { name: 'Donut', svg: [0, 1, 2, 3].map((i) => <circle key={i} cx="60" cy="34" r="24" fill="none" stroke={C[i]} strokeWidth="10" pathLength="100" strokeDasharray={`${[40, 25, 20, 15][i]} 100`} strokeDashoffset={-[0, 40, 65, 85][i]} transform="rotate(-90 60 34)" />) },
  { name: 'Funnel', svg: [100, 78, 56, 36].map((w, i) => <rect key={i} className="lp-grow-x" x={60 - w / 2} y={6 + i * 15} width={w} height="12" rx="3" fill={C[i]} style={{ '--d': `${i * 0.1}s` } as React.CSSProperties} />) },
  { name: 'Scatter', svg: [[14, 50], [26, 40], [36, 46], [48, 30], [58, 36], [70, 22], [82, 26], [96, 12], [106, 18]].map(([x, y], i) => <circle key={i} className="lp-pop-in" cx={x} cy={y} r={3 + (i % 3)} fill={C[i % 3]} style={{ '--d': `${i * 0.05}s` } as React.CSSProperties} />) },
  { name: 'Treemap', svg: <><rect x="4" y="4" width="62" height="60" rx="3" fill={C[0]} /><rect x="69" y="4" width="47" height="34" rx="3" fill={C[1]} /><rect x="69" y="41" width="22" height="23" rx="3" fill={C[2]} /><rect x="94" y="41" width="22" height="23" rx="3" fill={C[3]} /></> },
  { name: 'Gauge', svg: <><path d="M20 58 A40 40 0 0 1 100 58" fill="none" stroke="var(--muted)" strokeWidth="10" strokeLinecap="round" /><path className="lp-draw" d="M20 58 A40 40 0 0 1 88 30" fill="none" stroke={C[0]} strokeWidth="10" strokeLinecap="round" /></> },
  { name: 'KPI', svg: <><text x="60" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">$8.6M</text><text x="60" y="56" textAnchor="middle" fontSize="11" fill={C[1]}>▲ 12.4%</text></> },
  { name: 'Waterfall', svg: [[6, 20, 44], [25, 14, 26], [44, 30, 18], [63, 22, 40], [82, 10, 30], [101, 10, 54]].map(([x, y, h], i) => <rect key={i} className="lp-grow" x={x} y={y} width="14" height={h} rx="2" fill={i === 2 ? C[3] : i === 5 ? C[1] : C[0]} style={{ '--d': `${i * 0.08}s` } as React.CSSProperties} />) },
  { name: 'Radar', svg: <><polygon points="60,6 92,26 84,60 36,60 28,26" fill="none" stroke="var(--border)" /><polygon points="60,16 84,28 74,52 44,56 36,30" fill={C[0]} opacity=".45" stroke={C[0]} strokeWidth="2" /></> },
  { name: 'Sankey', svg: <><path d="M6 14 C60 14 60 40 114 40" fill="none" stroke={C[0]} strokeWidth="12" opacity=".7" /><path d="M6 46 C60 46 60 20 114 20" fill="none" stroke={C[1]} strokeWidth="9" opacity=".7" /><path d="M6 58 C60 58 60 58 114 58" fill="none" stroke={C[2]} strokeWidth="5" opacity=".7" /></> },
];

function Card({ name, svg }: (typeof MINI)[number]) {
  return (
    <div className="w-44 shrink-0 rounded-xl border bg-card p-3 shadow-lg transition hover:-translate-y-1 hover:border-primary/50">
      <svg viewBox="0 0 120 68" className="h-20 w-full">{svg}</svg>
      <div className="mt-2 text-sm font-medium">{name}</div>
    </div>
  );
}

export function ChartStrip() {
  return (
    <section className="relative py-16">
      <p data-reveal className="mb-8 text-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">20+ chart types</span> — styled, explained and ready to drop into any dashboard
      </p>
      <div className="lp-marquee overflow-hidden">
        <div>{[...MINI, ...MINI].map((m, i) => <Card key={i} {...m} />)}</div>
      </div>
    </section>
  );
}
