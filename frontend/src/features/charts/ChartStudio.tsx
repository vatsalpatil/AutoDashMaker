import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutTemplate, Loader2, Maximize2, Minimize2, Save } from 'lucide-react';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { ResizeHandle, useResizableWidth } from '@/components/common/ResizeHandle';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Loading } from '@/components/common/Loading';
import { DataPanel } from './panels/DataPanel';
import { OptionsPanel } from './panels/OptionsPanel';
import { TemplateGallery } from './panels/TemplateGallery';
import { ChartView } from './render/ChartView';
import { useChartDraft } from './useChartDraft';
import { AskAiPanel } from './panels/AskAiPanel';
import { SuggestionStrip } from './panels/SuggestionStrip';
import { api } from '@/lib/api';
import type { ChartEncoding, ChartType, Dashboard } from '@/lib/types';
import type { Suggestion } from './suggest';

type Pane = 'data' | 'preview' | 'style';

/** Full chart editor: data mapping on the left, live preview in the middle, every style option on the right. */
export function ChartStudio({ id, startType, target }: { id?: string; startType?: ChartType; target?: { dashboard: string; page: string } }) {
  const nav = useNavigate();
  const d = useChartDraft(id);
  const pick = (s: Suggestion, encoding: ChartEncoding) => {
    d.applyTemplate({ id: s.type, name: s.title, description: s.reason, group: 'Suggested', type: s.type as ChartType, options: s.options });
    d.setEncoding(encoding);
  };
  const [gallery, setGallery] = useState(false);
  const [pane, setPane] = useState<Pane>('preview');  // which column shows on small screens
  // every section is drag-resizable (widths/height remembered per browser; double-click a grip to reset)
  const left = useResizableWidth({ key: 'studio.left', initial: 288, min: 220, max: 560, edge: 'right' });
  const right = useResizableWidth({ key: 'studio.right', initial: 320, min: 260, max: 600, edge: 'left' });
  const tall = useResizableWidth({ key: 'studio.preview', initial: 420, min: 200, max: 1200, edge: 'right', axis: 'y' });
  const height = tall.width;
  const full = useFullscreen<HTMLDivElement>();   // view the element being built on the whole screen
  // the options panel and sliders stay instant while the (heavier) chart catches up
  const spec = useDeferredValue(d.spec);
  const previewHeight = useDeferredValue(height);

  // opened from a dashboard's "Add widget": start with the chosen element type
  useEffect(() => { if (!id && startType && !d.loading) d.setType(startType); }, [d.loading]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading) return <Loading />;

  const onSave = async () => {
    const saved = await d.save();
    if (saved && !id && target) {   // place it below everything on that dashboard page, then go back there
      const dash = await api.get<Dashboard>(`/dashboards/${target.dashboard}`);
      const y = (dash.widgets ?? []).filter((w) => (w.page ?? 'main') === target.page).reduce((m, w) => Math.max(m, w.position.y + w.position.h), 0);
      const wide = ['timebreak', 'table', 'pivot', 'line', 'area', 'composed'].includes(d.spec.type);
      await api.post(`/dashboards/${target.dashboard}/widgets`, { chart_id: saved, page: target.page, position: { x: 0, y, w: wide ? 12 : 6, h: d.spec.type === 'timebreak' ? 7 : d.spec.type === 'kpi' ? 2 : 4 } });
      nav(`/dashboards/${target.dashboard}`);
    } else if (saved && !id) nav(`/charts/${saved}`, { replace: true });
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
            icon={d.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} label={d.savedId ? 'Save' : target ? 'Create & add to dashboard' : 'Create chart'} />
        </div>
      </header>

      <Tabs value={pane} onValueChange={(v) => setPane(v as Pane)} className="border-b bg-card px-4 py-1.5 xl:hidden">
        <TabsList className="w-full"><TabsTrigger value="data">Data</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="style">Style</TabsTrigger></TabsList>
      </Tabs>

      <div className="grid min-h-0 flex-1 xl:flex">
        <aside style={{ '--w': `${left.width}px` } as React.CSSProperties} className={`${col('data')} min-h-0 flex-col overflow-y-auto border-r bg-card xl:w-[var(--w)] xl:shrink-0`}>
          <DataPanel queries={d.queries} queryId={d.queryId} onQuery={d.pickQuery} columns={d.columns} spec={d.spec} onType={d.setType} onEncoding={d.setEncoding} />
        </aside>
        <div className="hidden xl:contents"><ResizeHandle {...left.handleProps} label="Resize data panel" /></div>

        <main className={`${col('preview')} min-h-0 min-w-0 flex-col gap-3 overflow-y-auto p-4 xl:flex-1`}>
          <ErrorBanner message={d.error} onDismiss={() => d.setError(null)} />
          <div ref={full.ref} className={full.active ? 'flex flex-col bg-background p-6' : 'shrink-0'}>
            <div className="mb-1.5 flex items-center justify-end">
              <Button variant="ghost" size="sm" icon={full.active ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                label={full.active ? 'Exit full screen' : 'Full screen'} title={full.active ? 'Exit full screen (Esc)' : 'View this chart full screen'} onClick={full.toggle} />
            </div>
            <Card padding={4} className="min-h-0 flex-1">
              {ready && d.result ? <ChartView spec={spec} result={d.result} height={full.active ? Math.max(300, window.innerHeight - 136) : previewHeight} />
                : <div className="grid h-80 place-items-center text-sm text-muted-foreground">Choose a query and map its columns to see a live preview.</div>}
            </Card>
          </div>
          <div className="-mt-1.5 pt-1.5"><ResizeHandle {...tall.handleProps} vertical label="Resize preview height" /></div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Drag the grip above to resize the preview</span>
            {d.result && <span className="ml-auto">{d.result.row_count.toLocaleString()} rows · {d.result.columns.length} columns</span>}
          </div>
          {d.result && <SuggestionStrip result={d.result} current={d.spec.type}
            onPick={pick} />}
        </main>

        <div className="hidden xl:contents"><ResizeHandle {...right.handleProps} label="Resize style panel" /></div>
        <aside style={{ '--w': `${right.width}px` } as React.CSSProperties} className={`${col('style')} min-h-0 flex-col overflow-hidden border-l bg-card xl:w-[var(--w)] xl:shrink-0`}>
          <OptionsPanel type={d.spec.type} columns={d.result?.columns ?? []} options={d.spec.options ?? {}} onChange={d.setOption} onReset={d.resetOptions}
            extra={{ id: 'ai', label: 'Ask AI', node: <AskAiPanel result={d.result ?? undefined} onPick={pick} /> }} />
        </aside>
      </div>

      <TemplateGallery open={gallery} onClose={() => setGallery(false)} onPick={d.applyTemplate} current="" />
    </div>
  );
}
