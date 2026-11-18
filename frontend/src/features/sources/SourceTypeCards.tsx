import { Braces, Database, FileSpreadsheet, Globe, HardDrive, Sheet } from 'lucide-react';
import { Badge } from '@/components/ui/kit';
import { SOURCE_SCHEMAS } from './sourceSchemas';

/** One line per type, shown on the picker card (Power BI "Get data" / Hex connection-gallery style). */
const META: Record<string, { icon: React.ReactNode; blurb: string; group: string }> = {
  postgres: { icon: <Database />, blurb: 'Host, port, user. Copy tables in or query them live.', group: 'Database' },
  mysql: { icon: <Database />, blurb: 'One database, several, or * for all on the server.', group: 'Database' },
  sqlite: { icon: <HardDrive />, blurb: 'A .sqlite / .db file on the server.', group: 'Database' },
  url: { icon: <Globe />, blurb: 'Link to a CSV, Parquet, JSON or Excel file.', group: 'File' },
  gsheets: { icon: <Sheet />, blurb: 'Paste a sheet shared as "anyone with the link".', group: 'Online' },
  rest: { icon: <Braces />, blurb: 'JSON endpoint; records are found automatically.', group: 'Online' },
  graphql: { icon: <Braces />, blurb: 'Query endpoint; test it in API Studio first.', group: 'Online' },
  file: { icon: <FileSpreadsheet />, blurb: 'CSV, Parquet, Excel or JSON: drop it in the upload box.', group: 'File' },
};
const fallback = { icon: <FileSpreadsheet />, blurb: '', group: 'Other' };

/** Step 1 of adding a connection: pick what kind of source it is. */
export function SourceTypeCards({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {SOURCE_SCHEMAS.map((s) => {
        const m = META[s.id] ?? fallback;
        return (
          <button key={s.id} type="button" onClick={() => onPick(s.id)}
            className="flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-4">{m.icon}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-semibold">{s.label}<Badge variant={s.badge} label={m.group} /></span>
              <span className="text-xs text-muted-foreground">{m.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
