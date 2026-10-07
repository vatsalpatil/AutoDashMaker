import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, TextArea, TextInput } from '@/components/ui/kit';
import { Plus, Trash2, Play } from 'lucide-react';
import { api } from '@/lib/api';
import type { Dataset, Snippet, TransformLayer, TransformPreview } from '@/lib/types';
import { SelectField as Select } from '@/components/common/SelectField';
import { DataTable } from '@/components/common/DataTable';
import { ErrorBanner } from '@/components/common/ErrorBanner';

interface LayerState {
  id: number;
  type: 'sql' | 'python';
  content: string;
  preview?: TransformPreview;
  previewError?: string | null;
  previewing?: boolean;
}

let nextId = 1;

export function TransformPanel({ baseDataset }: { baseDataset: Dataset }) {
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [name, setName] = useState(`${baseDataset.name}_transformed`);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Dataset | null>(null);

  useEffect(() => {
    api.get<Snippet[]>('/transforms/snippets').then(setSnippets).catch(() => {});
  }, []);

  function addLayer(type: 'sql' | 'python') {
    setLayers((ls) => [...ls, { id: nextId++, type, content: '' }]);
  }

  function updateLayer(id: number, patch: Partial<LayerState>) {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLayer(id: number) {
    setLayers((ls) => ls.filter((l) => l.id !== id));
  }

  async function previewLayer(layer: LayerState) {
    if (!layer.content.trim()) return;
    updateLayer(layer.id, { previewing: true, previewError: null });
    try {
      const r = await api.post<TransformPreview>('/transforms/preview', {
        dataset_id: baseDataset.id,
        kind: layer.type,
        ...(layer.type === 'sql' ? { sql: layer.content } : { code: layer.content }),
        limit: 100,
      });
      updateLayer(layer.id, { preview: r, previewing: false });
    } catch (e) {
      updateLayer(layer.id, { preview: undefined, previewing: false, previewError: (e as Error).message });
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const payloadLayers: TransformLayer[] = layers.map((l) =>
        l.type === 'sql' ? { type: 'sql', sql: l.content } : { type: 'python', code: l.content },
      );
      const r = await api.post<Dataset>('/transforms/derive', {
        name,
        base_dataset_id: baseDataset.id,
        layers: payloadLayers,
      });
      setCreated(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message={error} />

      {created ? (
        <Card padding={4}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="green" label="Dataset created" />
              <span className="font-semibold">{created.name}</span>
              {created.row_count !== undefined && (
                <Badge variant="blue" label={`${created.row_count.toLocaleString()} rows`} />
              )}
            </div>
            <Link
              to={`/datasets/${created.id}`}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Open the new dataset →
            </Link>
            <div>
              <Button variant="secondary" label="Build another" onClick={() => { setCreated(null); setLayers([]); }} />
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex gap-2">
            <Button variant="secondary" label="Add SQL layer" icon={<Plus className="h-4 w-4" />} onClick={() => addLayer('sql')} />
            <Button variant="secondary" label="Add Python layer" icon={<Plus className="h-4 w-4" />} onClick={() => addLayer('python')} />
          </div>

          {layers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No layers yet. Add a SQL or Python (Polars) layer to transform this dataset into a new one.
            </p>
          )}

          {layers.map((layer, i) => (
            <Card key={layer.id} padding={4}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Layer {i + 1}</span>
                    <div className="flex overflow-hidden rounded-md border border-input">
                      {(['sql', 'python'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateLayer(layer.id, { type: t, content: '', preview: undefined, previewError: null })}
                          className={`px-3 py-1 text-xs font-medium ${layer.type === t ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted '}`}
                        >
                          {t === 'sql' ? 'SQL' : 'Python'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => removeLayer(layer.id)} className="text-muted-foreground/70 hover:text-destructive" aria-label="Remove layer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {layer.type === 'python' && snippets.length > 0 && (
                  <Select
                    label="Insert a recipe"
                    value=""
                    onChange={(e) => {
                      const s = snippets.find((x) => x.name === e.target.value);
                      if (s) updateLayer(layer.id, { content: s.code });
                    }}
                  >
                    <option value="">Choose a snippet…</option>
                    {snippets.map((s) => (
                      <option key={s.name} value={s.name}>{s.name} — {s.description}</option>
                    ))}
                  </Select>
                )}

                <TextArea
                  label={layer.type === 'sql' ? 'SQL — current data is available as {df}' : 'Python — input is df (Polars); assign output to result'}
                  value={layer.content}
                  onChange={(v: string) => updateLayer(layer.id, { content: v })}
                  rows={6}
                  placeholder={
                    layer.type === 'sql'
                      ? "SELECT * FROM {df} WHERE status = 'completed'"
                      : "result = df.filter(pl.col('status') == 'completed')"
                  }
                />

                {layer.previewError && <ErrorBanner message={layer.previewError} />}

                {layer.preview && (
                  <div className="flex flex-col gap-2">
                    <Badge variant="blue" label={`${layer.preview.row_count.toLocaleString()} rows`} />
                    <DataTable columns={layer.preview.columns} rows={layer.preview.rows} maxRows={50} />
                  </div>
                )}

                <div>
                  <Button
                    variant="secondary"
                    label={layer.previewing ? 'Previewing…' : 'Preview layer'}
                    icon={<Play className="h-4 w-4" />}
                    onClick={() => previewLayer(layer)}
                    isDisabled={layer.previewing || !layer.content.trim()}
                  />
                </div>
              </div>
            </Card>
          ))}

          {layers.length > 0 && (
            <Card padding={4}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <TextInput label="New dataset name" value={name} onChange={(v: string) => setName(v)} />
                </div>
                <Button
                  variant="primary"
                  label={saving ? 'Saving…' : 'Save as new dataset'}
                  onClick={save}
                  isDisabled={saving || !name.trim() || layers.some((l) => !l.content.trim())}
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
