import { useCallback, useEffect, useRef, useState } from 'react';

export interface WsEntry { id: number; at: number; dir: 'in' | 'out' | 'sys'; data: string }
export type WsStatus = 'closed' | 'connecting' | 'open';

const MAX_LOG = 2000;

/**
 * Browser WebSocket with a bounded message log. Incoming frames are buffered and flushed to React every 150 ms,
 * so a busy stream (hundreds of messages a second) does not re-render once per message.
 */
export function useWebSocket(onMessage?: (data: string) => void) {
  const [status, setStatus] = useState<WsStatus>('closed');
  const [log, setLog] = useState<WsEntry[]>([]);
  const [received, setReceived] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const buffer = useRef<WsEntry[]>([]);
  const counter = useRef(0);
  const count = useRef(0);
  const cb = useRef(onMessage);
  cb.current = onMessage;

  const push = useCallback((dir: WsEntry['dir'], data: string) => {
    buffer.current.push({ id: ++counter.current, at: Date.now(), dir, data });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (buffer.current.length === 0) return;
      const batch = buffer.current;
      buffer.current = [];
      setLog((l) => [...l, ...batch].slice(-MAX_LOG));
      setReceived(count.current);
    }, 150);
    return () => clearInterval(t);
  }, []);

  const connect = useCallback((url: string, protocols: string[] = []) => {
    ws.current?.close();
    setStatus('connecting');
    push('sys', `Connecting to ${url}…`);
    let sock: WebSocket;
    try {
      sock = protocols.length ? new WebSocket(url, protocols) : new WebSocket(url);
    } catch (e) {
      setStatus('closed');
      push('sys', `Cannot connect: ${(e as Error).message}`);
      return;
    }
    ws.current = sock;
    sock.onopen = () => { setStatus('open'); push('sys', 'Connected'); };
    sock.onmessage = async (ev) => {
      const text = typeof ev.data === 'string' ? ev.data : ev.data instanceof Blob ? await ev.data.text() : '[binary frame]';
      count.current += 1;
      push('in', text);
      cb.current?.(text);
    };
    sock.onerror = () => push('sys', 'Connection error');
    sock.onclose = (ev) => { setStatus('closed'); push('sys', `Disconnected (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`); };
  }, [push]);

  const disconnect = useCallback(() => ws.current?.close(1000, 'client closed'), []);
  const send = useCallback((text: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return false;
    ws.current.send(text);
    push('out', text);
    return true;
  }, [push]);
  const clear = useCallback(() => { buffer.current = []; setLog([]); count.current = 0; setReceived(0); }, []);

  useEffect(() => () => ws.current?.close(), []);
  return { status, log, received, connect, disconnect, send, clear };
}
