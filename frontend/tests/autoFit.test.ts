import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitLayout, rowsFor, shouldResize } from '../src/features/dashboards/autoFit.ts';

const L = (i: string, x: number, y: number, w: number, h: number) => ({ i, x, y, w, h });

test('shrinking a widget pulls up what is below it in the same columns, not its neighbours', () => {
  //  A (0-6, h8)   B (6-12, h8)
  //  C (0-6)       D (6-12)
  const out = fitLayout([L('A', 0, 0, 6, 8), L('B', 6, 0, 6, 8), L('C', 0, 8, 6, 4), L('D', 6, 8, 6, 4)], new Map([['A', 5]]))!;
  const at = Object.fromEntries(out.map((c) => [c.i, c]));
  assert.deepEqual([at.A.h, at.C.y, at.B.y, at.D.y], [5, 5, 0, 8]);
});

test('a widget spanning two columns stops at the lower of its supports (no overlap)', () => {
  const out = fitLayout([L('A', 0, 0, 6, 8), L('B', 6, 0, 6, 6), L('W', 0, 8, 12, 4)], new Map([['A', 4]]))!;
  assert.equal(out.find((c) => c.i === 'W')!.y, 6);   // B still ends at 6
});

test('growing pushes the chain below down; gaps on purpose are kept', () => {
  const out = fitLayout([L('A', 0, 0, 12, 4), L('B', 0, 6, 12, 4), L('C', 0, 10, 12, 4)], new Map([['A', 7]]))!;
  assert.deepEqual(out.map((c) => c.y), [0, 9, 13]);   // the 2-row gap between A and B survives
});

test('nothing to change returns null', () => {
  assert.equal(fitLayout([L('A', 0, 0, 12, 4)], new Map([['A', 4]])), null);
});

test('rowsFor rounds up and clamps', () => {
  assert.equal(rowsFor(100, 23), 5);
  assert.equal(rowsFor(10, 23), 2);
  assert.equal(rowsFor(99999, 23, 48), 48);
});

test('resize rule: grow to avoid clipping, shrink only for a real saving (stops 5.5 <-> 5.75 flapping)', () => {
  assert.equal(shouldResize(22, 23), true);    // content would be cut: grow
  assert.equal(shouldResize(23, 22), false);   // 1 quarter-row smaller: keep
  assert.equal(shouldResize(23, 21), true);    // half a row or more: shrink
});
