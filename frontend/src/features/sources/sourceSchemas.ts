import type { Source } from '@/lib/types';

/**
 * Declarative description of every connection type. The add/edit dialog renders a form from this, so a new
 * source type is one entry here (fields + how they map to the API config), not a new form component.
 */

export type BadgeKind = 'neutral' | 'blue' | 'green' | 'success' | 'purple' | 'warning';

export interface Field {
  key: string;
  label: string;
  kind?: 'text' | 'password' | 'select' | 'textarea' | 'file';
  /** file fields: accepted extensions for the picker */
  accept?: string;
  /** shown in the collapsible "SSL / TLS" section instead of the main form */
  advanced?: boolean;
  placeholder?: string;
  options?: string[];
  default?: string;
}

export interface SourceSchema {
  id: string;
  label: string;
  badge: BadgeKind;
  fields: Field[];
  /** two-column form (databases) instead of a single column */
  grid?: boolean;
  /** helper text under the form */
  hint?: string;
  /** highlighted instruction box above the form */
  note?: string;
  /** form values -> `config` object sent to the API */
  toConfig?: (v: Record<string, string>) => Record<string, unknown>;
}

const nameField: Field = { key: 'name', label: 'Name' };

const SSL_MODES: Record<string, string[]> = {
  mysql: ['', 'DISABLED', 'PREFERRED', 'REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY'],
  postgres: ['', 'disable', 'require', 'verify-ca', 'verify-full'],
};
const CERT_ACCEPT = '.pem,.crt,.cer,.key,.ca,.p12';
const SSL_KEYS = ['ssl_mode', 'ssl_ca', 'ssl_cert', 'ssl_key'] as const;

const database = (id: string, label: string, port: string, badge: BadgeKind): SourceSchema => ({
  id, label, badge, grid: true,
  fields: [
    nameField,
    { key: 'host', label: 'Host', default: 'localhost' },
    { key: 'port', label: 'Port', default: port },
    { key: 'database', label: 'Database' },
    { key: 'user', label: 'User' },
    { key: 'password', label: 'Password', kind: 'password' },
    { key: 'ssl_mode', label: 'SSL mode (blank = server default)', kind: 'select', options: SSL_MODES[id], advanced: true },
    { key: 'ssl_ca', label: 'CA certificate (.pem)', kind: 'file', accept: CERT_ACCEPT, advanced: true },
    { key: 'ssl_cert', label: 'Client certificate', kind: 'file', accept: CERT_ACCEPT, advanced: true },
    { key: 'ssl_key', label: 'Client key', kind: 'file', accept: CERT_ACCEPT, advanced: true },
  ],
  toConfig: (v) => ({
    host: v.host, port: Number(v.port) || Number(port), database: v.database, user: v.user, password: v.password,
    ...Object.fromEntries(SSL_KEYS.filter((k) => v[k]).map((k) => [k, v[k]])),  // only the TLS options that are set
  }),
});

