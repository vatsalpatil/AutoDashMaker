import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Database, Info, Plug, Send, Trash2, Unplug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CodeEditor } from '@/components/common/CodeEditor';
import { Button } from '@/components/ui/kit';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { parseLoose, stringify } from '@/lib/jsonTools';
import type { Dataset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWebSocket, type WsEntry } from './useWebSocket';

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });
const pretty = (data: string) => { const p = parseLoose(data); return p.value !== undefined && !p.repaired ? stringify(p.value) : data; };

function Row({ e, open, onToggle }: { e: WsEntry; open: boolean; onToggle: () => void }) {
  const Icon = e.dir === 'in' ? ArrowDown : e.dir === 'out' ? ArrowUp : Info;
  return (
    <div className="border-b">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 px-3 py-1 text-left hover:bg-accent">
        <Icon className={cn('mt-0.5 size-3.5 shrink-0', e.dir === 'in' ? 'text-success' : e.dir === 'out' ? 'text-primary' : 'text-muted-foreground')} />
        <span className="mono shrink-0 text-xs text-muted-foreground">{time(e.at)}</span>
        <span className={cn('mono min-w-0 flex-1 break-all text-xs', e.dir === 'sys' && 'italic text-muted-foreground', !open && 'line-clamp-1')}>{open ? '' : e.data}</span>
      </button>
      {open && <pre className="mono mx-3 mb-2 max-h-72 overflow-auto rounded bg-muted p-2 text-xs">{pretty(e.data)}</pre>}
    </div>
  );
}

/** WebSocket workspace: connect, send, watch the live stream, then capture JSON messages as a dataset. */
export function WebSocketPanel() {
  const [url, setUrl] = useLocalStorage('studio.ws.url', 'wss://stream.binance.com:9443/ws/btcusdt@trade');
  const [message, setMessage] = useLocalStorage('studio.ws.message', '');
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [capture, setCapture] = useState(true);
  const [limit, setLimit] = useState(1000);
  const [datasetName, setDatasetName] = useState('ws_capture');
  const [made, setMade] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const records = useRef<Record<string, unknown>[]>([]);
  const [captured, setCaptured] = useState(0);

  const ws = useWebSocket((data) => {
    if (!capture || records.current.length >= limit) return;
    const p = parseLoose(data);
    if (p.value && typeof p.value === 'object' && !Array.isArray(p.value)) records.current.push(p.value as Record<string, unknown>);
    else if (Array.isArray(p.value)) records.current.push(...(p.value.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]));
    setCaptured(records.current.length);
  });

  const end = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => { if (stick.current) end.current?.scrollIntoView({ block: 'end' }); }, [ws.log]);
  const shown = useMemo(() => (filter ? ws.log.filter((e) => e.data.toLowerCase().includes(filter.toLowerCase())) : ws.log), [ws.log, filter]);

  const connected = ws.status === 'open';
  const send = () => { if (message.trim()) ws.send(message); };
  async function makeDataset() {
    setError(null);
    try { setMade(await api.post<Dataset>('/studio/records-to-dataset', { name: datasetName, records: records.current })); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <input value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} aria-label="WebSocket URL" placeholder="wss://…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !connected) ws.connect(url); }}
          className="h-8 min-w-48 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        {connected || ws.status === 'connecting'
          ? <Button variant="secondary" icon={<Unplug className="size-4" />} label="Disconnect" onClick={ws.disconnect} />
          : <Button variant="primary" icon={<Plug className="size-4" />} label="Connect" onClick={() => ws.connect(url)} isDisabled={!url.trim()} />}
        <span className={cn('flex items-center gap-1.5 text-xs', connected ? 'text-success' : 'text-muted-foreground')}><span className={cn('size-2 rounded-full', connected ? 'bg-success' : ws.status === 'connecting' ? 'bg-warning' : 'bg-muted-foreground/40')} />{ws.status}</span>
      </div>

      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={68} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-sm">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter messages…" aria-label="Filter messages"
                className="h-7 w-48 rounded-md border border-input bg-transparent px-2 text-xs outline-none" />
              <span className="text-xs text-muted-foreground">{ws.received.toLocaleString()} received</span>
              <button type="button" onClick={() => { ws.clear(); records.current = []; setCaptured(0); setMade(null); }} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /> Clear</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto" onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
              {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">Connect to see messages. Public test stream: <code className="mono">wss://echo.websocket.org</code> echoes what you send.</p>}
              {shown.slice(-400).map((e) => <Row key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} />)}
              <div ref={end} />
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-3 py-2 text-sm">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={capture} onChange={(e) => setCapture(e.target.checked)} />Capture JSON messages</label>
              <span className="text-xs text-muted-foreground">up to</span>
              <input type="number" min={10} max={50000} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 1000)} aria-label="Capture limit" className="h-7 w-20 rounded-md border border-input bg-transparent px-2 text-xs" />
              <span className="text-xs"><b>{captured.toLocaleString()}</b> captured{captured >= limit ? ' (limit reached)' : ''}</span>
              <input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} aria-label="Dataset name" className="h-7 w-32 rounded-md border border-input bg-transparent px-2 text-xs" />
              <Button variant="primary" size="sm" icon={<Database className="size-4" />} label="Create dataset" onClick={makeDataset} isDisabled={captured === 0} />
              {made && <span className="flex items-center gap-1 text-success"><Check className="size-4" /> <Link className="underline" to={`/datasets/${made.id}`}>Open dataset</Link></span>}
              {error && <span className="text-destructive">{error}</span>}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={32} minSize={15}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-3 py-1.5 text-sm"><span className="font-medium">Message</span>
              <Button variant="primary" size="sm" icon={<Send className="size-4" />} label="Send" onClick={send} isDisabled={!connected || !message.trim()} title="Send (Ctrl+Enter)" /></div>
            <div className="min-h-0 flex-1"><CodeEditor value={message} onChange={setMessage} language="json" onRun={send} height="100%" placeholder='{ "type": "subscribe", "channel": "trades" }' /></div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
