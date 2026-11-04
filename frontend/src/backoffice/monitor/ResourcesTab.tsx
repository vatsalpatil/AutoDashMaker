import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { bytes, num } from '../format';
import { StatGrid, StatTile } from '../parts/StatTile';
import { Meter, SeriesChart, usePoll, type Row } from './charts';
import { uptime } from './LiveTab';

const pct = (a?: number | null, b?: number | null) => (a != null && b ? (100 * a) / b : null);

/** Host + process resources (polled every 3 s) and storage sizes. */
export function ResourcesTab({ paused }: { paused: boolean }) {
  const live = usePoll<Row>('/admin/monitor/live', 3000, !paused);
  const sys = useApi<Row>('/admin/system');
  return (
    <AsyncView state={live}>{(l) => {
      const h = l.host, m = h.mem;
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Meter label="CPU" pct={h.cpu_pct} hint={`${h.cpus ?? '?'} cores${h.load ? ` · load ${h.load.map((x: number) => x.toFixed(2)).join(' / ')}` : ''}`} />
            <Meter label="Memory" pct={pct(m.used, m.total)} hint={`${bytes(m.used)} of ${bytes(m.total)}`} />
            <Meter label="Swap" pct={pct(m.swap_used, m.swap_total)} hint={`${bytes(m.swap_used)} of ${bytes(m.swap_total)}`} />
            <Meter label="Disk" pct={pct(l.disk.used, l.disk.total)} hint={`${bytes(l.disk.free)} free of ${bytes(l.disk.total)}`} />
          </div>
          {h.cpu_pct == null && <div className="text-xs text-muted-foreground">CPU, memory and network come from /proc, so they show on the Linux server only.</div>}
          <div className="grid gap-3 lg:grid-cols-2">
            <SeriesChart title="CPU & memory %" description="sampled while this page is open" data={h.history} x="time"
              series={[{ key: 'cpu', label: 'CPU %' }, { key: 'mem', label: 'Memory %' }]} />
            <SeriesChart title="Network KB/s" data={h.history} x="time" series={[{ key: 'rx_kb', label: 'In' }, { key: 'tx_kb', label: 'Out' }]} />
            <SeriesChart title="Backend process memory (MB)" data={h.history} x="time" series={[{ key: 'rss_mb', label: 'RSS MB' }]} />
            <SeriesChart title="Requests in flight / min" data={l.per_minute} x="time" bars series={[{ key: 'requests', label: 'Requests' }]} />
          </div>
          <StatGrid>
            <StatTile label="Process memory" value={bytes(h.process.rss)} />
            <StatTile label="Threads" value={num(h.process.threads)} />
            <StatTile label="Open files" value={h.process.open_files ?? '—'} />
            <StatTile label="Uptime" value={uptime(l.uptime_s)} hint={`pid ${h.process.pid}`} />
            <StatTile label="Received" value={bytes(h.net.rx_total)} hint="since boot" />
            <StatTile label="Sent" value={bytes(h.net.tx_total)} hint="since boot" />
            {sys.data && <>
              <StatTile label="Metadata DB" value={bytes(sys.data.files.metadata_db)} />
              <StatTile label="Analytics data" value={bytes(sys.data.files.analytics_dir)} />
              <StatTile label="Uploads" value={bytes(sys.data.files.uploads)} />
              <StatTile label="Python" value={sys.data.process.python} hint={sys.data.process.platform} />
            </>}
          </StatGrid>
        </div>
      );
    }}</AsyncView>
  );
}
