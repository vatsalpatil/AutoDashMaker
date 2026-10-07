import { AlignLeft, BarChart3, ChevronDown, ChevronRight, ChevronUp, Code2, Copy, Loader2, Play, Plus, Save, Trash2, ArrowDown, ArrowUp, Blocks } from 'lucide-react';
import { Badge } from '@/components/ui/kit';
import type { QueryResult, SavedQuery } from '@/lib/types';
import type { SQLNamespace } from '@codemirror/lang-sql';
import { CodeEditor, type CodeEditorHandle } from '@/components/common/CodeEditor';
import { CellAssist } from './CellAssist';
import { DataGrid } from '@/components/common/DataGrid';
import { useGridToolbar } from '@/hooks/useGridToolbar';

/** One SQL cell of the notebook. `name` doubles as a table name that later cells can query. */
export interface Cell {
  id: string;
  name: string;
  sql: string;
  result: (QueryResult & { chained?: boolean }) | null;
  error: string | null;
  running: boolean;
  runCount: number | null;   // Jupyter-style execution counter: In [3]
  hideOutput: boolean;
  showComposed: boolean;
  saved: SavedQuery | null;  // saved query this cell is editing, if any
}

interface Props {
  cell: Cell;
  index: number;
  total: number;
  active: boolean;
  nameProblem: string | null;
  registerRef: (el: CodeEditorHandle | null) => void;
  schema: SQLNamespace;
  onFocus: () => void;
  onName: (v: string) => void;
  onSql: (v: string) => void;
  onRun: () => void;
  onRunAndNext: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddBelow: () => void;
  onFormat: () => void;
  onToggleOutput: () => void;
  onToggleComposed: () => void;
  onSaveQuery: () => void;
  onUpdateSaved: () => void;
  onDetach: () => void;
  onSaveChart: () => void;
  onOpenBuilder: () => void;
  assistCells: { name: string; sql: string }[];  // earlier cells the AI may reference
}

const iconBtn = 'rounded p-1 text-muted-foreground/70 hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent ';

