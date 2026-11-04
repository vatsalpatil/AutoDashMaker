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
import { RangePicker, rangeQuery, type Range } from '../monitor/RangePicker';

const TABS = [['live', 'Live'], ['traffic', 'Traffic & API'], ['users', 'Users'], ['platform', 'Growth & adoption'], ['resources', 'Resources']];
type Ranged = 'traffic' | 'users' | 'platform';
const RANGES: Record<Ranged, { param: 'hours' | 'days'; presets: [string, string][] }> = {
  traffic: { param: 'hours', presets: [['1', '1h'], ['6', '6h'], ['24', '24h'], ['168', '7d'], ['720', '30d']] },
  users: { param: 'days', presets: [['1', '1d'], ['7', '7d'], ['30', '30d'], ['90', '90d']] },
  platform: { param: 'days', presets: [['30', '30d'], ['90', '90d'], ['365', '1y']] },
};

export function MonitoringPage() {
  const [tab, setTab] = useState('live');
  const [range, setRange] = useState<Record<Ranged, Range>>({ traffic: { preset: '24' }, users: { preset: '7' }, platform: { preset: '30' } });
  const [user, setUser] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const live = tab === 'live' || tab === 'resources';
  const ranged = tab in RANGES ? (tab as Ranged) : null;
  const q = (t: Ranged) => rangeQuery(range[t], RANGES[t].param);
  // a user's detail needs at least a week of history when the list shows only 1 day
  const drillQ = range.users.preset === '1' ? 'days=7' : q('users');
  const openUser = (id: string) => { setUser(id); setTab('users'); };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Monitoring" description="Real-time load, traffic, per-user behaviour, growth and server resources."
        actions={live
          ? <Button size="sm" icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />} label={paused ? 'Resume live' : 'Pause live'} onClick={() => setPaused(!paused)} />
          : ranged && <RangePicker presets={RANGES[ranged].presets} value={range[ranged]} onChange={(r) => setRange({ ...range, [ranged]: r })} />} />
      <div className="overflow-x-auto">
        <TabList value={tab} onChange={(v) => { setTab(v); if (v !== 'users') setUser(null); }}>{TABS.map(([v, l]) => <Tab key={v} value={v} label={l} />)}</TabList>
      </div>
      {tab === 'live' && <LiveTab paused={paused} onUser={openUser} />}
      {tab === 'traffic' && <TrafficTab query={q('traffic')} />}
      {tab === 'users' && (user ? <UserDrill id={user} query={drillQ} onBack={() => setUser(null)} /> : <UsersTab query={q('users')} onUser={setUser} />)}
      {tab === 'platform' && <PlatformTab query={q('platform')} />}
      {tab === 'resources' && <ResourcesTab paused={paused} />}
    </div>
  );
}
