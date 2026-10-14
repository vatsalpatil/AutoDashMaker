import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { WidgetSettingsPanel } from '@/components/WidgetSettingsPanel';
import { AddWidgetDialog } from '@/features/dashboards/AddWidgetDialog';
import { ContentDialog } from '@/features/dashboards/ContentDialog';
import { DashboardIdContext, RefreshContext, useDashboardRefresh } from '@/features/dashboards/dashboardRefresh';
import { DashboardAiPanel } from '@/features/dashboards/DashboardAiPanel';
import { DashboardToolbar } from '@/features/dashboards/DashboardToolbar';
import { FilterViews } from '@/features/dashboards/FilterViews';
import { DashboardFilterArea } from '@/features/dashboards/filters/DashboardFilterArea';
import { DashboardParamsContext, useDashboardParamState } from '@/features/dashboards/params/DashboardParams';
import { FullscreenModal } from '@/features/dashboards/FullscreenModal';
import { BriefCard, LineageCard } from '@/features/dashboards/InsightPanels';
import { PrintDialog } from '@/features/dashboards/PrintDialog';
import { PrintSheet } from '@/features/dashboards/PrintSheet';
import type { PrintOptions } from '@/features/dashboards/printLayout';
import { PageTabs } from '@/features/dashboards/PageTabs';
import { ShareDialog } from '@/features/dashboards/share/ShareDialog';
import { PresentMode } from '@/features/dashboards/PresentMode';
import { useDashboardPage } from '@/features/dashboards/useDashboardPage';
import { WidgetGrid } from '@/features/dashboards/WidgetGrid';
import { useWidgetGroups } from '@/features/dashboards/widgetGroups';
import { DashboardFilterProvider, useDashboardFilterState } from '@/features/dashboards/dashboardFilters';

/** One dashboard: pages, an editable widget grid, brief/lineage panels, present mode. Logic is in useDashboardPage. */
export default function DashboardDetailPage() {
  const { id } = useParams();
  const d = useDashboardPage(id);
  const df = useDashboardFilterState(d.activePage, d.pages.find((p) => p.id === d.activePage)?.name, d.dashboard?.filters ?? []);
  const refresh = useDashboardRefresh();
  const params = useDashboardParamState(id ?? '');
  const groups = useWidgetGroups(d.widgets);
  const nav = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [printing, setPrinting] = useState<PrintOptions | null>(null);
  const donePrinting = useCallback(() => setPrinting(null), []);
  if (!d.dashboard) return d.error ? <ErrorBanner message={d.error} /> : <Loading />;

  return (
    <DashboardIdContext.Provider value={d.dashboard.id}>
    <DashboardParamsContext.Provider value={params.ctx}>
    <RefreshContext.Provider value={refresh.tick}>
    <DashboardFilterProvider api={df.api}>
    <div className="flex flex-col gap-4">
      <PageHeader
        title={d.dashboard.name}
        actions={
          <DashboardToolbar
            editing={d.editing}
            onToggleEdit={() => nav(`/dashboards/${d.dashboard!.id}/layout`)}
            showBrief={d.showBrief}
            briefBusy={d.briefBusy}
            onBrief={d.toggleBrief}
            showLineage={d.showLineage}
            onLineage={d.toggleLineage}
            onPresent={() => d.setPresenting(true)}
            onPrint={() => setPrintOpen(true)}
            onAdd={() => d.setPickerOpen(true)}
            onAi={() => setAiOpen(true)}
            refresh={refresh.control}
            onShare={() => setShareOpen(true)}
            onDuplicate={async () => { const nid = await d.duplicate(); if (nid) nav(`/dashboards/${nid}`); }}
          />
        }
      />
      <ErrorBanner message={d.error} />
      <DashboardFilterArea df={df} params={params} dashboard={d.dashboard} pages={d.pages} activePage={d.activePage} onSaved={d.load} />
      <FilterViews dashboardId={d.dashboard.id} state={df.state} active={df.active} onApply={df.setState} />

      <PageTabs
        pages={d.pages}
        active={d.activePage}
        onSelect={d.setActivePage}
        adding={d.newPageOpen}
        onAddingChange={d.setNewPageOpen}
        name={d.newPageName}
        onNameChange={d.setNewPageName}
        onAdd={d.addPage}
      />

      {d.showBrief && <BriefCard brief={d.brief} />}
      {d.showLineage && <LineageCard lineage={d.lineage} />}

      <WidgetGrid
        gridX={d.gridX}
        gridY={d.gridY}
        widgets={d.widgets}
        layout={d.layout}
        editing={d.editing}
        onLayoutChange={d.onLayoutChange}
        onAutoFit={d.applyAutoFit}
        onRemove={d.removeWidget}
        onFullscreen={d.setFullscreenWidget}
        onSettings={d.openSettings}
        groups={groups}
      />

      {d.fullscreenWidget && <FullscreenModal widget={d.fullscreenWidget} onClose={() => d.setFullscreenWidget(null)} />}
      {d.settingsWidget && (
        <WidgetSettingsPanel
          widget={d.settingsWidget}
          chart={d.settingsChart}
          onChange={(key, value) => d.updateWidgetSetting(d.settingsWidget!.id, key, value)}
          onClose={() => d.setSettingsWidget(null)}
        />
      )}
      {d.presenting && <PresentMode dashboard={d.dashboard} pages={d.pages} onClose={() => d.setPresenting(false)} />}
      <ShareDialog dashboardId={d.dashboard.id} open={shareOpen} onClose={() => setShareOpen(false)} />
      <PrintDialog open={printOpen} pageCount={d.pages.length} onClose={() => setPrintOpen(false)} onPrint={(o) => { setPrintOpen(false); setPrinting(o); }} />
      {printing && <PrintSheet dashboard={d.dashboard} pages={d.pages} options={printing} onDone={donePrinting} />}
      <DashboardAiPanel open={aiOpen} dashboardId={d.dashboard.id} activePage={d.activePage} onClose={() => setAiOpen(false)} onChanged={(page) => { d.load(); if (page) d.setActivePage(page); }} />
      <AddWidgetDialog open={d.pickerOpen} charts={d.charts} dashboardId={d.dashboard.id} page={d.activePage} onPick={d.addWidget} onContent={(k) => { d.setPickerOpen(false); d.setContentNew(k); }} onClose={() => d.setPickerOpen(false)} />
      {(d.contentNew || d.contentEdit) && (
        <ContentDialog open kind={d.contentEdit ? (d.contentEdit.kind as 'text' | 'link' | 'iframe') : d.contentNew!} widget={d.contentEdit}
          onSave={d.saveContent} onClose={() => { d.setContentEdit(null); d.setContentNew(null); }} />
      )}
    </div>
    </DashboardFilterProvider>
    </RefreshContext.Provider>
    </DashboardParamsContext.Provider>
    </DashboardIdContext.Provider>
  );
}
