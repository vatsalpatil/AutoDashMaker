import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainDate } from '../src/lib/utils.ts';

test('midnight timestamps show as plain dates; everything else is untouched', () => {
  assert.equal(plainDate('2023-10-01T00:00:00'), '2023-10-01');
  assert.equal(plainDate('2023-10-01T00:00:00.000'), '2023-10-01');
  assert.equal(plainDate('2023-10-01T10:30:00'), '2023-10-01T10:30:00');
  assert.equal(plainDate('North'), 'North');
  assert.equal(plainDate('2023-10-01'), '2023-10-01');
});
