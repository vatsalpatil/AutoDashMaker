import { useState } from 'react';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import { Button, Dialog } from '@/components/ui/kit';
import { useApi } from '@/hooks/useApi';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

export interface Share { id: string; token: string; expires_at: string | null; active: boolean; views: number; created_at: string }

const EXPIRY = [{ label: '1 day', days: 1 }, { label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: 'Never', days: 0 }];
export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;

function CopyLink({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label="Copy link" title="Copy link" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={() => { navigator.clipboard?.writeText(shareUrl(token)); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  );
}

/** Create, copy and turn off read-only public links to this dashboard. */
export function ShareDialog({ dashboardId, open, onClose }: { dashboardId: string; open: boolean; onClose: () => void }) {
  const list = useApi<Share[]>(open ? `/dashboards/${dashboardId}/shares` : null);
  const [days, setDays] = useState(30);
  const [create, cs] = useAsyncAction(async () => { const s = await api.post<Share>(`/dashboards/${dashboardId}/shares`, { days: days || null }); navigator.clipboard?.writeText(shareUrl(s.token)); list.reload(); });
  const [revoke, rs] = useAsyncAction(async (id: string) => { await api.del(`/dashboards/${dashboardId}/shares/${id}`); list.reload(); });
  const shares = (list.data ?? []).filter((s) => s.active);
  return (
    <Dialog isOpen={open} onOpenChange={(o) => !o && onClose()} className="w-[min(540px,100%)]">
      <div className="min-w-0 space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Link2 className="size-4 text-primary" /> Share dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">Anyone with the link can <b>view</b> this dashboard and its current numbers, without signing in. They cannot see your queries, other dashboards or raw tables, and cannot change anything.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Link expires after</span>
          {EXPIRY.map((e) => (
            <button key={e.label} type="button" aria-pressed={days === e.days} onClick={() => setDays(e.days)}
              className={`rounded-md border px-2 py-1 text-xs ${days === e.days ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent'}`}>{e.label}</button>
          ))}
          <div className="ml-auto"><Button variant="primary" label={cs.busy ? 'Creating…' : 'Create & copy link'} onClick={() => create()} isDisabled={cs.busy} /></div>
        </div>
        {(cs.error || rs.error) && <p className="text-sm text-destructive">{cs.error || rs.error}</p>}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active links</h3>
          {shares.length === 0 ? <p className="text-sm text-muted-foreground">No active links. This dashboard is private.</p> : (
            <ul className="divide-y rounded-md border">
              {shares.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1.5 text-xs">
                  <span className="mono min-w-0 basis-full truncate sm:basis-0 sm:flex-1" title={shareUrl(s.token)}>{shareUrl(s.token)}</span>
                  <span className="min-w-0 flex-1 text-muted-foreground sm:flex-none">{s.views} views · {s.expires_at ? `expires ${new Date(s.expires_at).toLocaleDateString()}` : 'never expires'} · {timeAgo(s.created_at)}</span>
                  <CopyLink token={s.token} />
                  <button type="button" aria-label="Turn off link" title="Turn off link" onClick={() => revoke(s.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
