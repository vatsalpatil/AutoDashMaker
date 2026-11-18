import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, LayoutDashboard, Pin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { AnalystResponse, Chart, Dashboard, QueryResult } from '@/lib/types';

/** Save an answer as a chart (query + chart rows). Shared by "Save as chart" and "Pin to dashboard". */
export async function saveAnswerAsChart(question: string, response: AnalystResponse): Promise<Chart> {
  const name = question.slice(0, 80);
  const q = await api.post<QueryResult>('/queries/run', { sql: response.sql ?? '', name, save: true });
  return api.post<Chart>('/charts', { name, query_id: q.query_id, spec: response.chart ?? { type: 'table', encoding: { x: '', y: '' } } });
}

/** One click: put this answer on an existing or new dashboard (like Copilot/Spotter "pin"). */
export function PinToDashboard({ question, response }: { question: string; response: AnalystResponse }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<Dashboard | null>(null);
  const list = useApi<Dashboard[]>(open ? '/dashboards' : null);

  const [pin, { busy, error }] = useAsyncAction(async (target: Dashboard | null) => {
    const chart = await saveAnswerAsChart(question, response);
    const dash = target ?? await api.post<Dashboard>('/dashboards', { name: question.slice(0, 60) || 'New dashboard' });
    // Land on the dashboard's first page (AI dashboards don't use 'main'), right under its last widget there.
    const full = await api.get<Dashboard>(`/dashboards/${dash.id}`);
    const page = full.pages?.[0]?.id ?? 'main';
    const y = (full.widgets ?? []).filter((w) => (w.page ?? 'main') === page).reduce((m, w) => Math.max(m, w.position.y + w.position.h), 0);
    await api.post(`/dashboards/${dash.id}/widgets`, { chart_id: chart.id, page, position: { x: 0, y, w: 6, h: 4 } });
    setPinned(dash);
  });

  if (pinned) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-success">
        <Check className="size-4" /> Pinned to
        <Link to={`/dashboards/${pinned.id}`} className="font-medium text-primary hover:underline">{pinned.name}</Link>
      </span>
    );
  }
  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={busy}><Pin className="size-4" /> {busy ? 'Pinning…' : 'Pin to dashboard'}</Button>} />
        <DropdownMenuContent align="start" className="max-h-[60vh] min-w-[240px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Add this answer to…</DropdownMenuLabel>
            {list.loading && <DropdownMenuItem disabled>Loading dashboards…</DropdownMenuItem>}
            {(list.data ?? []).map((d) => (
              <DropdownMenuItem key={d.id} onClick={() => pin(d)}>
                <LayoutDashboard className="size-4" /> <span className="truncate">{d.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => pin(null)}><Plus className="size-4" /> New dashboard</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  );
}
