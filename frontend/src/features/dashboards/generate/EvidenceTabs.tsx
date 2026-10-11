import { useState } from 'react';
import { DataGrid } from '@/components/common/DataGrid';
import { Tab, TabList } from '@/components/ui/kit';
import type { Evidence } from './useGenerateSession';

const DESCRIBE_COLS = ['column', 'type', 'role', 'empty_pct', 'distinct', 'min', 'p25', 'median', 'p75', 'max', 'mean', 'std'];

/** What the AI looked at, shown to you too: DESCRIBE-style statistics, the top 100 rows, and correlations between measures. */
export function EvidenceTabs({ evidence }: { evidence: Evidence }) {
  const [tab, setTab] = useState('describe');
  return (
    <div className="flex flex-col gap-2">
      <TabList value={tab} onChange={setTab} aria-label="What the AI looked at">
        <Tab value="describe" label="Describe" />
        <Tab value="rows" label={`Top ${evidence.sample.rows.length} rows`} />
        <Tab value="corr" label="Correlations" />
      </TabList>
      {tab === 'describe' && <DataGrid columns={DESCRIBE_COLS} rows={evidence.describe as unknown as Record<string, unknown>[]} maxHeight="22rem" leftAlign expandable={false} />}
      {tab === 'rows' && <DataGrid columns={evidence.sample.columns} rows={evidence.sample.rows} maxHeight="22rem" expandable={false} />}
      {tab === 'corr' && (
        evidence.correlations.length === 0
          ? <p className="text-sm text-muted-foreground">Fewer than two numeric measures, so there is nothing to correlate.</p>
          : <ul className="flex flex-col gap-1.5 text-sm">
            {evidence.correlations.map((c) => (
              <li key={`${c.a}${c.b}`} className="flex items-center gap-3">
                <span className="w-56 truncate">{c.a} ↔ {c.b}</span>
                <span className="h-2 w-40 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.abs(c.r) * 100}%`, opacity: c.r < 0 ? 0.5 : 1 }} /></span>
                <span className="mono text-xs">{c.r}</span>
              </li>
            ))}
          </ul>
      )}
    </div>
  );
}
