import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { QueryResult } from '@/lib/types';
import type { Cell } from './NotebookCell';
import type { CodeEditorHandle } from '@/components/common/CodeEditor';
import { useLibrary } from '@/hooks/useLibrary';
import { cellsFromStored, cellsToStored, makeCell, migrateNotebook, newNotebookBody, nextName, NOTEBOOKS_KEY, type NotebookItem } from './notebookModel';

/**
 * Notebook state + cell actions: add / remove / move / run / run all / format / insert at cursor.
 * Presentation lives in NotebookView; saved-query actions live in useSavedQueries.
 */
export function useNotebook() {
  const library = useLibrary<NotebookItem>(NOTEBOOKS_KEY, newNotebookBody, migrateNotebook);
  const [cells, setCells] = useState<Cell[]>(() => cellsFromStored(library.active.cells));
  const [activeId, setActiveId] = useState('');
  const [runningAll, setRunningAll] = useState(false);

  const cellsRef = useRef(cells);              // always-current cells for async actions
  const execRef = useRef(0);                   // Jupyter-style execution counter
  const editorRefs = useRef<Record<string, CodeEditorHandle | null>>({});

  const activeIndex = Math.max(0, cells.findIndex((c) => c.id === activeId));
  const active: Cell | undefined = cells[activeIndex];

  // the open notebook is saved as you work (only when something actually changed)
  useEffect(() => {
    const stored = cellsToStored(cells);
    if (JSON.stringify(stored) !== JSON.stringify(library.active.cells)) library.update(library.active.id, { cells: stored });
  }, [cells]);  // eslint-disable-line react-hooks/exhaustive-deps

  /** Every state change goes through here so `cellsRef` is current when async actions read it. */
  function commit(updater: (cs: Cell[]) => Cell[]) {
    // computed from the ref right away (not inside setCells' updater, which React may run later): a caller that adds a
    // cell and immediately runs it must already find it in `cellsRef`
    const next = updater(cellsRef.current);
    cellsRef.current = next;
    setCells(next);
  }
  const update = (id: string, patch: Partial<Cell>) => commit((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const getCell = (id: string) => cellsRef.current.find((c) => c.id === id);
  const registerRef = (id: string) => (el: CodeEditorHandle | null) => { editorRefs.current[id] = el; };

  function focusCell(id: string) {
    setActiveId(id);
    requestAnimationFrame(() => editorRefs.current[id]?.focus());
  }

  /** Insert a cell after `afterId` (or at the end) and make it active. */
  function addCell(afterId: string | null, sql = '', extra: Partial<Cell> = {}): string {
    const cell = { ...makeCell(nextName(cellsRef.current), sql), ...extra };
    commit((cs) => {
      const at = afterId ? cs.findIndex((c) => c.id === afterId) + 1 : cs.length;
      return [...cs.slice(0, at), cell, ...cs.slice(at)];
    });
    focusCell(cell.id);
    return cell.id;
  }

  function removeCell(id: string) {
    const idx = cellsRef.current.findIndex((c) => c.id === id);
    const remaining = cellsRef.current.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const fresh = makeCell('step_1');
      commit(() => [fresh]);
      focusCell(fresh.id);
      return;
    }
    commit(() => remaining);
    if (activeId === id) focusCell(remaining[Math.min(idx, remaining.length - 1)].id);
  }

  function moveCell(id: string, dir: -1 | 1) {
    commit((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  /** Run one cell; earlier cells it references by name are chained in on the server. */
  async function runCell(id: string, sqlOverride?: string): Promise<boolean> {
    const snapshot = cellsRef.current;
    const idx = snapshot.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    const payload = snapshot.map((c) => ({ name: c.name, sql: c.id === id && sqlOverride !== undefined ? sqlOverride : c.sql }));
    update(id, { running: true, error: null });
    const n = ++execRef.current;
    try {
      const r = await api.post<QueryResult & { chained?: boolean }>('/queries/run-cell', { cells: payload, index: idx });
      update(id, { running: false, result: r, error: null, runCount: n, hideOutput: false });
      return true;
    } catch (e) {
      update(id, { running: false, result: null, error: (e as Error).message, runCount: n, hideOutput: false });
      return false;
    }
  }

  async function runAll() {
    setRunningAll(true);
    try {
      for (const id of cellsRef.current.map((c) => c.id)) {
        if (!getCell(id)?.sql.trim()) continue;
        if (!(await runCell(id))) break; // stop at the first failing cell, like a notebook
      }
    } finally {
      setRunningAll(false);
    }
  }

  function runAndNext(id: string) {
    const cs = cellsRef.current;
    const idx = cs.findIndex((c) => c.id === id);
    runCell(id);
    if (idx === cs.length - 1) addCell(id);
    else focusCell(cs[idx + 1].id);
  }

  async function formatCell(id: string) {
    const cell = getCell(id);
    if (!cell) return;
    try {
      const r = await api.post<{ sql: string }>('/queries/format', { sql: cell.sql });
      update(id, { sql: r.sql });
    } catch (e) {
      update(id, { error: (e as Error).message });
    }
  }

  /** Insert text at the active cell's cursor (replacing any selection). */
  function insertText(text: string) {
    if (!active) return;
    const handle = editorRefs.current[active.id];
    if (handle) handle.insertText(text, true);
    else update(active.id, { sql: active.sql + (active.sql && !/\s$/.test(active.sql) ? ' ' : '') + text });
  }

  function clearOutputs() {
    commit((cs) => cs.map((c) => ({ ...c, result: null, error: null, runCount: null })));
    execRef.current = 0;
  }

  /** Show another notebook's cells (results are not kept: run it again). */
  function show(item: NotebookItem) {
    commit(() => cellsFromStored(item.cells));
    setActiveId('');
    execRef.current = 0;
  }
  const notebooks = {
    items: library.items,
    activeId: library.active.id,
    active: library.active,
    open: (id: string) => { const item = library.items.find((i) => i.id === id); if (item && id !== library.active.id) { library.select(id); show(item); } },
    create: () => show(library.create(`Notebook ${library.items.length + 1}`)),
    duplicate: (id: string) => { const copy = library.duplicate(id); if (copy) show(copy); },
    rename: library.rename,
    remove: (id: string) => {
      const rest = library.items.filter((i) => i.id !== id);
      library.remove(id);
      if (id === library.active.id) show(rest[0] ?? { ...library.active, cells: [] });
    },
  };

  return {
    cells, active, activeIndex, setActiveId, runningAll,
    update, commit, getCell, registerRef, focusCell,
    addCell, removeCell, moveCell, runCell, runAll, runAndNext, formatCell, insertText, clearOutputs, notebooks,
  };
}

export type Notebook = ReturnType<typeof useNotebook>;
