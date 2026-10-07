import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibrary, type LibItem } from '@/hooks/useLibrary';
import { readStorage, useLocalStorage } from '@/hooks/useLocalStorage';

export interface Observation { ok: boolean; text: string; columns?: string[]; rows?: Record<string, unknown>[]; row_count?: number; ms?: number }
export interface Proposal { kind: 'add_cell' | 'edit_cell'; sql: string; run: boolean; applied?: boolean; before?: string; undone?: boolean }
export interface Step { n: number; thought: string; tool: string; args: Record<string, unknown>; obs?: Observation; proposal?: Proposal }
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  steps: Step[];
  status: 'running' | 'done' | 'error' | 'stopped';
  sql?: string | null;
  seconds?: number;
}
export type AgentMode = 'agent' | 'ask';
export interface AgentContext { activeSql: string; error: string | null; cells: { name: string; sql: string }[] }
/** What the notebook can do for the agent: add a cell below the active one / rewrite the active one (and run it). */
export interface NotebookActions { add: (sql: string, run: boolean) => void; edit: (sql: string, run: boolean) => void; current: () => string }

type AgentEvent =
  | { type: 'step'; n: number; thought: string; tool: string; args: Record<string, unknown> }
  | ({ type: 'observation'; n: number } & Observation)
  | { type: 'action'; n: number; kind: Proposal['kind']; sql: string; run: boolean }
  | { type: 'final'; text: string; sql?: string | null; seconds?: number }
  | { type: 'error'; message: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const KEEP = 40;           // messages kept per chat
const MAX_CHATS = 30;
const CHATS_KEY = 'workbench.agent.chats';
const DEFAULT_TITLE = 'New chat';

export interface ChatItem extends LibItem { messages: ChatMessage[] }

/** The single chat of the older version becomes the first saved chat. */
function migrateChat(): { activeId: string; items: ChatItem[] } | null {
  const old = readStorage<ChatMessage[]>('workbench.agent.chat', []);
  if (!Array.isArray(old) || old.length === 0) return null;
  const now = Date.now();
  return { activeId: 'chat_1', items: [{ id: 'chat_1', name: 'Earlier chat', createdAt: now, updatedAt: now, messages: old }] };
}

/** Chat state + the streaming call to /api/ai/agent. Steps arrive as Server-Sent Events and are shown as they happen. */
export function useAgent(getContext: () => AgentContext, actions: NotebookActions) {
  const chats = useLibrary<ChatItem>(CHATS_KEY, () => ({ messages: [] }), migrateChat);
  const messages = chats.active.messages;
  const owner = useRef<Record<string, string>>({});   // message id -> chat id: a running answer keeps filling its own chat after you switch
  const setMessages = useCallback((fn: (ms: ChatMessage[]) => ChatMessage[], chatId = chats.active.id) =>
    chats.update(chatId, (c) => ({ messages: fn(c.messages) })), [chats.active.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [prefs, setPrefs] = useLocalStorage('workbench.agent.prefs', { mode: 'agent' as AgentMode, autoApprove: true });
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const live = useRef<string | null>(null);   // id of the assistant message being streamed

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200);
    return () => clearInterval(id);
  }, [busy]);

  // chats saved while a run was in flight (page reload) must not show a spinner forever
  useEffect(() => {
    for (const c of chats.items) {
      if (c.messages.some((m) => m.status === 'running')) {
        chats.update(c.id, (x) => ({ messages: x.messages.map((m) => (m.status === 'running' ? { ...m, status: 'stopped' as const, text: m.text || 'Stopped.' } : m)) }));
      }
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)), owner.current[id]), [setMessages]);

  /** Apply a proposal; returns the active cell's SQL from before an edit, so it can be undone. */
  const apply = useCallback((p: Proposal) => {
    if (p.kind === 'add_cell') { actions.add(p.sql, p.run); return undefined; }
    const before = actions.current();
    actions.edit(p.sql, p.run);
    return before;
  }, [actions]);

  const proposalOf = (messageId: string, n: number) => messages.find((m) => m.id === messageId)?.steps.find((x) => x.n === n)?.proposal;
  const setProposal = (messageId: string, n: number, change: Partial<Proposal>) =>
    patch(messageId, (m) => ({ ...m, steps: m.steps.map((x) => (x.n === n && x.proposal ? { ...x, proposal: { ...x.proposal, ...change } } : x)) }));

  /** Apply a proposal the user approved by hand (auto-approve off). Side effects stay out of the state updater (React may run it twice). */
  const approve = useCallback((messageId: string, n: number) => {
    const p = proposalOf(messageId, n);
    if (!p || p.applied) return;
    setProposal(messageId, n, { applied: true, before: apply(p) });
  }, [messages, patch, apply]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handle = useCallback((id: string, ev: AgentEvent) => {
    if (ev.type === 'step') patch(id, (m) => ({ ...m, steps: [...m.steps, { n: ev.n, thought: ev.thought, tool: ev.tool, args: ev.args }] }));
    else if (ev.type === 'observation') {
      const { type: _t, n, ...obs } = ev;
      patch(id, (m) => ({ ...m, steps: m.steps.map((s) => (s.n === n ? { ...s, obs } : s)) }));
    } else if (ev.type === 'action') {
      const auto = prefs.autoApprove;
      const before = auto ? apply(ev) : undefined;
      patch(id, (m) => ({ ...m, steps: m.steps.map((s) => (s.n === ev.n ? { ...s, proposal: { kind: ev.kind, sql: ev.sql, run: ev.run, applied: auto, before } } : s)) }));
    } else if (ev.type === 'final') patch(id, (m) => ({ ...m, text: ev.text, sql: ev.sql, seconds: ev.seconds, status: 'done' }));
    else patch(id, (m) => ({ ...m, text: ev.message, status: 'error' }));
  }, [patch, apply, prefs.autoApprove]);

  const send = useCallback(async (task: string) => {
    const text = task.trim();
    if (!text || busy) return;
    const ctx = getContext();
    const history = messages.filter((m) => m.status === 'done' && m.text).slice(-6).map((m) => ({ role: m.role, content: m.text }));
    const id = uid();
    live.current = id;
    owner.current[id] = chats.active.id;
    setMessages((ms) => {
      const user: ChatMessage = { id: uid(), role: 'user', text, steps: [], status: 'done' };
      const reply: ChatMessage = { id, role: 'assistant', text: '', steps: [], status: 'running' };
      return [...ms, user, reply].slice(-KEEP);
    });
    if (chats.active.name === DEFAULT_TITLE) chats.rename(chats.active.id, text.replace(/\s+/g, ' ').slice(0, 50));
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    const t0 = Date.now();
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ task: text, mode: prefs.mode, history, active_sql: ctx.activeSql, error: ctx.error, cells: ctx.cells }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()).slice(0, 300) || `HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const p of parts) if (p.startsWith('data:')) handle(id, JSON.parse(p.slice(5)) as AgentEvent);
      }
      patch(id, (m) => (m.status === 'running' ? { ...m, status: 'error', text: 'The assistant stopped without an answer.' } : m));
    } catch (e) {
      const stopped = ctl.signal.aborted;
      patch(id, (m) => ({ ...m, status: stopped ? 'stopped' : 'error', text: stopped ? 'Stopped.' : (e as Error).message }));
    } finally {
      patch(id, (m) => ({ ...m, seconds: m.seconds ?? Math.round((Date.now() - t0) / 100) / 10 }));
      abort.current = null;
      live.current = null;
      setBusy(false);
    }
  }, [busy, messages, getContext, prefs.mode, setMessages, handle, patch]);

  return {
    messages, busy, elapsed, prefs,
    setPrefs: (p: Partial<typeof prefs>) => setPrefs((x) => ({ ...x, ...p })),
    send, approve,
    /** Put the cell back the way it was before the agent's edit. */
    undo: (messageId: string, n: number) => {
      const p = proposalOf(messageId, n);
      if (!p?.before || p.undone) return;
      actions.edit(p.before, false);
      setProposal(messageId, n, { undone: true });
    },
    stop: () => abort.current?.abort(),
    /** Start a fresh chat; the current one stays in the history (an empty chat is reused, not duplicated). */
    newChat: () => { if (!busy && messages.length > 0) { chats.create(DEFAULT_TITLE); if (chats.items.length >= MAX_CHATS) chats.remove(chats.items[chats.items.length - 1].id); } },
    chats: {
      items: chats.items, activeId: chats.active.id,
      open: (id: string) => { if (!busy) chats.select(id); },
      rename: chats.rename,
      remove: (id: string) => { if (!busy) chats.remove(id); },
    },
  };
}
