export interface Palette { id: string; label: string; colors: string[] }

const mono = [100, 80, 62, 48, 36, 26, 18, 12].map((a) => `color-mix(in oklab, var(--primary) ${a}%, var(--background))`);

/** `theme` follows the active app theme (--chart-N tokens); the rest are fixed colour sets. */
export const PALETTES: Palette[] = [
  { id: 'theme', label: 'Theme', colors: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`) },
  { id: 'vivid', label: 'Vivid', colors: ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'] },
  { id: 'pastel', label: 'Pastel', colors: ['#93c5fd', '#86efac', '#fcd34d', '#fca5a5', '#c4b5fd', '#67e8f9', '#f9a8d4', '#bef264'] },
  { id: 'cool', label: 'Cool', colors: ['#0ea5e9', '#6366f1', '#14b8a6', '#8b5cf6', '#22d3ee', '#3b82f6', '#2dd4bf', '#a78bfa'] },
  { id: 'warm', label: 'Warm', colors: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#eab308', '#fb7185', '#fb923c', '#d946ef'] },
  { id: 'mono', label: 'Monochrome', colors: mono },
];

export function paletteColors(id: unknown): string[] {
  return (PALETTES.find((p) => p.id === id) ?? PALETTES[0]).colors;
}
