import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareRows, groupRows, indian } from '../src/features/charts/comparison.ts';

test('indian units: crore, lakh, Indian grouping, negatives', () => {
  assert.equal(indian(288600000), '₹28.86 Cr');
  assert.equal(indian(2577843), '₹25.78 L');
  assert.equal(indian(46624), '₹46,624');
  assert.equal(indian(-561012), '-₹5.61 L');
  assert.equal(indian(8.4721), '₹8.47');   // small amounts keep their paise
});

test('compare rows: growth vs previous, share, biggest first', () => {
  const rows = compareRows([{ c: 'B', y: 50, p: 100 }, { c: 'A', y: 150, p: 100 }], 'c', 'y', 'p');
  assert.deepEqual(rows.map((r) => r.name), ['A', 'B']);
  assert.equal(rows[0].growth, 0.5);
  assert.equal(rows[1].growth, -0.5);
  assert.equal(rows[0].share, 0.75);
  assert.equal(compareRows([{ c: 'A', y: 1 }], 'c', 'y')[0].growth, null);   // no previous column
});

test('performance groups: big/small by average share, fast/slow by overall growth', () => {
  const rows = compareRows([
    { c: 'star', y: 600, p: 400 }, { c: 'watch', y: 300, p: 400 }, { c: 'rising', y: 60, p: 30 }, { c: 'laggard', y: 40, p: 80 },
  ], 'c', 'y', 'p');
  const { groupOf, overall } = groupRows(rows);
  assert.equal(overall, (1000 - 910) / 910);
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.name, groupOf(r)])), { star: 'stars', watch: 'watch', rising: 'rising', laggard: 'laggards' });
});

test('performance groups with your own lines: big = share >= 50%, fast = growth >= 0', () => {
  const rows = compareRows([{ c: 'a', y: 60, p: 70 }, { c: 'b', y: 30, p: 20 }, { c: 'c', y: 10, p: 12 }], 'c', 'y', 'p');
  const { groupOf, bigLine, fastLine } = groupRows(rows, { bigShare: 0.5, fastGrowth: 0 });
  assert.deepEqual([bigLine, fastLine], [0.5, 0]);
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.name, groupOf(r)])), { a: 'watch', b: 'rising', c: 'laggards' });
});

test('the same item on several rows is added up (one entry per item)', () => {
  const rows = compareRows([{ c: 'UK', y: 10, p: 5 }, { c: 'UK', y: 30, p: 15 }, { c: 'FR', y: 20, p: null }], 'c', 'y', 'p');
  assert.deepEqual(rows.map((r) => [r.name, r.cur, r.prev]), [['UK', 40, 20], ['FR', 20, null]]);
  assert.equal(rows[0].growth, 1);
});
