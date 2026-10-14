import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESIGN_PX, gridPlacement, pageRule, printableWidthPx, printZoom, rowCount } from '../src/features/dashboards/printLayout.ts';

const w = (x: number, y: number, ww: number, h: number) => ({ id: 'w', position: { x, y, w: ww, h } }) as never;

test('printable width and zoom follow the paper: the 1200px design always fills the page width', () => {
  assert.ok(Math.abs(printableWidthPx({ paper: 'a4', landscape: false }) - 733.2) < 1);      // (210 - 16) mm
  assert.ok(Math.abs(printZoom({ paper: 'a4', landscape: false }) - 733.2 / DESIGN_PX) < 0.001);
  // bigger paper -> bigger zoom; landscape is wider than portrait; nothing is ever cropped (zoom * design <= printable width)
  assert.ok(printZoom({ paper: 'a3', landscape: false }) > printZoom({ paper: 'a4', landscape: false }));
  assert.ok(printZoom({ paper: 'a4', landscape: true }) > printZoom({ paper: 'a4', landscape: false }));
  for (const paper of ['a4', 'a3', 'letter'] as const) for (const landscape of [false, true]) {
    const o = { paper, landscape };
    assert.ok(printZoom(o) * DESIGN_PX <= printableWidthPx(o) + 0.5, `${paper} ${landscape}`);
  }
});

test('@page rule names the paper and orientation', () => {
  assert.match(pageRule({ paper: 'a4', landscape: false }), /size: A4 portrait; margin: 8mm/);
  assert.match(pageRule({ paper: 'letter', landscape: true }), /size: letter landscape/);
});

test('grid placement uses the saved column and row and never overflows the 12 columns', () => {
  assert.deepEqual(gridPlacement(w(0, 0, 4, 2)), { gridColumn: '1 / span 32', gridRow: '1 / span 16' });   // 8 sub-cells per grid unit (fractional positions)
  assert.deepEqual(gridPlacement(w(8, 3, 6, 4)), { gridColumn: '65 / span 32', gridRow: '25 / span 32' });   // clamped to the right edge
  assert.equal(rowCount([w(0, 0, 4, 2), w(0, 2, 12, 4)]), 6);
  assert.equal(rowCount([]), 1);
});
