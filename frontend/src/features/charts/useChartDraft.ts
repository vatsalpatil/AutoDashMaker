import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Chart, ChartSpec, ChartType, QueryResult, SavedQuery } from '@/lib/types';
import { useApi } from '@/hooks/useApi';
import type { Opts } from './format';
import { autoEncode, type ChartTemplate } from './templates';

const DEFAULT_SPEC: ChartSpec = { type: 'bar', encoding: { x: '', y: '' }, options: {} };
const PREVIEW_ROWS = 2000;

/**
 * Working copy of a chart for the studio: name, backing query, spec, and the query's rows for live preview.
 * `id` loads an existing chart; omit it to start a new one. Nothing is persisted until `save()`.
 */
export function useChartDraft(id?: string) {
  const queries = useApi<SavedQuery[]>('/queries');
  const [name, setName] = useState('Untitled chart');
  const [queryId, setQueryId] = useState('');
  const [spec, setSpec] = useState<ChartSpec>(DEFAULT_SPEC);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(id ?? '');
  const [dirty, setDirty] = useState(false);

  const loadResult = useCallback(async (qid: string, list: SavedQuery[] | null) => {
    const q = list?.find((x) => String(x.id) === qid);
    if (!q) return null;
    try {
      // save:false — previewing must not add a "saved query" row each time
      const r = await api.post<QueryResult>('/queries/run', { sql: q.sql, row_limit: PREVIEW_ROWS, save: false });
      setResult(r);
      setError(null);
      return r;
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
      return null;
    }
  }, []);

  // existing chart → fill the draft
  useEffect(() => {
    if (!id) return;
    api.get<Chart>(`/charts/${id}`).then((c) => {
      setName(c.name);
      setQueryId(c.query_id ?? '');
      setSpec({ ...c.spec, options: c.spec.options ?? {} });
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [id]);

  // (re)load rows when the query or the query list becomes known
  useEffect(() => {
    if (queryId && queries.data) loadResult(queryId, queries.data);
  }, [queryId, queries.data, loadResult]);

  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };

  const pickQuery = useCallback(async (qid: string) => {
    setQueryId(qid);
    setDirty(true);
    const r = await loadResult(qid, queries.data);
    if (r) setSpec((s) => ({ ...s, encoding: autoEncode(s.type, r) }));
  }, [loadResult, queries.data]);

  const setType = (type: ChartType) => { setSpec((s) => ({ ...s, type, encoding: autoEncode(type, result, s.encoding) })); setDirty(true); };
  const setEncoding = (patch: Partial<ChartSpec['encoding']>) => { setSpec((s) => ({ ...s, encoding: { ...s.encoding, ...patch } })); setDirty(true); };
  const setOption = (key: string, value: unknown) => setSpec((s) => {
    const options: Opts = { ...s.options };
    if (value === undefined) delete options[key]; else options[key] = value;
    setDirty(true);
    return { ...s, options };
  });
  const resetOptions = () => { setSpec((s) => ({ ...s, options: {} })); setDirty(true); };
  const applyTemplate = (tpl: ChartTemplate) => {
    setSpec((s) => ({ type: tpl.type, encoding: autoEncode(tpl.type, result, s.type === tpl.type ? s.encoding : undefined), options: { ...tpl.options } }));
    setDirty(true);
  };

  const save = useCallback(async (): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const encoding = { ...spec.encoding };
      if (encoding.ys) encoding.y = encoding.ys[0] ?? encoding.y;
      const body = { name: name.trim() || 'Untitled chart', query_id: queryId, spec: { ...spec, encoding } };
      const saved = savedId ? await api.patch<Chart>(`/charts/${savedId}`, body) : await api.post<Chart>('/charts', body);
      setSavedId(saved.id);
      setDirty(false);
      return saved.id;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }, [name, queryId, spec, savedId]);

  const columns = useMemo(() => result?.columns ?? [], [result]);

  return {
    queries: queries.data ?? [], name, setName: touch(setName), queryId, pickQuery, spec, result, columns, loading, error, setError,
    saving, savedId, dirty, setType, setEncoding, setOption, resetOptions, applyTemplate, save,
  };
}
