import assert from 'node:assert/strict';
import { test } from 'node:test';
import { greeting, recentWork } from '../src/features/home/recent.ts';

test('recentWork merges dashboards and charts, newest first, capped', () => {
  const dashboards = [{ id: 'd1', name: 'Sales', created_at: '2024-03-02T10:00:00', description: 'x' }, { id: 'd2', name: 'Ops', created_at: '2024-01-01T10:00:00' }];
  const charts = [{ id: 'c1', name: 'Revenue', created_at: '2024-03-05T09:00:00' }, { id: 'c2', name: 'Old', created_at: '2023-12-31T09:00:00' }];
  const r = recentWork(dashboards, charts, 3);
  assert.deepEqual(r.map((i) => i.id), ['c1', 'd1', 'd2']);
  assert.equal(r[0].to, '/charts/c1');
  assert.equal(r[1].to, '/dashboards/d1');
  assert.equal(r[1].note, 'x');
});

test('recentWork copes with missing dates and empty input', () => {
  assert.deepEqual(recentWork([], []), []);
  assert.equal(recentWork([{ id: 'a', name: 'A' }], [{ id: 'b', name: 'B', created_at: '2024-01-01T00:00:00' }])[0].id, 'b');
});

test('greeting follows the hour', () => {
  assert.equal(greeting(new Date(2024, 0, 1, 9)), 'Good morning');
  assert.equal(greeting(new Date(2024, 0, 1, 14)), 'Good afternoon');
  assert.equal(greeting(new Date(2024, 0, 1, 20)), 'Good evening');
  assert.equal(greeting(new Date(2024, 0, 1, 2)), 'Working late');
});
