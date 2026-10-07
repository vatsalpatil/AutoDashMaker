import { useCallback, useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ResizeHandle, useResizableWidth } from '@/components/common/ResizeHandle';
import type { Dataset } from '@/lib/types';
import { AgentPanel } from './agent/AgentPanel';
import type { AgentContext, NotebookActions } from './agent/useAgent';
import type { Notebook } from './useNotebook';

/** Right-hand assistant: opened from the notebook toolbar, closed with X (nothing is left behind when closed). */
export function AiSidebar({ open, onClose, datasets, nb }: { open: boolean; onClose: () => void; datasets: Dataset[]; nb: Notebook }) {
  const { width, handleProps } = useResizableWidth({ key: 'workbench.width.ai', initial: 400, min: 300, max: 760, edge: 'left' });
  const active = nb.active;

  // the assistant sees the active cell, its error and the cells above it
  const getContext = useCallback((): AgentContext => ({
    activeSql: active?.sql ?? '', error: active?.error ?? null,
    cells: nb.cells.slice(0, nb.activeIndex).map(({ name, sql }) => ({ name, sql })),
  }), [active, nb.cells, nb.activeIndex]);

  const actions = useMemo<NotebookActions>(() => ({
    current: () => active?.sql ?? '',
    add: (sql, run) => { const id = nb.addCell(active?.id ?? null, sql); if (run) nb.runCell(id); },
    edit: (sql, run) => {
      if (!active) { const id = nb.addCell(null, sql); if (run) nb.runCell(id); return; }
      nb.update(active.id, { sql });
      if (run) nb.runCell(active.id, sql);
    },
  }), [nb, active]);

  if (!open) return null;
  return (
    <>
      <ResizeHandle {...handleProps} label="Resize AI assistant" />
      <aside className="flex min-h-0 shrink flex-col border-l bg-card p-3" style={{ width, minWidth: 260 }}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI Assistant</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close AI assistant"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1">
          <AgentPanel datasets={datasets} getContext={getContext} actions={actions} activeName={active?.name}
            hasSql={!!active?.sql.trim()} hasError={!!active?.error} />
        </div>
      </aside>
    </>
  );
}
