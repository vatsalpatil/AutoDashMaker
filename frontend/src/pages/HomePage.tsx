import { useNavigate } from 'react-router-dom';
import { AttentionPanel } from '@/components/AttentionPanel';
import { Loading } from '@/components/common/Loading';
import { AskBar } from '@/features/home/AskBar';
import { ChartPreviews } from '@/features/home/ChartPreviews';
import { RecentWork } from '@/features/home/RecentWork';
import { DataPanel, QuickActions, TryAsking } from '@/features/home/SidePanels';
import { StartHere } from '@/features/home/StartHere';
import { StatTiles } from '@/features/home/StatTiles';
import { useApi } from '@/hooks/useApi';
import type { Alert, Chart, Dashboard, Dataset } from '@/lib/types';

/** Home: where the app opens. A working overview: ask, see totals, pick up recent work, check data and alerts. */
export default function HomePage() {
  const nav = useNavigate();
  const datasets = useApi<Dataset[]>('/datasets');
  const dashboards = useApi<Dashboard[]>('/dashboards').data ?? [];
  const charts = useApi<Chart[]>('/charts').data ?? [];
  const alerts = useApi<Alert[]>('/alerts').data ?? [];
  const list = datasets.data ?? [];
  const questions = useApi<{ questions: string[] }>(list.length ? '/ai/suggestions' : null).data?.questions ?? [];
  if (datasets.loading && !datasets.data) return <Loading />;

  const counts = { datasets: list.length, dashboards: dashboards.length, charts: charts.length, alerts: alerts.filter((a) => a.active).length };
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 pb-6">
      <AskBar hasData={list.length > 0} />
      <StatTiles counts={counts} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {list.length === 0 ? <StartHere /> : <><RecentWork dashboards={dashboards} charts={charts} /><ChartPreviews charts={charts} /></>}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {list.length > 0 && <AttentionPanel />}
          <DataPanel datasets={list} />
          <TryAsking questions={questions} onAsk={() => nav('/ask')} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
