import { AttentionPanel } from '@/components/AttentionPanel';
import { Loading } from '@/components/common/Loading';
import { HeroAsk } from '@/features/home/HeroAsk';
import { QuickActions } from '@/features/home/QuickActions';
import { RecentCharts, RecentDashboards, YourData } from '@/features/home/RecentItems';
import { StartHere } from '@/features/home/StartHere';
import { useApi } from '@/hooks/useApi';
import type { Dataset } from '@/lib/types';

/** Home: where the app opens. Ask in one box, jump into any tool, pick up recent work. */
export default function HomePage() {
  const { data: datasets, loading } = useApi<Dataset[]>('/datasets');
  if (loading && !datasets) return <Loading />;
  const list = datasets ?? [];
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      <HeroAsk hasData={list.length > 0} />
      {list.length === 0 && <StartHere />}
      <QuickActions />
      {list.length > 0 && <AttentionPanel />}
      <RecentDashboards />
      <RecentCharts />
      <YourData datasets={list} />
    </div>
  );
}
