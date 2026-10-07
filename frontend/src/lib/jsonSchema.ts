/** A small JSON Schema toolkit for the API Studio: infer a schema from a sample, validate a document against one. */
type Schema = { [k: string]: unknown };
export interface SchemaIssue { path: string; message: string }

const typeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);

/** Merge the schemas of several samples (array items): union of types, required = keys present in every sample. */
function merge(a: Schema, b: Schema): Schema {
  const types = [...new Set([...([a.type] as string[]).flat(), ...([b.type] as string[]).flat()])]
    .filter((t, _, all) => !(t === 'integer' && all.includes('number')));
  const out: Schema = { type: types.length === 1 ? types[0] : types };
  if (a.properties || b.properties) {
    const pa = (a.properties ?? {}) as Record<string, Schema>, pb = (b.properties ?? {}) as Record<string, Schema>;
    out.properties = Object.fromEntries([...new Set([...Object.keys(pa), ...Object.keys(pb)])].map((k) => [k, pa[k] && pb[k] ? merge(pa[k], pb[k]) : pa[k] ?? pb[k]]));
    const ra = (a.required ?? []) as string[], rb = (b.required ?? []) as string[];
    out.required = ra.filter((k) => rb.includes(k));
  }
  if (a.items || b.items) out.items = a.items && b.items ? merge(a.items as Schema, b.items as Schema) : a.items ?? b.items;
  return out;
}

export function inferSchema(v: unknown): Schema {
  const t = typeOf(v);
  if (t === 'array') {
    const items = (v as unknown[]).slice(0, 200).map(inferSchema);
    return items.length ? { type: 'array', items: items.reduce(merge) } : { type: 'array' };
  }
  if (t === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    return { type: 'object', properties: Object.fromEntries(entries.map(([k, x]) => [k, inferSchema(x)])), required: entries.map(([k]) => k) };
  }
  return { type: t };
}

/** Validate against the common JSON Schema keywords (type, required, properties, items, enum, const, min/max, length, pattern). */
export function validate(value: unknown, schema: Schema, path = '$', out: SchemaIssue[] = []): SchemaIssue[] {
  const add = (message: string) => { if (out.length < 200) out.push({ path, message }); };
  const types = schema.type === undefined ? null : ([schema.type] as string[]).flat();
  const t = typeOf(value);
  if (types && !types.some((x) => x === t || (x === 'number' && t === 'integer'))) { add(`expected ${types.join(' or ')}, got ${t}`); return out; }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) add(`must be one of ${JSON.stringify(schema.enum)}`);
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) add(`must equal ${JSON.stringify(schema.const)}`);
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) add(`must be ≥ ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) add(`must be ≤ ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) add(`shorter than ${schema.minLength} characters`);
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) add(`longer than ${schema.maxLength} characters`);
    if (typeof schema.pattern === 'string') { try { if (!new RegExp(schema.pattern).test(value)) add(`does not match ${schema.pattern}`); } catch { /* bad pattern: ignore */ } }
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    for (const k of (schema.required ?? []) as string[]) if (!(k in obj)) out.push({ path: `${path}.${k}`, message: 'is required' });
    for (const [k, sub] of Object.entries((schema.properties ?? {}) as Record<string, Schema>)) if (k in obj) validate(obj[k], sub, `${path}.${k}`, out);
  }
  if (t === 'array' && schema.items && typeof schema.items === 'object') {
    const arr = value as unknown[];
    for (let i = 0; i < Math.min(arr.length, 500); i++) validate(arr[i], schema.items as Schema, `${path}[${i}]`, out);
  }
  return out;
}
