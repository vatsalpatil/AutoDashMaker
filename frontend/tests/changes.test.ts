import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combineChanges } from '../src/features/dashboards/generate/changes.ts';

test('one change goes through as written; several become one numbered instruction', () => {
  assert.equal(combineChanges(['Add KPI: Average Unit Price']), 'Add KPI: Average Unit Price');
  const many = combineChanges(['Add KPI: Total Quantity Sold', 'Add Chart: Profit by Category', 'show weekly revenue']);
  assert.match(many, /^Make all of these changes to the dashboard:/);
  assert.match(many, /1\. Add KPI: Total Quantity Sold\n2\. Add Chart: Profit by Category\n3\. show weekly revenue$/);
});
