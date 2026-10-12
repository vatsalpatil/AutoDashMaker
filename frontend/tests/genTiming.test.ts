import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration, stepMs, totalMs } from '../src/features/dashboards/generate/timing.ts';

const step = (n: number, spentMs: number, startedAt?: number) => ({ n, title: 't', detail: '', done: startedAt === undefined, spentMs, startedAt });

test('formatDuration: whole seconds, then minutes and seconds', () => {
  assert.equal(formatDuration(800), '0s');
  assert.equal(formatDuration(12_340), '12s');
  assert.equal(formatDuration(59_999), '59s');
  assert.equal(formatDuration(75_000), '1m 15s');
  assert.equal(formatDuration(3_605_000), '60m 05s');
});

test('stepMs adds the running segment to the finished time; a finished step stays frozen', () => {
  assert.equal(stepMs(step(1, 2000), 99_999), 2000);
  assert.equal(stepMs(step(2, 1000, 10_000), 14_000), 5000);
  assert.equal(stepMs(step(2, 0, 10_000), 5_000), 0);   // clock skew never goes negative
});

test('totalMs sums every step (time spent waiting for the user is in no step)', () => {
  assert.equal(totalMs([step(1, 3000), step(2, 4000), step(3, 500, 1000)], 3000), 3000 + 4000 + 2500);
  assert.equal(totalMs([], 1), 0);
});
