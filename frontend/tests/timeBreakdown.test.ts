import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBreakdown, cellValue, dateParts, footerValue, timeColumns } from '../src/features/charts/timeBreakdown.ts';

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const rows = [
  { sku: 'A', d: '2025-12-30', qty: 5, cat: 'SAREE' },
  { sku: 'A', d: '2026-01-05', qty: 3, cat: 'SAREE' },
  { sku: 'A', d: '2026-01-06', qty: 2, cat: 'SAREE' },
  { sku: 'B', d: '2026-02-01', qty: 7, cat: 'KURTA' },
  { sku: 'B', d: null, qty: 9, cat: 'KURTA' },          // no date: ignored in every period and the total
];

test('date parts from ISO strings and month-only values', () => {
  assert.deepEqual(dateParts('2026-01-05T00:00:00'), ['2026', '2026-01', '2026-01-05']);
  assert.deepEqual(dateParts('2026-03'), ['2026', '2026-03', '2026-03-01']);
  assert.equal(dateParts('abc'), null);
});

test('years by default; a year opens into months and a month into days', () => {
  const tb = buildBreakdown(rows, 'sku', 'd', 'qty', ['cat']);
  assert.deepEqual(timeColumns(tb, new Set()).map((c) => c.label), ['2025', '2026']);
  assert.deepEqual(timeColumns(tb, new Set(['2026'])).map((c) => c.label), ['2025', 'Jan-26', 'Feb-26']);
  assert.deepEqual(timeColumns(tb, new Set(['2026', '2026-01'])).map((c) => c.label), ['2025', '05 Jan-26', '06 Jan-26', 'Feb-26']);
});

test('cells, totals and the footer', () => {
  const tb = buildBreakdown(rows, 'sku', 'd', 'qty', ['cat']);
  const a = tb.rows.find((r) => r.id === 'A')!;
  assert.equal(a.attrs.cat, 'SAREE');
  assert.equal(cellValue(a, '2026', sum), 5);
  assert.equal(cellValue(a, '2026-01-05', sum), 3);
  assert.equal(cellValue(a, '__total', sum), 10);
  assert.equal(cellValue(a, '2026-02', sum), null);       // no sales that month: a dash, not 0
  assert.equal(footerValue(tb.rows, '2026', sum), 12);
  assert.equal(footerValue(tb.rows, '__total', sum), 17);
});
