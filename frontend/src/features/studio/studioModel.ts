import { readStorage } from '@/hooks/useLocalStorage';

/** Request model of the API Studio (REST + GraphQL) and the helpers that turn a draft into a server request. */

export interface KV { id: string; key: string; value: string; on: boolean }
export type BodyType = 'none' | 'json' | 'text' | 'form';
export interface AuthDraft { type: 'none' | 'bearer' | 'basic' | 'apikey'; token: string; user: string; pass: string; header: string; key: string }

export interface RestDraft {
  method: string; url: string; params: KV[]; headers: KV[]; bodyType: BodyType; body: string; auth: AuthDraft; recordPath: string;
}
export interface GraphqlDraft { url: string; query: string; variables: string; headers: KV[]; auth: AuthDraft; recordPath: string }

export interface ProxyResponse {
  status: number; status_text: string; ok: boolean; elapsed_ms: number; size: number; truncated: boolean;
  headers: Record<string, string>; body: string; url: string;
}
export interface ServerRequest { method: string; url: string; headers: Record<string, string>; params: Record<string, string>; body?: string }

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const uid = () => Math.random().toString(36).slice(2, 9);
export const kv = (key = '', value = '', on = true): KV => ({ id: uid(), key, value, on });
export const emptyAuth = (): AuthDraft => ({ type: 'none', token: '', user: '', pass: '', header: 'X-API-Key', key: '' });

export const newRest = (): RestDraft => ({ method: 'GET', url: '', params: [kv()], headers: [kv()], bodyType: 'none', body: '', auth: emptyAuth(), recordPath: '' });
export const newGraphql = (): GraphqlDraft => ({
  url: '', query: '{\n  \n}', variables: '{}', headers: [kv()], auth: emptyAuth(), recordPath: '',
});

/** `{{name}}` → the environment's value (unknown names are left as they are, so the problem is visible). */
export function substitute(text: string, env: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, name: string) => env[name] ?? m);
}

export const readEnv = (): Record<string, string> =>
  Object.fromEntries(readStorage<KV[]>('studio.env', []).filter((e) => e.on && e.key).map((e) => [e.key, e.value]));

const toMap = (list: KV[], env: Record<string, string>) =>
  Object.fromEntries(list.filter((r) => r.on && r.key.trim()).map((r) => [substitute(r.key.trim(), env), substitute(r.value, env)]));

function authHeaders(a: AuthDraft, env: Record<string, string>): Record<string, string> {
  if (a.type === 'bearer' && a.token) return { Authorization: `Bearer ${substitute(a.token, env)}` };
  if (a.type === 'basic' && a.user) return { Authorization: `Basic ${btoa(`${substitute(a.user, env)}:${substitute(a.pass, env)}`)}` };
  if (a.type === 'apikey' && a.key) return { [a.header || 'X-API-Key']: substitute(a.key, env) };
  return {};
}

export function buildRest(d: RestDraft, env: Record<string, string>): ServerRequest {
  const headers = { ...toMap(d.headers, env), ...authHeaders(d.auth, env) };
  let body: string | undefined;
  if (d.bodyType !== 'none' && !['GET', 'HEAD'].includes(d.method)) {
    body = substitute(d.body, env);
    if (d.bodyType === 'form') body = new URLSearchParams(Object.fromEntries(body.split('\n').filter(Boolean).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }))).toString();
    const type = d.bodyType === 'json' ? 'application/json' : d.bodyType === 'form' ? 'application/x-www-form-urlencoded' : 'text/plain';
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['Content-Type'] = type;
  }
  return { method: d.method, url: substitute(d.url.trim(), env), headers, params: toMap(d.params, env), body };
}

export function buildGraphql(d: GraphqlDraft, env: Record<string, string>): ServerRequest {
  let variables: unknown = {};
  try { variables = JSON.parse(substitute(d.variables, env) || '{}'); } catch { throw new Error('Variables are not valid JSON'); }
  return {
    method: 'POST', url: substitute(d.url.trim(), env), params: {},
    headers: { 'Content-Type': 'application/json', ...toMap(d.headers, env), ...authHeaders(d.auth, env) },
    body: JSON.stringify({ query: substitute(d.query, env), variables }),
  };
}

export const statusTone = (s: number) => (s >= 500 ? 'text-destructive' : s >= 400 ? 'text-warning' : s >= 300 ? 'text-info' : 'text-success');
export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
