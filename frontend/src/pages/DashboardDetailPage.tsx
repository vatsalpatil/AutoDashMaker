import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { WidgetSettingsPanel } from '@/components/WidgetSettingsPanel';
import { AddWidgetDialog } from '@/features/dashboards/AddWidgetDialog';
import { ContentDialog } from '@/features/dashboards/ContentDialog';
import { RefreshContext, useDashboardRefresh } from '@/features/dashboards/dashboardRefresh';
import { DashboardAiPanel } from '@/features/dashboards/DashboardAiPanel';
import { DashboardToolbar } from '@/features/dashboards/DashboardToolbar';
import { FullscreenModal } from '@/features/dashboards/FullscreenModal';
import { BriefCard, LineageCard } from '@/features/dashboards/InsightPanels';
import { PageTabs } from '@/features/dashboards/PageTabs';
import { PresentMode } from '@/features/dashboards/PresentMode';
import { useDashboardPage } from '@/features/dashboards/useDashboardPage';
import { WidgetGrid } from '@/features/dashboards/WidgetGrid';
import { DashboardFilterProvider, useDashboardFilterState } from '@/features/dashboards/dashboardFilters';

/** One dashboard: pages, an editable widget grid, brief/lineage panels, present mode. Logic is in useDashboardPage. */
export default function DashboardDetailPage() {
  const { id } = useParams();
  const d = useDashboardPage(id);
  const df = useDashboardFilterState();
  const refresh = useDashboardRefresh();
  const nav = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  if (!d.dashboard) return d.error ? <ErrorBanner message={d.error} /> : <Loading />;

  return (
    <RefreshContext.Provider value={refresh.tick}>
    <DashboardFilterProvider api={df.api}>
    <div className="flex flex-col gap-4">
      <PageHeader
        title={d.dashboard.name}
        actions={
          <DashboardToolbar
            editing={d.editing}
            onToggleEdit={() => (d.editing ? d.finishEditing() : d.setEditing(true))}
            showBrief={d.showBrief}
            briefBusy={d.briefBusy}
            onBrief={d.toggleBrief}
            showLineage={d.showLineage}
            onLineage={d.toggleLineage}
            onPresent={() => d.setPresenting(true)}
            onAdd={() => d.setPickerOpen(true)}
            onAi={() => setAiOpen(true)}
            refresh={refresh.control}
            onDuplicate={async () => { const nid = await d.duplicate(); if (nid) nav(`/dashboards/${nid}`); }}
          />
        }
      />
      <ErrorBanner message={d.error} />
      {df.bar && <div className="flex flex-wrap items-center gap-2">{df.bar}</div>}

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
        widgets={d.widgets}
        layout={d.layout}
        editing={d.editing}
        onLayoutChange={d.onLayoutChange}
        onRemove={d.removeWidget}
        onFullscreen={d.setFullscreenWidget}
        onSettings={d.openSettings}
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
      <DashboardAiPanel open={aiOpen} dashboardId={d.dashboard.id} onClose={() => setAiOpen(false)} onChanged={d.load} />
      <AddWidgetDialog open={d.pickerOpen} charts={d.charts} onPick={d.addWidget} onContent={(k) => { d.setPickerOpen(false); d.setContentNew(k); }} onClose={() => d.setPickerOpen(false)} />
      {(d.contentNew || d.contentEdit) && (
        <ContentDialog open kind={d.contentEdit ? (d.contentEdit.kind as 'text' | 'link' | 'iframe') : d.contentNew!} widget={d.contentEdit}
          onSave={d.saveContent} onClose={() => { d.setContentEdit(null); d.setContentNew(null); }} />
      )}
    </div>
    </DashboardFilterProvider>
    </RefreshContext.Provider>
  );
}
