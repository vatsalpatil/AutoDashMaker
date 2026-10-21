import { useEffect, useState } from 'react';
import { Info, Wrench, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Notice {
  announcement: { text: string; level: 'info' | 'success' | 'warning' } | null;
  maintenance: { message: string } | null;
}

const TONE = {
  info: 'bg-primary/10 text-foreground border-primary/30',
  success: 'bg-emerald-500/10 text-foreground border-emerald-500/30',
  warning: 'bg-amber-500/15 text-foreground border-amber-500/40',
};

/** Announcement / maintenance strip set from the backoffice (GET /api/notice, re-checked every minute). */
export function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api.get<Notice>('/notice').then(setNotice).catch(() => {});
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, []);
  const m = notice?.maintenance;
  const a = notice?.announcement;
  if (m) {
    return (
      <div className={cn('flex items-center gap-2 border-b px-4 py-2 text-sm', TONE.warning)}>
        <Wrench className="size-4 shrink-0" /> <b>Maintenance:</b> {m.message}
      </div>
    );
  }
  if (!a || hidden === a.text) return null;
  return (
    <div className={cn('flex items-center gap-2 border-b px-4 py-2 text-sm', TONE[a.level] ?? TONE.info)}>
      <Info className="size-4 shrink-0" /> <span className="flex-1">{a.text}</span>
      <button aria-label="Dismiss" className="rounded p-0.5 hover:bg-foreground/10" onClick={() => setHidden(a.text)}><X className="size-4" /></button>
    </div>
  );
}
