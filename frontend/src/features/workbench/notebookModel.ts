import { readLibrary, writeLibrary, type LibItem } from '@/hooks/useLibrary';
import { readStorage } from '@/hooks/useLocalStorage';
import type { Cell } from './NotebookCell';

/** Pure notebook helpers (no React): cell factory, naming rules, persistence of names + SQL. */

const NB_KEY = 'workbench.notebook';
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

type StoredCell = { id?: string; name?: string; sql?: string };

const uid = () => Math.random().toString(36).slice(2, 10);

export function makeCell(name: string, sql = ''): Cell {
  return {
    id: uid(), name, sql, result: null, error: null, running: false,
    runCount: null, hideOutput: false, showComposed: false, saved: null,
  };
}

/** `step_N` that no cell uses yet. */
export function nextName(cells: Cell[]): string {
  const taken = new Set(cells.map((c) => c.name.toLowerCase()));
  let n = cells.length + 1;
  while (taken.has(`step_${n}`)) n++;
  return `step_${n}`;
}

/** A saved notebook: names + SQL of its cells (results are re-run, never stored). */
export interface NotebookItem extends LibItem { cells: StoredCell[] }
export const NOTEBOOKS_KEY = 'workbench.notebooks';
const STARTER: StoredCell[] = [{ name: 'step_1', sql: 'SELECT 1 AS hello' }];

export const newNotebookBody = (): Omit<NotebookItem, keyof LibItem> => ({ cells: STARTER.map((c) => ({ ...c, id: uid() })) });

/** First library: whatever single notebook the older version had saved becomes "Notebook 1". */
export function migrateNotebook(): { activeId: string; items: NotebookItem[] } | null {
  const old = readStorage<StoredCell[]>(NB_KEY, []);
  if (!Array.isArray(old) || old.length === 0) return null;
  const now = Date.now();
  return { activeId: 'nb_1', items: [{ id: 'nb_1', name: 'Notebook 1', createdAt: now, updatedAt: now, cells: old }] };
}

export const cellsFromStored = (stored: StoredCell[]): Cell[] =>
  (stored.length ? stored : STARTER).map((c, i) => ({ ...makeCell(c.name || `step_${i + 1}`, c.sql ?? ''), id: c.id || uid() }));
export const cellsToStored = (cells: Cell[]): StoredCell[] => cells.map(({ id, name, sql }) => ({ id, name, sql }));

/** Why cell `i`'s name cannot be used, or null. Mirrors the server-side checks. */
export function cellNameProblem(cells: Cell[], i: number, tableNames: Set<string>): string | null {
  const name = cells[i].name;
  if (!NAME_RE.test(name)) return 'start with a letter';
  if (tableNames.has(name.toLowerCase())) return 'is a table name';
  if (cells.slice(0, i).some((o) => o.name.toLowerCase() === name.toLowerCase())) return 'name already used';
  return null;
}

/** Add a cell with `sql` to the end of the open notebook (so the Workbench opens with it). Returns its name. */
export function appendNotebookCell(sql: string): string {
  const lib = readLibrary<NotebookItem>(NOTEBOOKS_KEY) ?? migrateNotebook() ?? { activeId: 'nb_1', items: [{ id: 'nb_1', name: 'Notebook 1', createdAt: Date.now(), updatedAt: Date.now(), cells: [] }] };
  const item = lib.items.find((i) => i.id === lib.activeId) ?? lib.items[0];
  const cells = cellsFromStored(item.cells);
  const blank = cells.length === 1 && /^SELECT 1 AS hello$/i.test(cells[0].sql.trim());
  const cell = makeCell(blank ? 'step_1' : nextName(cells), sql);
  item.cells = cellsToStored(blank ? [cell] : [...cells, cell]);
  item.updatedAt = Date.now();
  writeLibrary(NOTEBOOKS_KEY, lib);
  return cell.name;
}
