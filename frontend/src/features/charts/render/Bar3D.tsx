export type BarStyle = 'flat' | '3d' | 'isometric';
export const BAR_STYLES: [BarStyle, string][] = [['flat', 'Flat'], ['3d', '3D'], ['isometric', 'Isometric']];

interface ShapeProps { x?: number; y?: number; width?: number; height?: number }

const shade = (color: string, mix: 'black' | 'white', pct: number) => `color-mix(in oklab, ${color} ${100 - pct}%, ${mix})`;

/** Extra room above the plot so the top faces are not clipped. */
export const depthOf = (style: BarStyle, barWidth = 24): number => (style === 'flat' ? 0 : style === '3d' ? Math.min(14, Math.max(6, barWidth * 0.3)) : Math.min(16, Math.max(6, barWidth * 0.29)));

/**
 * ReUI-style 3D columns drawn as SVG faces (Recharts has no 3D): `3d` is an extruded bar (front, lit top, shaded side);
 * `isometric` is a column seen from the corner (lit top rhombus, two shaded faces).
 */
export function Bar3D({ x = 0, y = 0, width = 0, height = 0, color, variant }: ShapeProps & { color: string; variant: Exclude<BarStyle, 'flat'> }) {
  if (width <= 0 || height === 0) return null;
  // negative values arrive as a negative height: draw from the top edge either way
  const top = height < 0 ? y + height : y;
  const h = Math.abs(height);
  if (variant === '3d') {
    const d = depthOf('3d', width);
    const w = width - d;
    return (
      <g>
        <rect x={x} y={top} width={Math.max(w, 1)} height={h} fill={color} />
        <polygon points={`${x},${top} ${x + d},${top - d} ${x + width},${top - d} ${x + w},${top}`} fill={shade(color, 'white', 28)} />
        <polygon points={`${x + w},${top} ${x + width},${top - d} ${x + width},${top - d + h} ${x + w},${top + h}`} fill={shade(color, 'black', 28)} />
      </g>
    );
  }
  const half = width / 2;
  const dy = depthOf('isometric', width) * 0.9;
  const bottom = top + h;
  return (
    <g>
      <polygon points={`${x},${top + dy} ${x + half},${top + 2 * dy} ${x + half},${bottom} ${x},${bottom - dy}`} fill={color} />
      <polygon points={`${x + half},${top + 2 * dy} ${x + width},${top + dy} ${x + width},${bottom - dy} ${x + half},${bottom}`} fill={shade(color, 'black', 26)} />
      <polygon points={`${x + half},${top} ${x + width},${top + dy} ${x + half},${top + 2 * dy} ${x},${top + dy}`} fill={shade(color, 'white', 30)} />
    </g>
  );
}
