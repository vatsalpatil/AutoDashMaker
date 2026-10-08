import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card } from '@/components/ui/kit';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { AttentionReport } from '@/lib/types';

const SEVERITY_VARIANT = { high: 'red', medium: 'warning', low: 'neutral' } as const;

/** "What needs my attention?" — ranked signals from alerts, freshness, quality and dashboard anomalies. */
export function AttentionPanel() {
  const [report, setReport] = useState<AttentionReport | null>(null);

  // The first answer is the fast report; while the server finishes the deep dashboard scan, check back a few times.
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const load = () => api.get<AttentionReport>('/attention').then((r) => {
      if (!alive) return;
      setReport(r);
      if (r.deep_pending && tries++ < 8) setTimeout(load, 4000);
    }).catch(() => alive && setReport(null));
    load();
    return () => { alive = false; };
  }, []);

  if (!report) return null;

  if (report.all_clear) {
    return (
      <Card padding={4}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Nothing needs your attention right now — alerts, data freshness, quality and dashboards look normal.
        </div>
      </Card>
    );
  }

  return (
    <Card padding={4}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold">What needs your attention</h2>
          <span className="text-xs text-muted-foreground">
            {report.summary.high} high · {report.summary.medium} medium
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {report.items.slice(0, 8).map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Badge variant={SEVERITY_VARIANT[item.severity]} label={item.severity} />
              <Link to={item.link} className="min-w-0 hover:underline">
                <span className="font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
        {report.items.length > 8 && (
          <p className="text-xs text-muted-foreground">+ {report.items.length - 8} more</p>
        )}
      </div>
    </Card>
  );
}
