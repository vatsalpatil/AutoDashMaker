import { useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useApi } from '@/hooks/useApi';
import { AiSidebar } from '@/features/workbench/AiSidebar';
import { ExplorerPanel } from '@/features/workbench/ExplorerPanel';
import { NotebookView } from '@/features/workbench/NotebookView';
import { useNotebook } from '@/features/workbench/useNotebook';
import { useSavedQueries } from '@/features/workbench/useSavedQueries';
import type { Dataset } from '@/lib/types';

/**
 * SQL notebook page. Deliberately thin: state lives in useNotebook / useSavedQueries,
 * everything visual in features/workbench/*. Full-bleed so the panels touch edge to edge.
 */
export default function WorkbenchPage() {
  const nb = useNotebook();
  const datasetsApi = useApi<Dataset[]>('/datasets');
  const datasets = datasetsApi.data ?? [];
  const [error, setError] = useState<string | null>(null);
  const saved = useSavedQueries(nb, setError);
  const [aiOpen, setAiOpen] = useLocalStorage('workbench.ai.open', false);   // opened with the toolbar button, fully gone when closed

  const tableNames = useMemo(() => new Set(datasets.map((d) => (d.physical_name ?? d.name).toLowerCase())), [datasets]);
  const afterActive = nb.active?.id ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <ExplorerPanel
        datasets={datasets}
        savedQueries={saved.queries}
        notebooks={nb.notebooks}
        onInsertText={nb.insertText}
        onLoadSql={(sql) => nb.runCell(nb.addCell(afterActive, sql))}
        onLoadSaved={(q) => nb.addCell(afterActive, q.sql, { saved: q })}
        onAddStep={(sql) => nb.addCell(afterActive, sql)}
        onDeleteSaved={saved.remove}
      />
      <NotebookView
        nb={nb}
        saved={saved}
        tableNames={tableNames}
        error={error ?? datasetsApi.error}
        onDismissError={() => setError(null)}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((o) => !o)}
      />
      <AiSidebar open={aiOpen} onClose={() => setAiOpen(false)} datasets={datasets} nb={nb} />
    </div>
  );
}