export const SOURCE_SCHEMAS: SourceSchema[] = [
  database('postgres', 'PostgreSQL', '5432', 'blue'),
  database('mysql', 'MySQL', '3306', 'warning'),
  {
    id: 'sqlite', label: 'SQLite', badge: 'green',
    fields: [nameField, { key: 'path', label: 'File path (absolute)', placeholder: 'C:/data/mydb.sqlite' }],
    hint: 'Absolute path to the .sqlite/.db file on the server.',
    toConfig: (v) => ({ path: v.path }),
  },
  {
    id: 'url', label: 'Direct URL', badge: 'blue',
    fields: [nameField, { key: 'url', label: 'File URL', placeholder: 'https://example.com/data.csv' }],
    hint: 'Direct link to a CSV, Parquet, JSON, or Excel file.',
    toConfig: (v) => ({ url: v.url, name: v.name }),
  },
  {
    id: 'gsheets', label: 'Google Sheets', badge: 'green',
    fields: [nameField, { key: 'url', label: 'Google Sheets link', placeholder: 'https://docs.google.com/spreadsheets/d/…' }],
    note: 'Share the sheet as Anyone with the link → Viewer, then paste the link below.',
    toConfig: (v) => ({ url: v.url, name: v.name }),
  },
  {
    id: 'rest', label: 'REST API', badge: 'purple',
    fields: [
      nameField,
      { key: 'url', label: 'URL' },
      { key: 'method', label: 'Method', kind: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
      { key: 'headers', label: 'Headers (JSON)', kind: 'textarea', default: '{}' },
      { key: 'body', label: 'Body (optional, for POST)', kind: 'textarea' },
      { key: 'record_path', label: 'Record path (blank = detect automatically)' },
    ],
    hint: 'Tip: build and test the request in the API Studio first, then use “Save as refreshable source”.',
    toConfig: (v) => {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(v.headers || '{}'); } catch { throw new Error('Headers must be valid JSON'); }
      return { url: v.url, method: v.method, headers, body: v.body || undefined, record_path: v.record_path || undefined, flatten_sep: '_' };
    },
  },
  { id: 'file', label: 'File', badge: 'success', fields: [], note: 'Files are added directly via the drag & drop file uploader box above.' },
  {
    id: 'graphql', label: 'GraphQL', badge: 'purple',
    fields: [
      nameField,
      { key: 'url', label: 'Endpoint', placeholder: 'https://api.example.com/graphql' },
      { key: 'query', label: 'Query', kind: 'textarea', placeholder: '{ products { id name price } }' },
      { key: 'variables', label: 'Variables (JSON)', kind: 'textarea', default: '{}' },
      { key: 'headers', label: 'Headers (JSON)', kind: 'textarea', default: '{}' },
      { key: 'record_path', label: 'Record path (blank = detect automatically)' },
    ],
    hint: 'Tip: explore the schema and test the query in the API Studio, then save it as a refreshable source.',
    toConfig: (v) => {
      const parse = (text: string, what: string) => { try { return JSON.parse(text || '{}'); } catch { throw new Error(`${what} must be valid JSON`); } };
      return { url: v.url, query: v.query, variables: parse(v.variables, 'Variables'), headers: parse(v.headers, 'Headers'), record_path: v.record_path || undefined, flatten_sep: '_' };
    },
  },
];

export const schemaOf = (type: string) => SOURCE_SCHEMAS.find((s) => s.id === type);
export const typeLabel = (type: string) => schemaOf(type)?.label ?? type;
export const typeBadge = (type: string): BadgeKind => schemaOf(type)?.badge ?? 'neutral';

/** Empty form values for a schema (field defaults applied). */
export function defaultValues(schema: SourceSchema): Record<string, string> {
  return Object.fromEntries(schema.fields.map((f) => [f.key, f.default ?? '']));
}

/** Form values for editing a saved source (passwords are never sent back, so they start blank). */
export function valuesFromSource(schema: SourceSchema, source: Source): Record<string, string> {
  const cfg = source.config ?? {};
  const values = defaultValues(schema);
  for (const f of schema.fields) {
    const raw = cfg[f.key];
    if (f.key === 'name') values.name = source.name;
    else if (f.kind === 'password') values[f.key] = '';
    else if (raw !== undefined && raw !== null) values[f.key] = typeof raw === 'object' ? JSON.stringify(raw, null, 2) : String(raw);
  }
  return values;
}

/** The `{name, type, config}` body for POST/PATCH /sources and POST /sources/test. */
export function buildPayload(schema: SourceSchema, values: Record<string, string>, editing?: Source | null) {
  const config = schema.toConfig?.(values) ?? {};
  // editing a database source with the password left blank keeps the stored one
  if (editing && schema.fields.some((f) => f.kind === 'password') && !config.password) {
    config.password = editing.config?.password ?? '';
  }
  return { name: values.name, type: schema.id, config };
}
