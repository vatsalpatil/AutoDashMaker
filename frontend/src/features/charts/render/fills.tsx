import { useId } from 'react';

/** How a bar / area / slice is painted (ReUI's gradient, stripe, crosshatch and dotted fills; shadcn's gradient areas). */
export type FillStyle = 'solid' | 'gradient' | 'stripes' | 'crosshatch' | 'dots';
export const FILL_STYLES: [FillStyle, string][] = [
  ['solid', 'Solid'], ['gradient', 'Gradient'], ['stripes', 'Stripes'], ['crosshatch', 'Crosshatch'], ['dots', 'Dotted'],
];

/** A safe DOM id for one chart instance (useId has colons, which url(#…) dislikes). */
export const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/**
 * `<defs>` for every series: a gradient per series, plus pattern overlays. Patterns are drawn as the series colour at
 * partial opacity with a solid stroke pattern on top, so they read on light and dark backgrounds.
 * Colours are CSS variables (`--color-<key>` from the chart config, or any CSS colour), so themes keep working.
 */
export function FillDefs({ uid, items, opacity = 0.3, vertical = true }: { uid: string; items: { key: string; color: string }[]; opacity?: number; vertical?: boolean }) {
  return (
    <defs>
      {items.map(({ key, color }) => (
        <g key={key}>
          <linearGradient id={`${uid}-g-${key}`} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <stop offset="5%" stopColor={color} stopOpacity={Math.min(1, opacity * 2.2)} />
            <stop offset="95%" stopColor={color} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={`${uid}-gb-${key}`} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </linearGradient>
          <pattern id={`${uid}-stripes-${key}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill={color} fillOpacity={0.22} />
            <rect width="3.5" height="8" fill={color} fillOpacity={0.9} />
          </pattern>
          <pattern id={`${uid}-crosshatch-${key}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={color} fillOpacity={0.18} />
            <path d="M0 0L8 8M8 0L0 8" stroke={color} strokeWidth="1.2" strokeOpacity={0.9} />
          </pattern>
          <pattern id={`${uid}-dots-${key}`} width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill={color} fillOpacity={0.16} />
            <circle cx="3.5" cy="3.5" r="1.7" fill={color} fillOpacity={0.95} />
          </pattern>
        </g>
      ))}
    </defs>
  );
}

/**
 * The `fill` for a series. Areas use the soft vertical gradient; bars use a duotone one (so "gradient" looks right on both);
 * patterns are the same for both. Solid is the plain colour.
 */
export function fillRef(style: FillStyle, uid: string, key: string, color: string, kind: 'area' | 'bar' | 'slice' = 'bar'): string {
  if (style === 'solid') return color;
  if (style === 'gradient') return kind === 'area' ? `url(#${uid}-g-${key})` : `url(#${uid}-gb-${key})`;
  return `url(#${uid}-${style}-${key})`;
}

/** Stroke glow (ReUI's glowing lines and markers): a coloured drop shadow that follows the line. */
export const glowStyle = (color: string, on: boolean): React.CSSProperties | undefined =>
  on ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined;
