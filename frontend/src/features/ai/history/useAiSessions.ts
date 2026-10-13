import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type SessionKind = 'generate' | 'ask' | 'edit' | 'create';
export interface SessionItem { id: string; kind: SessionKind; ref_id: string | null; title: string; summary: string; created_at: string; updated_at: string }

/** Saved AI chats of one kind (optionally for one dashboard), kept on the server so they can be reopened later on any device.
 * `autosave(state, title)` writes the current chat a moment after it changes (creating it on first save). */
export function useAiSessions<S>(kind: SessionKind, refId?: string) {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  idRef.current = currentId;

  const reload = useCallback(() => {
    const q = new URLSearchParams({ kind, ...(refId ? { ref_id: refId } : {}) });
    api.get<SessionItem[]>(`/ai/sessions?${q}`).then(setItems).catch(() => {});
  }, [kind, refId]);
  useEffect(reload, [reload]);

  const saveNow = useCallback(async (state: S, title: string, summary = '') => {
    setSaving(true);
    try {
      if (idRef.current) await api.put(`/ai/sessions/${idRef.current}`, { state, title, summary });
      else {
        const { id } = await api.post<{ id: string }>('/ai/sessions', { kind, ref_id: refId, state, title, summary });
        idRef.current = id;
        setCurrentId(id);
      }
      reload();
    } catch { /* saving history must never break the chat */ } finally { setSaving(false); }
  }, [kind, refId, reload]);

  const autosave = useCallback((state: S, title: string, summary = '') => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(state, title, summary), 1200);
  }, [saveNow]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const open = useCallback(async (id: string): Promise<S | null> => {
    if (timer.current) clearTimeout(timer.current);
    try {
      const row = await api.get<{ state: S }>(`/ai/sessions/${id}`);
      idRef.current = id;
      setCurrentId(id);
      return row.state;
    } catch { return null; }
  }, []);
  const startNew = useCallback(() => { if (timer.current) clearTimeout(timer.current); idRef.current = null; setCurrentId(null); }, []);
  const rename = useCallback(async (id: string, title: string) => { await api.put(`/ai/sessions/${id}`, { title }); reload(); }, [reload]);
  const remove = useCallback(async (id: string) => {
    await api.del(`/ai/sessions/${id}`);
    if (idRef.current === id) startNew();
    reload();
  }, [reload, startNew]);

  return { items, currentId, saving, autosave, saveNow, open, startNew, rename, remove, reload };
}

export type AiSessions = ReturnType<typeof useAiSessions<unknown>>;
