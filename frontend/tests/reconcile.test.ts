import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcile } from '../src/features/charts/reconcile.ts';

const rows = [
  { sku: 'A', uni: 10, portal: 10, raw: 10 },    // match
  { sku: 'B', uni: 16, portal: 0, raw: 14 },     // portal missing, diff 16
  { sku: 'C', uni: 9, portal: 9, raw: 8 },       // diff 1
  { sku: 'D', uni: null, portal: 3, raw: 3 },    // uni missing, diff 3
];

test('match rate, mismatches, diffs and missing per source', () => {
  const s = reconcile(rows, 'sku', ['uni', 'portal', 'raw']);
  assert.equal(s.matched, 1);
  assert.equal(s.mismatched, 3);
  assert.equal(s.matchRate, 0.25);
  assert.equal(s.totalDiff, 20);
  assert.equal(s.largest?.key, 'B');
  assert.deepEqual(s.missing, [1, 1, 0]);
  assert.deepEqual(s.totals, [35, 22, 35]);
  assert.deepEqual(s.rows.map((r) => r.key), ['B', 'D', 'C', 'A']);
});

test('tolerance counts small differences as matches', () => {
  assert.equal(reconcile(rows, 'sku', ['uni', 'portal', 'raw'], 1).matched, 2);
});

test('percentage tolerance: within 10% of the larger value counts as a match', () => {
  const s = reconcile([{ k: 'a', x: 100, y: 95 }, { k: 'b', x: 100, y: 80 }], 'k', ['x', 'y'], 0, 10);
  assert.deepEqual(s.rows.map((r) => [r.key, r.ok]), [['b', false], ['a', true]]);
});
