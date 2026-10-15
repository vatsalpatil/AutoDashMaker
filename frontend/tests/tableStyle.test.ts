import assert from 'node:assert/strict';
import { test } from 'node:test';
import { barFraction, parseLabels, parseList, parseRules, ruleColor } from '../src/features/charts/tableStyle.ts';

test('colour rules: numbers, text, contains, any column, first match wins', () => {
  const rules = parseRules('revenue>100000:#16a34a; status=Late:#dc2626; name~choc:blue; *<0:red; junk');
  assert.equal(rules.length, 4);
  assert.equal(ruleColor(rules, 'revenue', 150000), '#16a34a');
  assert.equal(ruleColor(rules, 'Revenue', '99'), undefined);
  assert.equal(ruleColor(rules, 'status', 'late'), '#dc2626');
  assert.equal(ruleColor(rules, 'name', 'Dark Chocolate'), 'blue');
  assert.equal(ruleColor(rules, 'growth', -3), 'red');
  assert.equal(ruleColor(rules, 'growth', null), undefined);
});

test('renames, lists, bars', () => {
  assert.deepEqual(parseLabels('revenue=Revenue (₹); qty = Units ; bad'), { revenue: 'Revenue (₹)', qty: 'Units' });
  assert.deepEqual(parseList(' a, b ,,c'), ['a', 'b', 'c']);
  assert.equal(barFraction(50, 200), 0.25);
  assert.equal(barFraction('x', 200), 0);
});
