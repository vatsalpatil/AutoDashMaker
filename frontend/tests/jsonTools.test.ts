import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeJson, detectRecords, flatten, parseCurl, parseLoose, queryJson, sortKeys, toTable } from '../src/lib/jsonTools.ts';

test('parseLoose repairs sloppy JSON and reports hopeless input', () => {
  assert.deepEqual(parseLoose('{"a":1}'), { value: { a: 1 }, repaired: false });
  const fixed = parseLoose("{a: 'x', b: [1,2,],}");
  assert.equal(fixed.repaired, true);
  assert.deepEqual(fixed.value, { a: 'x', b: [1, 2] });
  assert.ok(parseLoose('').error);
});

test('detectRecords finds the table-like array, however deep', () => {
  assert.deepEqual(detectRecords([{ a: 1 }, { a: 2 }])?.path, []);
  const reply = { meta: { page: 1 }, data: { items: [{ id: 1, n: 'x' }, { id: 2, n: 'y' }, { id: 3, n: 'z' }] }, tags: ['a', 'b'] };
  const found = detectRecords(reply);
  assert.deepEqual(found?.path, ['data', 'items']);
  assert.equal(found?.records.length, 3);
  assert.equal(detectRecords({ a: 1, b: 'x' }), null);
});

test('flatten and toTable make dotted columns and keep arrays as JSON text', () => {
  assert.deepEqual(flatten({ id: 1, version: { name: 'red', url: 'u' }, tags: [1, 2], empty: {} }), {
    id: 1, 'version.name': 'red', 'version.url': 'u', tags: '[1,2]', empty: '{}',
  });
  const t = toTable([{ a: 1, b: { c: 2 } }, { a: 3, d: 4 }]);
  assert.deepEqual(t.columns, ['a', 'b.c', 'd']);
  assert.equal(t.rows.length, 2);
});

test('queryJson runs JSONPath', () => {
  const doc = { items: [{ name: 'a', price: 5 }, { name: 'b', price: 20 }] };
  assert.deepEqual(queryJson(doc, '$.items[?(@.price>10)].name'), ['b']);
  assert.equal(queryJson(doc, '$.items[0].name'), 'a');
});

test('sortKeys and describeJson', () => {
  assert.equal(JSON.stringify(sortKeys({ b: 1, a: { d: 1, c: 2 } })), '{"a":{"c":2,"d":1},"b":1}');
  assert.equal(describeJson([1, 2, 3]), 'array of 3 items');
  assert.equal(describeJson({ a: 1 }), 'object with 1 key');
});

test('parseCurl reads method, headers, body and basic auth', () => {
  const c = parseCurl(`curl -X POST 'https://api.test/v1/items?x=1' \\\n -H 'Content-Type: application/json' -H "X-Key: abc" -d '{"a":1}'`);
  assert.equal(c?.method, 'POST');
  assert.equal(c?.url, 'https://api.test/v1/items?x=1');
  assert.deepEqual(c?.headers, { 'Content-Type': 'application/json', 'X-Key': 'abc' });
  assert.equal(c?.body, '{"a":1}');
  assert.equal(parseCurl('curl https://x.io')?.method, 'GET');
  assert.equal(parseCurl('curl -d a=1 https://x.io')?.method, 'POST');
  assert.equal(parseCurl('wget https://x.io'), null);
  assert.match(parseCurl('curl -u user:pass https://x.io')?.headers.Authorization ?? '', /^Basic /);
});

test('diffJson reports added, removed and changed paths', async () => {
  const { diffJson } = await import('../src/lib/jsonTools.ts');
  const d = diffJson({ a: 1, b: [1, 2], c: 'x' }, { a: 2, b: [1], d: true });
  const by = Object.fromEntries(d.map((c) => [c.path, c.kind]));
  assert.deepEqual(by, { a: 'changed', 'b.1': 'removed', c: 'removed', d: 'added' });
  assert.deepEqual(diffJson({ x: 1 }, { x: 1 }), []);
});

test('inferSchema + validate round trip and catch violations', async () => {
  const { inferSchema, validate } = await import('../src/lib/jsonSchema.ts');
  const sample = [{ id: 1, name: 'a', tag: null }, { id: 2, name: 'b' }];
  const schema = inferSchema(sample) as { items: { required: string[]; properties: Record<string, { type: unknown }> } };
  assert.deepEqual(schema.items.required, ['id', 'name']);              // `tag` is not in every record
  assert.deepEqual(validate(sample, schema), []);
  const bad = validate([{ id: 'x', name: 'c' }, { name: 'd' }], schema);
  assert.deepEqual(bad.map((b) => `${b.path}: ${b.message}`), ['$[0].id: expected integer, got string', '$[1].id: is required']);
  assert.equal(validate(5, { type: 'number', minimum: 10 })[0].message, 'must be ≥ 10');
});
