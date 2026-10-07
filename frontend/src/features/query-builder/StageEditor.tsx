import { useState } from 'react';
import { ChevronDown, Eye, Sigma, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/kit';
import { SqlSourceStep } from './SqlSourceStep';
import { JoinStep, SourceStep } from './SourceJoinSteps';
import { CustomStep } from './CustomStep';
import { ColumnsStep } from './ColumnsStep';
import { FilterStep, SortLimitStep, WindowStep } from './ShapeSteps';
import { SummarizeStep } from './SummarizeStep';
import { columnsFor, isSummarized, outputCols, stageLabel, type Kind, type QbSchema, type QbSpec, type QbStage } from './qbModel';

/** One stage of the notebook: its steps in the order data flows through them (Data → Join → Custom → Summarize → Window → Columns → Filter → Sort). */
export function StageEditor({ spec, index, schema, prev, onChange, onRemove, onPreview, previewing }: {
  spec: QbSpec; index: number; schema: QbSchema; prev: { name: string; kind: Kind }[];
  onChange: (p: Partial<QbStage>) => void; onRemove: () => void; onPreview: () => void; previewing: boolean;
}) {
  const st = spec.stages[index];
  const cols = columnsFor(spec, index, schema, prev);
  const ready = index > 0 || !!st.table || st.sql != null;
  const raw = index === 0 && st.sql != null;
  const [showSummary, setShowSummary] = useState(isSummarized(st));
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />{stageLabel(index)}
          {collapsed && <span className="font-normal normal-case tracking-normal">· {outline(st)}</span>}
        </button>
        <span className="h-px flex-1 bg-border" />
        <Button size="sm" variant={previewing ? 'primary' : 'ghost'} icon={<Eye className="size-3.5" />} label="Preview" onClick={onPreview} isDisabled={!ready} />
        {index > 0 && <Button size="sm" variant="ghost" aria-label="Remove stage" icon={<Trash2 className="size-3.5" />} onClick={onRemove} />}
      </div>
      {!collapsed && <>
      {raw ? <SqlSourceStep sql={st.sql ?? ''} onChange={(sql) => onChange({ sql })} /> : index === 0 && <SourceStep st={st} schema={schema} set={onChange} />}
      {ready && !raw && <>
        {index === 0 && <JoinStep st={st} schema={schema} cols={cols} set={onChange} />}
        <CustomStep st={st} cols={cols} set={onChange} />
        {showSummary || isSummarized(st)
          ? <SummarizeStep st={st} cols={cols} set={onChange} />
          : <Button size="sm" variant="outline" className="w-fit" icon={<Sigma className="size-3.5" />} label="Summarize (count, sum, group by…)" onClick={() => setShowSummary(true)} />}
        <WindowStep st={st} cols={cols} set={onChange} />
        {!isSummarized(st) && <ColumnsStep st={st} cols={cols} set={onChange} />}
        <FilterStep st={st} cols={cols} set={onChange} />
        <SortLimitStep st={st} outCols={outputCols(st, cols)} set={onChange} />
      </>}
      </>}
    </div>
  );
}

/** One-line description of a stage for its collapsed header. */
function outline(st: QbStage): string {
  const bits = [st.sql != null ? 'SQL' : st.table, st.joins?.length ? `${st.joins.length} join(s)` : '', st.custom?.length ? `${st.custom.length} custom` : '', st.filters?.length ? `${st.filters.length} filter(s)` : '',
    isSummarized(st) ? `${st.aggregations?.length ?? 0} metric(s), ${st.breakouts?.length ?? 0} group(s)` : '', st.windows?.length ? `${st.windows.length} window` : ''];
  return bits.filter(Boolean).join(' · ') || 'empty';
}
