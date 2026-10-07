import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eraser, Play, Plus, Sparkles } from 'lucide-react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SaveChartModal } from '@/components/SaveChartModal';
import { Button } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { sendToBuilder } from '@/features/query-builder/qbHandoff';
import { NotebookCell } from './NotebookCell';
import { cellNameProblem } from './notebookModel';
import type { Notebook } from './useNotebook';
import type { useSavedQueries } from './useSavedQueries';

/** The centre column: toolbar, the stack of cells, and the "save result as chart" dialog. */
export function NotebookView({ nb, saved, tableNames, error, onDismissError, aiOpen, onToggleAi }: {
  nb: Notebook;
  saved: ReturnType<typeof useSavedQueries>;
  tableNames: Set<string>;
  error: string | null;
  onDismissError: () => void;
  aiOpen: boolean;
  onToggleAi: () => void;
}) {
  const [chartFor, setChartFor] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const nav = useNavigate();
  /** A cell that queries earlier cells is sent as its combined query, so the builder sees the whole pipeline. */
  const openInBuilder = async (c: Notebook['cells'][number]) => {
    try { await sendToBuilder(c.result?.chained ? c.result.sql : c.sql); nav('/builder'); } catch (e) { setBuilderError((e as Error).message); }
  };
  // SQL completion: every table's columns (metadata only) plus the cell names, which are queryable like tables
  const columns = useApi<Record<string, string[]>>('/datasets/columns').data;
  const cellNames = nb.cells.map((c) => c.name).join(',');
  const schema = useMemo(() => ({ ...columns, ...Object.fromEntries(cellNames.split(',').filter(Boolean).map((n) => [n, [] as string[]])) }), [columns, cellNames]);
  const chartCell = nb.cells.find((c) => c.id === chartFor);

  return (
    <div className="flex min-h-0 min-w-[16rem] flex-1 flex-col bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <input value={nb.notebooks.active.name} onChange={(e) => nb.notebooks.rename(nb.notebooks.activeId, e.target.value)} aria-label="Notebook name"
          className="mr-2 w-44 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-base font-semibold outline-none hover:border-input focus:border-ring" />
        <Button variant="primary" size="sm" label={nb.runningAll ? 'Running…' : 'Run all'} icon={<Play className="h-4 w-4" />}
          onClick={nb.runAll} isDisabled={nb.runningAll} />
        <Button variant="secondary" size="sm" label="Add cell" icon={<Plus className="h-4 w-4" />} onClick={() => nb.addCell(null)} />
        <Button variant="secondary" size="sm" label="Clear outputs" icon={<Eraser className="h-4 w-4" />} onClick={nb.clearOutputs} />
        <Button variant="ghost" size="sm" label="New notebook" onClick={nb.notebooks.create} />
        <span className="hidden text-xs text-muted-foreground/70 lg:inline">
          Shift+Enter run &amp; next · Ctrl+Enter run · query earlier cells by name
        </span>
        <div className="ml-auto">
          <Button variant={aiOpen ? 'primary' : 'secondary'} size="sm" label="AI Assistant" icon={<Sparkles className="h-4 w-4" />} onClick={onToggleAi} aria-pressed={aiOpen} />
        </div>
      </div>
      {builderError && <div className="border-b px-3 py-2"><ErrorBanner message={builderError} onDismiss={() => setBuilderError(null)} /></div>}
      {error && <div className="border-b px-3 py-2"><ErrorBanner message={error} onDismiss={onDismissError} /></div>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {nb.cells.map((c, i) => (
          <NotebookCell
            key={c.id}
            cell={c}
            index={i}
            total={nb.cells.length}
            active={c.id === nb.active?.id}
            nameProblem={cellNameProblem(nb.cells, i, tableNames)}
            registerRef={nb.registerRef(c.id)}
            schema={schema}
            onFocus={() => nb.setActiveId(c.id)}
            onName={(v) => nb.update(c.id, { name: v })}
            onSql={(v) => nb.update(c.id, { sql: v })}
            onRun={() => nb.runCell(c.id)}
            onRunAndNext={() => nb.runAndNext(c.id)}
            onDelete={() => nb.removeCell(c.id)}
            onMove={(dir) => nb.moveCell(c.id, dir)}
            onAddBelow={() => nb.addCell(c.id)}
            onFormat={() => nb.formatCell(c.id)}
            onToggleOutput={() => nb.update(c.id, { hideOutput: !c.hideOutput })}
            onToggleComposed={() => nb.update(c.id, { showComposed: !c.showComposed })}
            onSaveQuery={() => saved.saveCell(c.id)}
            onUpdateSaved={() => saved.updateCell(c.id)}
            onDetach={() => nb.update(c.id, { saved: null })}
            onSaveChart={() => setChartFor(c.id)}
            onOpenBuilder={() => openInBuilder(c)}
            assistCells={nb.cells.slice(0, i).map(({ name, sql }) => ({ name, sql }))}
          />
        ))}
        <button type="button" onClick={() => nb.addCell(null)}
          className="flex w-full items-center justify-center gap-1.5 border-b border-dashed py-3 text-sm text-muted-foreground/70 hover:bg-muted/40 hover:text-muted-foreground">
          <Plus className="h-4 w-4" /> Add cell
        </button>
      </div>

      {chartCell?.result && <SaveChartModal isOpen onClose={() => setChartFor(null)} result={chartCell.result} />}
    </div>
  );
}
