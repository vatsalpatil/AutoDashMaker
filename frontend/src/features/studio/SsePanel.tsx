import { useRef, useState } from 'react';
import { Loader2, Play, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';

interface SseEvent { id: number; event: string; data: string }

/** Parse the text of an SSE stream into events (blank-line separated; `event:` and `data:` fields). */
export function parseSse(buffer: string): { events: Omit<SseEvent, 'id'>[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  const events = parts.filter(Boolean).map((block) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    return { event, data: data.join('\n') };
  });
  return { events, rest };
}

/** Server-Sent Events: the server relays the stream (no CORS limits); events appear live until stopped. */
export function SsePanel() {
  const [url, setUrl] = useLocalStorage('studio.sse.url', '');
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const counter = useRef(0);

  async function start() {
    if (!url.trim()) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true);
    try {
      const res = await fetch('/api/studio/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim(), seconds: 120 }), signal: ctl.signal });
      if (!res.ok || !res.body) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { events: got, rest } = parseSse(buf + value);
        buf = rest;
        if (got.length) setEvents((e) => [...e, ...got.map((g) => ({ ...g, id: ++counter.current }))].slice(-1000));
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setEvents((l) => [...l, { id: ++counter.current, event: 'error', data: (e as Error).message }]);
    } finally { setRunning(false); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') start(); }} spellCheck={false} aria-label="SSE URL"
          placeholder="https://example.com/events (Server-Sent Events endpoint)"
          className="h-8 min-w-48 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        {running
          ? <Button variant="outline" icon={<Square className="size-4" />} label="Stop" onClick={() => abort.current?.abort()} />
          : <Button variant="primary" icon={<Play className="size-4" />} label="Listen" onClick={start} isDisabled={!url.trim()} />}
        {running && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{events.length} events</span>
        <Button variant="ghost" icon={<Trash2 className="size-4" />} aria-label="Clear" onClick={() => setEvents([])} />
      </div>
      <ul className="min-h-0 flex-1 divide-y overflow-auto font-mono text-xs">
        {events.length === 0 && <li className="p-4 font-sans text-sm text-muted-foreground">Press Listen to stream events. The server holds the connection for up to two minutes.</li>}
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 px-3 py-1.5">
            <span className={cn('w-20 shrink-0 font-semibold', e.event === 'error' ? 'text-destructive' : 'text-info')}>{e.event}</span>
            <span className="whitespace-pre-wrap break-all">{e.data}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
