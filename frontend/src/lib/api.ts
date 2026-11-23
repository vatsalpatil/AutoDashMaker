// Small fetch wrapper for the AutoDashMaker API.
import { authFetch } from '@/lib/auth';

const BASE = '/api';

/** Anything that changes data (a non-GET, except the read-only batch `/data` calls) tells listeners, so caches never serve stale results. */
const writeListeners = new Set<() => void>();
export const onWrite = (fn: () => void) => { writeListeners.add(fn); };
const isRead = (method: string, path: string) => method === 'GET' || /\/data(\?|$)/.test(path) || path.startsWith('/voice/');

async function request<T>(method: string, path: string, body?: unknown, isForm = false, signal?: AbortSignal): Promise<T> {
  const init: RequestInit = { method, headers: {}, signal };
  if (body !== undefined) {
    if (isForm) {
      init.body = body as FormData;
    } else {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  const res = await authFetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = statusMessage(res.status, res.statusText);
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') detail = data.detail;
      else if (Array.isArray(data?.detail)) detail = data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ');
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  if (!isRead(method, path)) writeListeners.forEach((fn) => fn());
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Plain-language text for HTTP failures that carry no message of their own (gateway errors during a deploy, etc.). */
export function statusMessage(status: number, text = ''): string {
  if (status === 502 || status === 503 || status === 504) return 'The server is restarting or busy (an update may be rolling out). Wait a few seconds and try again.';
  if (status === 401) return 'Your session has ended. Sign in again.';
  if (status === 413) return 'That is too large to send. Try a smaller file.';
  if (status === 429) return 'Too many requests right now. Wait a moment and try again.';
  return `${status} ${text}`.trim();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>('POST', path, body, false, signal),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>('POST', path, fd, true);
  },
  /** POST a ready-made FormData (several fields, or a Blob with its own file name). */
  form: <T>(path: string, fd: FormData) => request<T>('POST', path, fd, true),
};
