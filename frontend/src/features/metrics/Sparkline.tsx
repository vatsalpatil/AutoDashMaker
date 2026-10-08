/** A tiny line of the last periods; decorative, so no axes. Fills the width of its box. */
export function Sparkline({ values, className }: { values: (number | null)[]; className?: string }) {
  const pts = values.filter((v): v is number => typeof v === 'number');
  if (pts.length < 2) return null;
  const [min, max] = [Math.min(...pts), Math.max(...pts)];
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 100, 28 - ((v - min) / span) * 24] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className ?? 'h-8 w-full'} aria-hidden>
      <polygon points={`0,32 ${line} 100,32`} fill="var(--primary)" fillOpacity="0.12" />
      <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={xy.at(-1)![0]} cy={xy.at(-1)![1]} r="2" fill="var(--primary)" />
    </svg>
  );
}
