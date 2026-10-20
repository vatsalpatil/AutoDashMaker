import { Badge } from '@/components/ui/kit';
import { ago } from '../format';
import type { ActivityRow } from '../types';
import { SimpleTable } from './SimpleTable';

type Row = Pick<ActivityRow, 'created_at' | 'email' | 'method' | 'path' | 'status' | 'ms'> & Partial<ActivityRow>;

const tone = (s: number) => (s >= 500 ? 'error' : s >= 400 ? 'warning' : 'success');

export function ActivityTable({ rows, showUser = true }: { rows: Row[]; showUser?: boolean }) {
  return (
    <SimpleTable rows={rows} empty="No activity recorded." cols={[
      { label: 'When', cell: (r) => <span title={r.created_at}>{ago(r.created_at)}</span>, className: 'whitespace-nowrap' },
      ...(showUser ? [{ label: 'User', cell: (r: Row) => r.email ?? r.user_id ?? 'anonymous' }] : []),
      { label: 'Request', cell: (r) => <span className="font-mono text-xs"><b>{r.method}</b> {r.path}</span> },
      { label: 'Status', cell: (r) => <Badge variant={tone(r.status)} label={r.status} /> },
      { label: 'Time', cell: (r) => `${Math.round(r.ms)} ms`, className: 'text-right tabular-nums' },
      ...(showUser ? [{ label: 'IP', cell: (r: Row) => <span className="font-mono text-xs">{r.ip}</span> }] : []),
    ]} />
  );
}
