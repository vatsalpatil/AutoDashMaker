import { authFetch } from '@/lib/auth';

/** POST JSON and read the Server-Sent Events reply, calling `onEvent` for every `data:` line as it arrives. */
export async function streamPost<E>(path: string, body: unknown, onEvent: (ev: E) => void, signal?: AbortSignal): Promise<void> {
  const res = await authFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(res.status === 404 ? 'Not found' : `Request failed (${res.status})`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    let chunk: ReadableStreamReadResult<string>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new Error('The connection to the server dropped while the AI was working (the network or a proxy cut a long request). Nothing was lost — press the button again to retry.');
    }
    const { value, done } = chunk;
    if (done) return;
    buf += value;
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const p of parts) if (p.startsWith('data:')) onEvent(JSON.parse(p.slice(5)) as E);
  }
}
