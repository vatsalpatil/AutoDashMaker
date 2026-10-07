import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { KeepAlive } from '@/components/layout/KeepAlive';

// Each page loads on first visit, so the first paint ships only the shell.
const AskPage = lazy(() => import('@/pages/AskPage'));
const SourcesPage = lazy(() => import('@/pages/SourcesPage'));
const ApiStudioPage = lazy(() => import('@/pages/ApiStudioPage'));
const DatasetDetailPage = lazy(() => import('@/pages/DatasetDetailPage'));
const WorkbenchPage = lazy(() => import('@/pages/WorkbenchPage'));
const QueryBuilderPage = lazy(() => import('@/pages/QueryBuilderPage'));
const MetricsPage = lazy(() => import('@/pages/MetricsPage'));
const ChartsPage = lazy(() => import('@/pages/ChartsPage'));
const ChartDetailPage = lazy(() => import('@/pages/ChartDetailPage'));
const DashboardsPage = lazy(() => import('@/pages/DashboardsPage'));
const DashboardDetailPage = lazy(() => import('@/pages/DashboardDetailPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const QualityPage = lazy(() => import('@/pages/QualityPage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const GuidePage = lazy(() => import('@/pages/GuidePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

// Pages that hold unsaved work stay mounted while you visit other tabs (see KeepAlive).
const KEPT = {
  '/': <AskPage />, '/sources': <SourcesPage />, '/workbench': <WorkbenchPage />, '/builder': <QueryBuilderPage />,
};

export default function App() {
  return (
    <AppShell>
      <KeepAlive pages={KEPT} />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/sources" element={null} />
        <Route path="/sources/studio" element={<ApiStudioPage />} />
        <Route path="/datasets" element={<Navigate to="/sources" replace />} />
        <Route path="/datasets/:id" element={<DatasetDetailPage />} />
        <Route path="/workbench" element={null} />
        <Route path="/builder" element={null} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/charts/new" element={<ChartDetailPage />} />
        <Route path="/charts/:id" element={<ChartDetailPage />} />
        <Route path="/dashboards" element={<DashboardsPage />} />
        <Route path="/dashboards/:id" element={<DashboardDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/quality" element={<QualityPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
