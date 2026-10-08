import { useNavigate } from 'react-router-dom';
import { AttentionPanel } from '@/components/AttentionPanel';
import { Loading } from '@/components/common/Loading';
import { AskBar } from '@/features/home/AskBar';
import { ChartPreviews } from '@/features/home/ChartPreviews';
import { ExampleQuestions, HowItWorks } from '@/features/home/GettingStarted';
import { HomeHeader } from '@/features/home/HomeHeader';
import { RecentWork } from '@/features/home/RecentWork';
import { DataPanel, QuickActions, TryAsking } from '@/features/home/SidePanels';
import { StartHere } from '@/features/home/StartHere';
import { StatTiles } from '@/features/home/StatTiles';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { Alert, Chart, Dashboard, Dataset } from '@/lib/types';

/** Home: where the app opens. A working overview: ask, see totals, pick up recent work, check data and alerts. */
export default function HomePage() {
  const nav = useNavigate();
  const datasets = useApi<Dataset[]>('/datasets');
  const dashboards = useApi<Dashboard[]>('/dashboards').data ?? [];
  const charts = useApi<Chart[]>('/charts').data ?? [];
  const alerts = useApi<Alert[]>('/alerts').data ?? [];
  const list = datasets.data ?? [];
  const hasData = list.length > 0;
  const questions = useApi<{ questions: string[] }>(hasData ? '/ai/suggestions' : null).data?.questions ?? [];
  if (datasets.loading && !datasets.data) return <Loading />;

  const counts = { datasets: list.length, dashboards: dashboards.length, charts: charts.length, alerts: alerts.filter((a) => a.active).length };
  // Both columns stretch to the same height; the last card of each grows and spreads its rows evenly, so nothing is hollow.
  const stretch = 'items-stretch [&>div>section:last-child]:flex-1';
  return (
    <div className="mx-auto flex min-h-[calc(100svh-5.5rem)] w-full min-w-0 max-w-7xl flex-col gap-4 pb-2">
      <HomeHeader hasData={hasData} />
      <AskBar hasData={hasData} />
      <StatTiles counts={counts} />
      <QuickActions />
      <div className={cn('grid flex-1 gap-4 lg:grid-cols-3', stretch)}>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {hasData ? <RecentWork dashboards={dashboards} charts={charts} /> : <><StartHere /><HowItWorks /></>}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <DataPanel datasets={list} />
          {hasData ? <TryAsking questions={questions} onAsk={() => nav('/ask')} /> : <ExampleQuestions />}
        </div>
      </div>
      {hasData && <><ChartPreviews charts={charts} /><AttentionPanel /></>}
    </div>
  );
}
