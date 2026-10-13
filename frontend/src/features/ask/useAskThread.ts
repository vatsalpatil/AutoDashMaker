import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { AnalystResponse } from '@/lib/types';

export interface AskTurn {
  id: number;
  question: string;
  images?: string[];
  response: AnalystResponse | null;   // null while the analyst is working
  error?: string;
}

/**
 * The Ask conversation: each turn sends the recent question/SQL pairs so follow-ups ("only 2024", "by product")
 * build on the previous query. `scope` limits the analyst to one dataset; empty = every table.
 */
export function useAskThread() {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [scope, setScope] = useState('');
  const nextId = useRef(1);
  const turnsRef = useRef<AskTurn[]>([]);
  turnsRef.current = turns;

  const patch = (id: number, p: Partial<AskTurn>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const ask = useCallback(async (question: string, images: string[] = []) => {
    const q = question.trim();
    if (!q) return;
    const id = nextId.current++;
    const history = turnsRef.current
      .filter((t) => t.response?.status === 'ok' && t.response.sql)
      .slice(-3)
      .map((t) => ({ question: t.question, sql: t.response!.sql }));
    setTurns((ts) => [...ts, { id, question: q, images, response: null }]);
    try {
      const response = await api.post<AnalystResponse>('/ai/chat', { question: q, dataset_id: scope || undefined, history, images });
      patch(id, { response });
    } catch (e) {
      patch(id, { error: (e as Error).message, response: { status: 'sql_error', detail: (e as Error).message } });
    }
  }, [scope]);

  /** Reopen a saved conversation (answers keep their first rows only, to stay small). */
  const restore = useCallback((saved: { turns: AskTurn[]; scope?: string }) => {
    const ts = (saved.turns ?? []).filter((t) => t.response);
    nextId.current = Math.max(0, ...ts.map((t) => t.id)) + 1;
    setTurns(ts);
    setScope(saved.scope ?? '');
  }, []);
  return { turns, ask, scope, setScope, restore, clear: () => setTurns([]), busy: turns.some((t) => t.response === null) };
}
