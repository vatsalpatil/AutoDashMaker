import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { QB_EVENT, takeIncoming, type QbIncoming } from './qbHandoff';
import type { QueryResult } from '@/lib/types';
import { emptySpec, hasSource, kindOf, type Kind, type QbSchema, type QbSpec, type QbStage } from './qbModel';

const kindOfValue = (v: unknown): Kind => (typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v) ? 'time' : 'text');

/**
 * State of the query builder: the spec (remembered), the live result (debounced auto-run), the compiled SQL,
 * and the column lists of earlier stages (so a later stage can pick from what the previous one produced).
 */
export function useQueryBuilder() {
  const schema = useApi<QbSchema>('/qb/schema');
  const [spec, setSpec] = useLocalStorage<QbSpec>('qb.spec', emptySpec());
  const [result, setResult] = useState<QueryResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);        // the step is not complete yet / the SQL failed
  const [running, setRunning] = useState(false);
  const [sql, setSql] = useState('');
  const [prev, setPrev] = useState<Record<number, { name: string; kind: Kind }[]>>({});
  const [previewAt, setPreviewAt] = useState<number | null>(null);   // show the data up to this stage instead of the end
  const [applied, setApplied] = useState<{ spec: QbSpec; upto?: number } | null>(() => (hasSource(spec) ? { spec } : null));   // what the preview shows: only changes on Apply
  const [history, setHistory] = useState<QbSpec[]>([]);   // queries from before each AI build, for Undo
  const tick = useRef(0);
  const [notice, setNotice] = useState<Pick<QbIncoming, 'fidelity' | 'notes'> | null>(null);   // how the last query from the Workbench was understood

  const setStage = useCallback((i: number, patch: Partial<QbStage>) =>
    setSpec((s) => ({ stages: s.stages.map((st, j) => (j === i ? { ...st, ...patch } : st)) })), [setSpec]);
  const addStage = useCallback(() => setSpec((s) => ({ stages: [...s.stages, { limit: 1000 }] })), [setSpec]);
  const removeStage = useCallback((i: number) => setSpec((s) => ({ stages: s.stages.length > 1 ? s.stages.filter((_, j) => j !== i) : [{ limit: 1000 }] })), [setSpec]);
  const reset = useCallback(() => { setSpec(emptySpec()); setResult(null); setSql(''); setPreviewAt(null); setApplied(null); }, [setSpec]);
  const replaceSpec = useCallback((next: QbSpec) => {
    setHistory((h) => [...h.slice(-9), spec]);
    setSpec(next); setPreviewAt(null); setApplied({ spec: next });
  }, [spec, setSpec]);
  useEffect(() => {   // a query sent from the Workbench (this page stays mounted, so listen as well as check on load)
    const take = () => { const m = takeIncoming(); if (m) { replaceSpec(m.spec); setNotice({ fidelity: m.fidelity, notes: m.notes }); } };
    take();
    window.addEventListener(QB_EVENT, take);
    return () => window.removeEventListener(QB_EVENT, take);
  }, [replaceSpec]);
  const undo = useCallback(() => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1)); setSpec(prev); setPreviewAt(null);
    setApplied(hasSource(prev) ? { spec: prev } : null);
  }, [history, setSpec]);
  const apply = useCallback((at: number | null = previewAt) => setApplied({ spec, upto: at != null ? at + 1 : undefined }), [spec, previewAt]);
  const preview = useCallback((i: number | null) => { setPreviewAt(i); setApplied({ spec, upto: i != null ? i + 1 : undefined }); }, [spec]);
  const dirty = JSON.stringify(applied?.spec ?? null) !== JSON.stringify(hasSource(spec) ? spec : null) || (applied?.upto ?? null) !== (previewAt != null ? previewAt + 1 : null);

  useEffect(() => {
    const id = ++tick.current;
    const stale = () => id !== tick.current;
    if (!applied) { setResult(null); setSql(''); setHint(null); return; }
    const { spec: run, upto } = applied;
    const t = setTimeout(async () => {
      setRunning(true);
      try {
        const [res, ...heads] = await Promise.all([
          api.post<QueryResult>('/qb/run', { spec: run, upto, row_limit: 5000 }),
          ...run.stages.slice(0, -1).map((_, i) => api.post<QueryResult>('/qb/run', { spec: run, upto: i + 1, row_limit: 1 })),
        ]);
        if (stale()) return;
        setResult(res); setSql(res.sql); setHint(null);
        setPrev(Object.fromEntries(heads.map((h, i) => [i + 1, h.columns.map((c) => ({ name: c, kind: h.rows[0] ? kindOfValue(h.rows[0][c]) : kindOf('') }))])));
      } catch (e) {
        if (stale()) return;
        setHint((e as Error).message);
        api.post<{ sql: string }>('/qb/compile', { spec: run, upto }).then((r) => !stale() && setSql(r.sql)).catch(() => {});
      } finally {
        if (!stale()) setRunning(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [applied]);

  return { schema, spec, setSpec, setStage, addStage, removeStage, reset, apply, preview, dirty, replaceSpec, undo, canUndo: history.length > 0, notice, clearNotice: () => setNotice(null), appliedSpec: applied?.upto ? null : applied?.spec ?? null, result, hint, running, sql, prev, previewAt, setPreviewAt };
}
