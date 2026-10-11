import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tidyDateLabels } from '../src/features/charts/dateLabels.ts';

const rows = (xs: string[]) => xs.map((x, i) => ({ x, s0: i }));

test('first-of-month timestamps become "Mon YYYY"', () => {
  const out = tidyDateLabels(rows(['2023-01-01T00:00:00', '2023-02-01T00:00:00', '2024-12-01T00:00:00']));
  assert.deepEqual(out.map((r) => r.x), ['Jan 2023', 'Feb 2023', 'Dec 2024']);
});

test('daily timestamps lose the midnight time but stay dates', () => {
  const out = tidyDateLabels(rows(['2023-01-01T00:00:00', '2023-01-02T00:00:00']));
  assert.deepEqual(out.map((r) => r.x), ['2023-01-01', '2023-01-02']);
});

test('anything that is not all midnight timestamps is left alone', () => {
  const mixed = rows(['2023-01-01T00:00:00', 'North']);
  assert.equal(tidyDateLabels(mixed), mixed);
  const times = rows(['2023-01-01T10:30:00']);
  assert.equal(tidyDateLabels(times), times);
  assert.deepEqual(tidyDateLabels([]), []);
});
