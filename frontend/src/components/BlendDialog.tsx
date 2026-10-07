import { Button, Dialog, TextInput } from '@/components/ui/kit';
import { Code2, GitMerge, Layers, Sparkles } from 'lucide-react';
import type { Dataset, RelationshipSuggestion } from '@/lib/types';
import { useBlend } from '@/features/sources/useBlend';
import { SelectField as Select } from '@/components/common/SelectField';
import { ErrorBanner } from '@/components/common/ErrorBanner';

export function BlendDialog({
  isOpen,
  onClose,
  datasets,
}: {
  isOpen: boolean;
  onClose: () => void;
  datasets: Dataset[];
}) {
  const {
    leftId,
    setLeftId,
    rightId,
    setRightId,
    leftSchema,
    setLeftSchema,
    rightSchema,
    setRightSchema,
    leftCol,
    setLeftCol,
    rightCol,
    setRightCol,
    joinType,
    setJoinType,
    name,
    setName,
    nameTouched,
    setNameTouched,
    suggestions,
    setSuggestions,
    error,
    setError,
    creating,
    setCreating,
    showSql,
    setShowSql,
    leftDs,
    rightDs,
    leftName,
    rightName,
    effectiveName,
    applySuggestion,
    generatedSql,
    create,
  } = useBlend(isOpen, onClose, datasets);

  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()}>
      <div className="flex max-h-[88vh] w-[42rem] max-w-full flex-col overflow-y-auto p-6">
        <div className="flex items-center gap-2 text-xl font-bold text-foreground">
          <GitMerge className="h-5 w-5 text-blue-600" />
          <h2>Blend Datasets (Join Engine)</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Combine rows from two datasets using shared keys into a brand-new derived dataset.
        </p>

        <ErrorBanner message={error} />

        {/* Suggested Joins */}
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/40">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Auto-Detected Relationships</span>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="group flex items-center gap-1 rounded-md border border-blue-200 bg-card px-2.5 py-1 text-xs font-medium text-blue-700 shadow-xs transition-all hover:border-blue-400 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900"
                >
                  <span className="font-semibold">{s.left_dataset}</span>
                  <span className="text-muted-foreground/70">.{s.left_column}</span>
                  <span className="text-blue-500">↔</span>
                  <span className="font-semibold">{s.right_dataset}</span>
                  <span className="text-muted-foreground/70">.{s.right_column}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dataset Selection */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 ">
            <span className="text-xs font-bold uppercase text-muted-foreground">Primary (Left) Dataset</span>
            <Select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              <option value="">Select Left Dataset…</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.row_count?.toLocaleString() ?? 0} rows)
                </option>
              ))}
            </Select>

            {leftSchema && (
              <Select label="Left Join Key Column" value={leftCol} onChange={(e) => setLeftCol(e.target.value)}>
                <option value="">Select Column…</option>
                {leftSchema.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dtype})
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 ">
            <span className="text-xs font-bold uppercase text-muted-foreground">Secondary (Right) Dataset</span>
            <Select value={rightId} onChange={(e) => setRightId(e.target.value)}>
              <option value="">Select Right Dataset…</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.row_count?.toLocaleString() ?? 0} rows)
                </option>
              ))}
            </Select>

            {rightSchema && (
              <Select label="Right Join Key Column" value={rightCol} onChange={(e) => setRightCol(e.target.value)}>
                <option value="">Select Column…</option>
                {rightSchema.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dtype})
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Join Type Selector */}
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase text-muted-foreground">Join Type</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'left', name: 'Left Join', desc: 'All rows from Left + matching Right' },
              { id: 'inner', name: 'Inner Join', desc: 'Only rows matching BOTH datasets' },
              { id: 'full', name: 'Full Outer', desc: 'All rows from BOTH datasets' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setJoinType(t.id as 'left' | 'inner' | 'full')}
                className={`flex flex-col rounded-lg border p-2.5 text-left transition-all ${
                  joinType === t.id
                    ? 'border-blue-600 bg-blue-50/80 shadow-xs dark:border-blue-500 dark:bg-blue-950/80'
                    : 'border-border bg-card hover:border-input '
                }`}
              >
                <span className="text-xs font-bold text-foreground">{t.name}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Blend Name */}
        <div className="mt-4">
          <TextInput
            label="Resulting Dataset Name"
            value={effectiveName}
            onChange={(v: string) => {
              setName(v);
              setNameTouched(true);
            }}
            placeholder="blended_sales_data"
          />
        </div>

        {/* SQL / Schema Preview Accordion */}
        {generatedSql && (
          <div className="mt-3 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setShowSql((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>{showSql ? 'Hide SQL Query Preview' : 'Show Generated SQL Query'}</span>
            </button>
            {showSql && (
              <pre className="mono rounded-lg border border-border bg-slate-900 p-3 text-xs text-blue-300">
                {generatedSql}
              </pre>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="primary"
            label={creating ? 'Blending…' : 'Create Blended Dataset'}
            onClick={create}
            isDisabled={creating || !leftId || !rightId || !leftCol || !rightCol || !effectiveName.trim()}
          />
        </div>
      </div>
    </Dialog>
  );
}
