import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutTemplate, Loader2, Save } from 'lucide-react';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { DataPanel } from './panels/DataPanel';
import { OptionsPanel } from './panels/OptionsPanel';
import { TemplateGallery } from './panels/TemplateGallery';
import { ChartView } from './render/ChartView';
import { useChartDraft } from './useChartDraft';

type Pane = 'data' | 'preview' | 'style';

/** Full chart editor: data mapping on the left, live preview in the middle, every style option on the right. */
export function ChartStudio({ id }: { id?: string }) {
  const nav = useNavigate();
  const d = useChartDraft(id);
  const [gallery, setGallery] = useState(false);
  const [pane, setPane] = useState<Pane>('preview');  // which column shows on small screens
  const [height, setHeight] = useState(420);
  // the options panel and sliders stay instant while the (heavier) chart catches up
  const spec = useDeferredValue(d.spec);
  const previewHeight = useDeferredValue(height);

  if (d.loading) return <Loading />;

  const onSave = async () => {
    const saved = await d.save();
    if (saved && !id) nav(`/charts/${saved}`, { replace: true });
  };
  const col = (p: Pane) => (pane === p ? 'flex' : 'hidden xl:flex');
  const ready = d.result && d.spec.encoding.x !== undefined && (d.spec.type === 'table' || d.spec.encoding.y || d.spec.type === 'kpi');

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => nav('/charts')} aria-label="Back to charts" />
        <div className="w-56 min-w-0 flex-1 sm:flex-none"><TextInput value={d.name} onChange={d.setName} aria-label="Chart name" className="h-8 font-medium" /></div>
        {d.dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<LayoutTemplate className="size-4" />} label="Templates" onClick={() => setGallery(true)} />
          <Button variant="primary" size="sm" isDisabled={d.saving || !d.queryId} onClick={onSave}
            icon={d.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} label={d.savedId ? 'Save' : 'Create chart'} />
        </div>
      </header>

      <Tabs value={pane} onValueChange={(v) => setPane(v as Pane)} className="border-b bg-card px-4 py-1.5 xl:hidden">
        <TabsList className="w-full"><TabsTrigger value="data">Data</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="style">Style</TabsTrigger></TabsList>
      </Tabs>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <aside className={`${col('data')} min-h-0 flex-col overflow-y-auto border-r bg-card`}>
          <DataPanel queries={d.queries} queryId={d.queryId} onQuery={d.pickQuery} columns={d.columns} spec={d.spec} onType={d.setType} onEncoding={d.setEncoding} />
        </aside>

        <main className={`${col('preview')} min-h-0 flex-col gap-3 overflow-y-auto p-4`}>
          <ErrorBanner message={d.error} onDismiss={() => d.setError(null)} />
          <Card padding={4} className="min-h-[24rem]">
            {ready && d.result ? <ChartView spec={spec} result={d.result} height={previewHeight} />
              : <div className="grid h-80 place-items-center text-sm text-muted-foreground">Choose a query and map its columns to see a live preview.</div>}
          </Card>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <label htmlFor="studio-height">Preview height</label>
            <input id="studio-height" type="range" min={200} max={760} step={20} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-40 accent-[var(--primary)]" />
            {d.result && <span className="ml-auto">{d.result.row_count.toLocaleString()} rows · {d.result.columns.length} columns</span>}
          </div>
        </main>

        <aside className={`${col('style')} min-h-0 flex-col overflow-hidden border-l bg-card`}>
          <OptionsPanel type={d.spec.type} options={d.spec.options ?? {}} onChange={d.setOption} onReset={d.resetOptions} />
        </aside>
      </div>

      <TemplateGallery open={gallery} onClose={() => setGallery(false)} onPick={d.applyTemplate} current="" />
    </div>
  );
}
