import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inScope, isDateLike, optionsFor, rowPasses, summary, type PinnedFilter } from '../src/features/dashboards/filters/pinnedModel.ts';

const F: PinnedFilter[] = [
  { id: 'y', field: 'order_date', label: 'Year', kind: 'year', scope: 'all' },
  { id: 'm', field: 'order_date', label: 'Month', kind: 'month', scope: 'all' },
  { id: 'c', field: 'country', label: 'Country', kind: 'select', scope: 'stores' },
];

test('scope: all-tabs filters everywhere, tab filters only on their tab', () => {
  assert.deepEqual(inScope(F, 'overview').map((f) => f.id), ['y', 'm']);
  assert.deepEqual(inScope(F, 'stores').map((f) => f.id), ['y', 'm', 'c']);
});

test('rows: year / month from a date, exact value for selects, missing columns ignored', () => {
  const row = { order_date: '2024-03-15', country: 'UK' };
  assert.equal(rowPasses(row, F, { y: '2024', m: '03' }), true);
  assert.equal(rowPasses(row, F, { y: '2023' }), false);
  assert.equal(rowPasses(row, F, { c: 'France' }), false);
  assert.equal(rowPasses({ region: 'x' }, F, { y: '2023', c: 'UK' }), true);   // widget without those columns: not filtered
  assert.equal(rowPasses(row, F, { y: '' }), true);                              // '' = All
});

test('options and summary', () => {
  assert.deepEqual(optionsFor('year', ['2023-01-02', '2024-05-06', '2023-07-08']).map((o) => o.value), ['2024', '2023']);
  assert.equal(optionsFor('month', []).length, 12);
  assert.deepEqual(optionsFor('select', ['b', 'a10', 'a2']).map((o) => o.value), ['a2', 'a10', 'b']);
  assert.equal(isDateLike(['2024-01-01', '2023-02']), true);
  assert.equal(isDateLike(['UK']), false);
  assert.equal(summary(F, { y: '2024', m: '03', c: 'UK' }), 'Year 2024 · Month Mar · Country UK');
});
