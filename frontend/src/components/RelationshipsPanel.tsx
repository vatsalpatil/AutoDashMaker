import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '@/components/ui/kit';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Dataset, DatasetSchema, Relationship, RelationshipSuggestion } from '@/lib/types';
import { SelectField as Select } from '@/components/common/SelectField';
import { ErrorBanner } from '@/components/common/ErrorBanner';

export function RelationshipsPanel({ datasets }: { datasets: Dataset[] }) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [suggestions, setSuggestions] = useState<RelationshipSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftSchema, setLeftSchema] = useState<DatasetSchema | null>(null);
  const [rightSchema, setRightSchema] = useState<DatasetSchema | null>(null);
  const [leftCol, setLeftCol] = useState('');
  const [rightCol, setRightCol] = useState('');
  const [joinType, setJoinType] = useState<'left' | 'inner' | 'full'>('left');

  const load = useCallback(() => {
    api.get<Relationship[]>('/transforms/relationships').then(setRelationships).catch((e) => setError(e.message));
    api.get<RelationshipSuggestion[]>('/transforms/relationships/suggest').then(setSuggestions).catch(() => {});
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!leftId) { setLeftSchema(null); return; }
    api.get<DatasetSchema>(`/datasets/${leftId}/schema`).then(setLeftSchema).catch(() => setLeftSchema(null));
  }, [leftId]);
  useEffect(() => {
    if (!rightId) { setRightSchema(null); return; }
    api.get<DatasetSchema>(`/datasets/${rightId}/schema`).then(setRightSchema).catch(() => setRightSchema(null));
  }, [rightId]);

  async function createRel(body: {
    left_dataset_id: string; left_column: string;
    right_dataset_id: string; right_column: string; join_type?: string;
  }) {
    setError(null);
    try {
      await api.post('/transforms/relationships', { join_type: 'left', ...body });
      setLeftCol('');
      setRightCol('');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeRel(id: string) {
    await api.del(`/transforms/relationships/${id}`).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />

      {relationships.length === 0 ? (
        <EmptyState title="No relationships yet" description="Declare how datasets join so blends and the AI can use them." isCompact />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {relationships.map((r) => (
            <Card key={r.id} padding={3}>
              <div className="flex items-start justify-between">
                <div>
                  <code className="mono text-sm text-blue-700 dark:text-blue-300">
                    {r.left_dataset ?? r.left_dataset_id}.{r.left_column} → {r.right_dataset ?? r.right_dataset_id}.{r.right_column}
                  </code>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="neutral" label={r.join_type} />
                    {r.source && <Badge variant="neutral" label={r.source} />}
                  </div>
                </div>
                <button onClick={() => removeRel(r.id)} className="text-muted-foreground/70 hover:text-destructive" aria-label="Delete relationship">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card padding={4}>
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">Add relationship</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Left dataset" value={leftId} onChange={(e) => { setLeftId(e.target.value); setLeftCol(''); }}>
              <option value="">Select…</option>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Select label="Right dataset" value={rightId} onChange={(e) => { setRightId(e.target.value); setRightCol(''); }}>
              <option value="">Select…</option>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Select label="Left column" value={leftCol} onChange={(e) => setLeftCol(e.target.value)} disabled={!leftSchema}>
              <option value="">Select…</option>
              {leftSchema?.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </Select>
            <Select label="Right column" value={rightCol} onChange={(e) => setRightCol(e.target.value)} disabled={!rightSchema}>
              <option value="">Select…</option>
              {rightSchema?.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </Select>
            <Select label="Join type" value={joinType} onChange={(e) => setJoinType(e.target.value as 'left' | 'inner' | 'full')}>
              <option value="left">Left</option>
              <option value="inner">Inner</option>
              <option value="full">Full</option>
            </Select>
          </div>
          <div>
            <Button
              variant="primary"
              label="Add relationship"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => createRel({ left_dataset_id: leftId, left_column: leftCol, right_dataset_id: rightId, right_column: rightCol, join_type: joinType })}
              isDisabled={!leftId || !rightId || !leftCol || !rightCol}
            />
          </div>
        </div>
      </Card>

      {suggestions.length > 0 && (
        <Card padding={4}>
          <h3 className="font-semibold">Suggestions (shared columns)</h3>
          <div className="mt-3 flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <code className="mono text-blue-700 dark:text-blue-300">
                  {s.left_dataset}.{s.left_column} → {s.right_dataset}.{s.right_column}
                </code>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" label={s.dtype} />
                  <Button
                    variant="secondary"
                    label="Add"
                    onClick={() => createRel({ left_dataset_id: s.left_dataset_id, left_column: s.left_column, right_dataset_id: s.right_dataset_id, right_column: s.right_column })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