export function NotebookCell(p: Props) {
  const [toolbar, setToolbar] = useGridToolbar();
  const { cell, active } = p;
  const dirty = cell.saved && cell.sql.trim() !== cell.saved.sql.trim();
  const gutter = cell.running ? '[*]' : cell.runCount ? `[${cell.runCount}]` : '[ ]';

  return (
    <section
      onFocusCapture={p.onFocus}
      onMouseDown={p.onFocus}
      className={`flex border-b border-border border-l-[3px] ${active ? 'border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/10' : 'border-l-transparent'}`}
    >
      {/* Jupyter-style gutter */}
      <div className="flex w-16 shrink-0 flex-col items-end gap-1 border-r border-border px-2 pt-3">
        <span className="mono text-xs text-muted-foreground/70">In {gutter}:</span>
        <button type="button" onClick={p.onRun} disabled={cell.running || !cell.sql.trim()} title="Run cell (Ctrl+Enter)"
          className="rounded-full bg-primary p-1.5 text-primary-foreground hover:bg-primary/85 disabled:opacity-40">
          {cell.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        {/* cell header: name + actions */}
        <div className="flex flex-wrap items-center gap-1 px-3 pt-2">
          <input
            value={cell.name}
            onChange={(e) => p.onName(e.target.value.replace(/[^A-Za-z0-9_]/g, '_'))}
            spellCheck={false}
            aria-label="Cell name"
            title="Later cells can query this cell by name, like a table"
            className={`mono w-36 rounded-sm border bg-transparent px-1.5 py-0.5 text-xs outline-hidden focus:border-blue-500 ${p.nameProblem ? 'border-destructive/30 text-destructive' : 'border-transparent text-muted-foreground hover:border-input'}`}
          />
          {p.nameProblem && <span className="text-[11px] text-destructive">{p.nameProblem}</span>}
          <div className="ml-auto flex items-center">
            <button type="button" className={iconBtn} onClick={p.onFormat} disabled={!cell.sql.trim()} title="Format SQL"><AlignLeft className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={p.onOpenBuilder} disabled={!cell.sql.trim()} title="Open in Query Builder"><Blocks className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={p.onSaveQuery} disabled={!cell.result} title={cell.saved ? 'Save as a new query' : 'Save query'}><Save className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={p.onSaveChart} disabled={!cell.result} title="Save result as chart"><BarChart3 className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={() => p.onMove(-1)} disabled={p.index === 0} title="Move up"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={() => p.onMove(1)} disabled={p.index === p.total - 1} title="Move down"><ArrowDown className="h-4 w-4" /></button>
            <button type="button" className={iconBtn} onClick={p.onAddBelow} title="Add cell below"><Plus className="h-4 w-4" /></button>
            <button type="button" className={`${iconBtn} hover:!text-destructive`} onClick={p.onDelete} title="Delete cell"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>

        {cell.saved && (
          <div className="mx-3 mt-1 flex flex-wrap items-center gap-2 rounded-sm bg-blue-50 px-2 py-1 text-xs dark:bg-blue-950/40">
            <span>Editing saved query <strong>“{cell.saved.name}”</strong></span>
            {dirty && <Badge variant="warning" label="unsaved changes" />}
            <button type="button" onClick={p.onUpdateSaved} disabled={!dirty}
              className="ml-auto rounded-sm bg-primary px-2 py-0.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">Update saved query</button>
            <button type="button" onClick={p.onDetach} className="text-muted-foreground hover:underline">Detach</button>
          </div>
        )}

        <CodeEditor
          ref={p.registerRef}
          value={cell.sql}
          onChange={p.onSql}
          language="sql"
          schema={p.schema}
          onRun={p.onRun}
          onRunNext={p.onRunAndNext}
          onFocus={p.onFocus}
          minHeight="4.5rem"
          maxHeight="24rem"
          placeholder="SELECT … — reference earlier cells by name, e.g. SELECT * FROM step_1"
        />

        <CellAssist sql={cell.sql} error={cell.error} cells={p.assistCells} onApply={p.onSql} />

        {/* output */}
        {(cell.result || cell.error) && (
          <div className="border-t border-border">
            <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-1.5">
              <button type="button" onClick={p.onToggleOutput} className="text-muted-foreground/70 hover:text-foreground" aria-label={cell.hideOutput ? 'Show output' : 'Hide output'}>
                {cell.hideOutput ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <span className="mono text-xs text-muted-foreground/70">Out {cell.runCount ? `[${cell.runCount}]` : ''}:</span>
              {cell.error && <Badge variant="red" label="error" />}
              {cell.result && (
                <>
                  <Badge variant="green" label={`${cell.result.row_count} rows`} />
                  <Badge variant="neutral" label={`${cell.result.duration_ms} ms`} />
                  {cell.result.cached && <Badge variant="neutral" label="cached" />}
                  {cell.result.warnings.map((w, i) => <Badge key={i} variant="warning" label={w} />)}
                  {cell.result.chained && (
                    <button type="button" onClick={p.onToggleComposed} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">
                      <Code2 className="h-3.5 w-3.5" /> {cell.showComposed ? 'Hide' : 'View'} combined query
                    </button>
                  )}
                </>
              )}
              {cell.result && !cell.hideOutput && (
                <button type="button" onClick={() => setToolbar()} aria-pressed={toolbar} aria-label={toolbar ? 'Hide search and export' : 'Show search and export'}
                  title={toolbar ? 'Hide search, columns and export' : 'Show search, columns and export'}
                  className="ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  {toolbar ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
            {!cell.hideOutput && (
              <>
                {cell.error && <p className="whitespace-pre-wrap border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{cell.error}</p>}
                {cell.result && cell.showComposed && (
                  <div className="relative border-t border-border bg-muted">
                    <button type="button" onClick={() => navigator.clipboard?.writeText(cell.result!.sql)} title="Copy combined query"
                      className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground/70 hover:bg-accent hover:text-foreground"><Copy className="h-4 w-4" /></button>
                    <pre className="mono max-h-64 overflow-auto whitespace-pre-wrap p-3 pr-10 text-xs text-foreground">{cell.result.sql}</pre>
                  </div>
                )}
                {cell.result && <DataGrid bare maxHeight="360px" columns={cell.result.columns} rows={cell.result.rows} />}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
