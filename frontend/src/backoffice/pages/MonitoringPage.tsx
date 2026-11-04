import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, Tab, TabList } from '@/components/ui/kit';
import { LiveTab } from '../monitor/LiveTab';
import { TrafficTab } from '../monitor/TrafficTab';
import { UsersTab } from '../monitor/UsersTab';
import { UserDrill } from '../monitor/UserDrill';
import { PlatformTab } from '../monitor/PlatformTab';
import { ResourcesTab } from '../monitor/ResourcesTab';

const TABS = [['live', 'Live'], ['traffic', 'Traffic & API'], ['users', 'Users'], ['platform', 'Growth & adoption'], ['resources', 'Resources']];
const RANGES: Record<string, [string, string][]> = {
  traffic: [['1', '1h'], ['6', '6h'], ['24', '24h'], ['168', '7d'], ['720', '30d']],
  users: [['1', '1d'], ['7', '7d'], ['30', '30d'], ['90', '90d']],
  platform: [['30', '30d'], ['90', '90d'], ['365', '1y']],
};

export function MonitoringPage() {
  const [tab, setTab] = useState('live');
  const [range, setRange] = useState<Record<string, string>>({ traffic: '24', users: '7', platform: '30' });
  const [user, setUser] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const live = tab === 'live' || tab === 'resources';
  const openUser = (id: string) => { setUser(id); setTab('users'); };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Monitoring" description="Real-time load, traffic, per-user behaviour, growth and server resources."
        actions={live
          ? <Button size="sm" icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />} label={paused ? 'Resume live' : 'Pause live'} onClick={() => setPaused(!paused)} />
          : RANGES[tab] && <TabList value={range[tab]} onChange={(v) => setRange({ ...range, [tab]: v })}>{RANGES[tab].map(([v, l]) => <Tab key={v} value={v} label={l} />)}</TabList>} />
      <div className="overflow-x-auto">
        <TabList value={tab} onChange={(v) => { setTab(v); if (v !== 'users') setUser(null); }}>{TABS.map(([v, l]) => <Tab key={v} value={v} label={l} />)}</TabList>
      </div>
      {tab === 'live' && <LiveTab paused={paused} onUser={openUser} />}
      {tab === 'traffic' && <TrafficTab hours={range.traffic} />}
      {tab === 'users' && (user ? <UserDrill id={user} days={range.users === '1' ? '7' : range.users} onBack={() => setUser(null)} /> : <UsersTab days={range.users} onUser={setUser} />)}
      {tab === 'platform' && <PlatformTab days={range.platform} />}
      {tab === 'resources' && <ResourcesTab paused={paused} />}
    </div>
  );
}
