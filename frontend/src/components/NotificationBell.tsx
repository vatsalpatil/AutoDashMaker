import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const [unread, setUnread] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const poll = useCallback(() => {
    api.get<AppNotification[]>('/alerts/notifications/list?unread_only=true')
      .then(setUnread)
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 60000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    api.get<AppNotification[]>('/alerts/notifications/list?unread_only=false')
      .then((n) => setRecent(n.slice(0, 15)))
      .catch(() => {});
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markRead(id: string) {
    await api.post(`/alerts/notifications/${id}/read`).catch(() => {});
    setRecent((r) => r.map((n) => (n.id === id ? { ...n, read: true } : n)));
    poll();
  }

  async function markAllRead() {
    await api.post('/alerts/notifications/read-all').catch(() => {});
    setRecent((r) => r.map((n) => ({ ...n, read: true })));
    poll();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted "
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg ">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {recent.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notifications.</p>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/40 ${n.read ? 'opacity-60' : ''}`}
                >
                  <span className="text-sm text-foreground">{n.message}</span>
                  <span className="text-xs text-muted-foreground/70">{relTime(n.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
