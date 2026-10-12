import type { Widget } from '@/lib/types';

export type Paper = 'a4' | 'a3' | 'letter';
export interface PrintOptions { paper: Paper; landscape: boolean }

/** Paper sizes in millimetres (portrait). */
export const PAPER_MM: Record<Paper, [number, number]> = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };
export const PAPER_LABEL: Record<Paper, string> = { a4: 'A4', a3: 'A3', letter: 'Letter' };
export const MARGIN_MM = 8;
/** The dashboard is laid out at this fixed width (so charts always draw the same) and then zoomed to the paper. */
export const DESIGN_PX = 1200;
export const ROW_PX = 72;
export const GAP_PX = 10;

const mmToPx = (mm: number) => (mm * 96) / 25.4;

/** Width of the printable area in CSS pixels for the chosen paper. */
export function printableWidthPx({ paper, landscape }: PrintOptions): number {
  const [w, h] = PAPER_MM[paper];
  return mmToPx((landscape ? h : w) - 2 * MARGIN_MM);
}

/** Zoom that makes the design width exactly fill the printable width (bigger paper = bigger content, never cropped). */
export const printZoom = (o: PrintOptions): number => Math.min(2, printableWidthPx(o) / DESIGN_PX);

/** CSS `@page` rule for the chosen paper (the browser's print dialog then opens on it). */
export const pageRule = ({ paper, landscape }: PrintOptions): string =>
  `@page { size: ${paper === 'letter' ? 'letter' : paper.toUpperCase()} ${landscape ? 'landscape' : 'portrait'}; margin: ${MARGIN_MM}mm; }`;

/** Grid placement of a widget from its saved position, clamped to the 12 columns. */
export function gridPlacement(w: Widget): { gridColumn: string; gridRow: string } {
  const x = Math.min(Math.max(w.position.x, 0), 11);
  const span = Math.min(Math.max(w.position.w, 1), 12 - x);
  return { gridColumn: `${x + 1} / span ${span}`, gridRow: `${Math.max(w.position.y, 0) + 1} / span ${Math.max(w.position.h, 1)}` };
}

export const rowCount = (widgets: Widget[]): number => Math.max(1, ...widgets.map((w) => Math.max(w.position.y, 0) + Math.max(w.position.h, 1)));
