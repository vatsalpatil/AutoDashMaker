import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profile, suggestCharts } from '../src/features/charts/suggest.ts';

const cities = ['Toronto', 'London', 'Paris', 'New York', 'Sydney', 'Melbourne', 'Berlin'].map((city, i) => ({ city, total_revenue: 4_500_000 - i * 300_000 }));

test('the screenshot case: city + revenue in a table -> ranked bars first, then donut and treemap; table itself not suggested', () => {
  const s = suggestCharts(['city', 'total_revenue'], cities, 'table');
  assert.deepEqual(s.slice(0, 3).map((x) => x.title), ['Ranked bars', 'Donut', 'Treemap']);
  assert.ok(!s.some((x) => x.type === 'table'));
  assert.match(s[0].reason, /7 items/);
});

test('dates -> trend first; one row -> big number; two text columns -> pivot', () => {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}-01`, revenue: i * 10, units: i }));
  assert.equal(suggestCharts(['month', 'revenue', 'units'], months)[0].type, 'line');
  assert.equal(suggestCharts(['total'], [{ total: 5 }])[0].type, 'kpi');
  const cross = [{ country: 'UK', category: 'Dark', v: 1 }, { country: 'FR', category: 'Milk', v: 2 }];
  assert.equal(suggestCharts(['country', 'category', 'v'], cross)[0].type, 'pivot');
  assert.deepEqual(profile(['month', 'revenue'], months).dates, ['month']);
});

test('current vs previous numbers -> Top N vs previous is offered', () => {
  const rows = cities.map((c) => ({ ...c, last_month: c.total_revenue * 0.9 }));
  assert.ok(suggestCharts(['city', 'total_revenue', 'last_month'], rows).some((x) => x.type === 'ranked'));
});
