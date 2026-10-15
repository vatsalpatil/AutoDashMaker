import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const dir = new URL('../src/features/charts/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));
const code = files(dir).map((f) => readFileSync(f, 'utf8')).join('\n');
const schema = readFileSync(join(dir, 'optionSchema.ts'), 'utf8') + readFileSync(join(dir, 'optionSections.ts'), 'utf8');
const defaults = schema.slice(schema.indexOf('export const DEFAULTS'));

test('every switch the charts treat as ON by default is ON in the panel too', () => {
  // `o.key !== false` / on(o, 'key') = on unless turned off; the panel shows DEFAULTS, so it must say true or it shows "off" while it is on
  const onInCode = new Set([...code.matchAll(/o\.(\w+) !== false/g), ...code.matchAll(/on\(o, '(\w+)'\)/g)].map((m) => m[1]));
  const switches = new Set([...schema.matchAll(/sw\('(\w+)'/g)].map((m) => m[1]));
  const wrong = [...onInCode].filter((k) => switches.has(k) && !new RegExp(`(^|[^\\w])${k}: true`).test(defaults));
  assert.deepEqual(wrong, [], `switch defaults out of sync with the renderers: ${wrong.join(', ')}`);
});
