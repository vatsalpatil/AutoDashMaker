import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { AsyncView } from '@/components/common/AsyncView';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, Tab, TabList } from '@/components/ui/kit';
import { bytes } from '../format';
import { StatGrid, StatTile } from '../parts/StatTile';
import { Section } from '../parts/Section';
import { SimpleTable } from '../parts/SimpleTable';
import { MaintenanceSwitch } from '../parts/AiSwitch';
import { AnnouncementCard, LimitsCard } from '../parts/PlatformCards';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface SystemInfo {
  process: { python: string; platform: string; pid: number; uptime_s: number; memory_bytes: number | null; cpus: number; load_avg: number[] | null };
  disk: { total: number; used: number; free: number; limit_pct: number };
  files: Record<string, number>; config: Row; secrets_set: Record<string, boolean>;
}

const uptime = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} days`);
const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v ?? '—'));

export function SystemPage() {
  const info = useApi<SystemInfo>('/admin/system');
  const [level, setLevel] = useState('');
  const logs = useApi<Row[]>(`/admin/logs${level ? `?level=${level}` : ''}`);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="System" description="Switches that change the whole platform, and the health of the server."
        actions={<Button size="sm" icon={<RefreshCw className="size-4" />} label="Refresh" onClick={() => { info.reload(); logs.reload(); }} />} />
      <div className="grid gap-3 xl:grid-cols-2">
        <MaintenanceSwitch />
        <AnnouncementCard />
      </div>
      <LimitsCard />
      <AsyncView state={info}>{(s) => {
        const pct = Math.round((s.disk.used / s.disk.total) * 100);
        return (
          <>
            <StatGrid>
              <StatTile label="Uptime" value={uptime(s.process.uptime_s)} hint={`pid ${s.process.pid}`} />
              <StatTile label="Memory (backend)" value={s.process.memory_bytes ? bytes(s.process.memory_bytes) : '—'} />
              <StatTile label="CPU load" value={s.process.load_avg ? s.process.load_avg[0].toFixed(2) : '—'} hint={`${s.process.cpus} cores`} />
              <StatTile label="Disk" value={`${pct}%`} hint={`uploads refused above ${s.disk.limit_pct}%`} tone={pct >= s.disk.limit_pct ? 'bad' : undefined} />
              <StatTile label="Analytics data" value={bytes(s.files.analytics_dir)} hint={`uploads ${bytes(s.files.uploads)}`} />
              <StatTile label="Metadata DB" value={bytes(s.files.metadata_db)} hint={`Python ${s.process.python}`} />
            </StatGrid>
            <div className="grid gap-3 xl:grid-cols-2">
              <Section title="Configuration" description="From the server's environment (read-only here; change it in Dokploy).">
                <SimpleTable rows={Object.entries(s.config)} cols={[
                  { label: 'Setting', cell: ([k]) => <span className="font-mono text-xs">{k.toUpperCase()}</span> },
                  { label: 'Value', cell: ([, v]) => <span className="break-all text-xs">{show(v)}</span> },
                ]} />
              </Section>
              <Section title="Secrets" description="Only whether each one is set: the values never leave the server.">
                <SimpleTable rows={Object.entries(s.secrets_set)} cols={[
                  { label: 'Secret', cell: ([k]) => <span className="font-mono text-xs">{k.toUpperCase()}</span> },
                  { label: 'State', cell: ([, v]) => <Badge variant={v ? 'success' : 'neutral'} label={v ? 'set' : 'not set'} /> },
                ]} />
              </Section>
            </div>
          </>
        );
      }}</AsyncView>
      <Section title="Server log" description="Warnings and errors since the last restart (newest first)."
        actions={<TabList value={level} onChange={setLevel}><Tab value="" label="All" /><Tab value="warning" label="Warnings" /><Tab value="error" label="Errors" /></TabList>}>
        <AsyncView state={logs}>{(rows) => (
          <div className="max-h-[480px] overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs">
            {rows.length === 0 && <div className="p-4 text-center text-muted-foreground">Nothing logged.</div>}
            {rows.map((r, i) => (
              <div key={i} className="border-b border-border/50 py-1 last:border-0">
                <span className="text-muted-foreground">{r.at.slice(5, 19).replace('T', ' ')}</span>{' '}
                <span className={r.level === 'ERROR' || r.level === 'CRITICAL' ? 'text-destructive' : 'text-amber-500'}>{r.level}</span>{' '}
                <span className="text-muted-foreground">{r.logger}</span> <span className="whitespace-pre-wrap">{r.message}</span>
              </div>
            ))}
          </div>
        )}</AsyncView>
      </Section>
    </div>
  );
}
