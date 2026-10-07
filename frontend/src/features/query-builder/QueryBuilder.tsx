import { Fragment, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Play, Plus, RotateCcw, X } from 'lucide-react';
import { AsyncView } from '@/components/common/AsyncView';
import { ResizeHandle, useResizableWidth } from '@/components/common/ResizeHandle';
import { Button } from '@/components/ui/kit';
import { AiBar } from './AiBar';
import { ResultPane } from './ResultPane';
import { StageEditor } from './StageEditor';
import { hasSource } from './qbModel';
import { useQueryBuilder } from './useQueryBuilder';

/**
 * Visual query builder (Metabase-style notebook, but with joins across any table, custom columns, conditional metrics,
 * window calculations and chained stages). Left: the steps; right: live result / chart / generated SQL.
 */
export function QueryBuilder() {
  const qb = useQueryBuilder();
  const { pathname } = useLocation();
  const first = useRef(true);
  // this page stays mounted while you visit other tabs (KeepAlive): refresh the table list when you come back
  useEffect(() => { if (first.current) first.current = false; else if (pathname === '/builder') qb.schema.reload(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const { width, handleProps } = useResizableWidth({ key: 'qb.width', initial: 520, min: 360, max: 900, edge: 'right' });
  const baseId = qb.schema.data?.tables.find((t) => t.name === qb.spec.stages[0]?.table)?.id;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden lg:flex-row"
      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') qb.apply(); }}>
      <div style={{ width }} className="flex max-h-[55%] min-h-0 min-w-0 shrink-0 flex-col border-b border-border bg-background max-lg:!w-full lg:max-h-none lg:border-b-0 lg:border-e">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">Query builder</h1>
          <span className="text-xs text-muted-foreground">any table · no SQL needed</span>
          <Button size="sm" variant={qb.dirty ? 'primary' : 'outline'} className="ml-auto" icon={<Play className="size-3.5" />} label={qb.dirty ? 'Apply changes' : 'Applied'}
            title="Run the query and update the preview (Ctrl+Enter)" isDisabled={!qb.dirty || !hasSource(qb.spec)} onClick={() => qb.apply()} />
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} label="Start over" onClick={qb.reset} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-3">
          {qb.notice && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${qb.notice.fidelity === 'wrapped' ? 'border-warning/40 bg-warning/10 text-warning' : 'border-success/40 bg-success/10 text-success'}`}>
              <span className="flex-1">{qb.notice.fidelity === 'wrapped' ? qb.notice.notes.join(' ') : qb.notice.fidelity === 'linked' ? 'Opened with the exact steps you built.' : 'Opened as steps: the steps give the same result as the SQL.'}</span>
              <button type="button" aria-label="Dismiss" onClick={qb.clearNotice}><X className="size-3.5" /></button>
            </div>
          )}
          <AiBar spec={qb.spec} onBuilt={qb.replaceSpec} onUndo={qb.undo} canUndo={qb.canUndo} />
          <AsyncView state={qb.schema}>
            {(schema) => (
              <>
                {qb.spec.stages.map((_, i) => (
                  <Fragment key={i}>
                    <StageEditor spec={qb.spec} index={i} schema={schema} prev={qb.prev[i] ?? []} onChange={(p) => qb.setStage(i, p)}
                      onRemove={() => qb.removeStage(i)} previewing={qb.previewAt === i} onPreview={() => qb.preview(qb.previewAt === i ? null : i)} />
                  </Fragment>
                ))}
                <Button size="sm" variant="outline" className="w-fit" icon={<Plus className="size-3.5" />} label="Add another stage (use these results as a new table)"
                  isDisabled={!qb.result} onClick={qb.addStage} />
              </>
            )}
          </AsyncView>
        </div>
      </div>
      <ResizeHandle {...handleProps} label="Resize builder" />
      <div className="min-h-0 min-w-0 flex-1 p-3">
        <ResultPane result={qb.result} sql={qb.sql} spec={qb.appliedSpec} hint={qb.hint} running={qb.running} baseDatasetId={baseId} previewAt={qb.previewAt} />
      </div>
    </div>
  );
}
