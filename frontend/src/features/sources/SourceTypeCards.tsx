import { useRef } from 'react';
import { Cloud, Database, FileUp, HardDrive, Link2, Server, Share2, Sheet, Webhook } from 'lucide-react';

type Item = { id: string; title: string; blurb: string; icon: React.ReactNode };
type Domain = { title: string; lead: string; icon: React.ReactNode; items: Item[] };

/** Get-data gallery grouped by where the data lives (Power BI "Get data" / Hex connections). Each option appears once. */
const DOMAINS: Domain[] = [
  {
    title: 'Files', lead: 'A spreadsheet or data file', icon: <FileUp />,
    items: [
      { id: 'file', title: 'Upload a file', blurb: 'CSV, Excel, Parquet or JSON from your computer', icon: <FileUp /> },
      { id: 'url', title: 'File from a link', blurb: 'A public URL to one of those files', icon: <Link2 /> },
    ],
  },
  {
    title: 'Databases', lead: 'Copy tables in or query them live', icon: <Database />,
    items: [
      { id: 'postgres', title: 'PostgreSQL', blurb: 'Also Supabase, Redshift, Neon, CockroachDB', icon: <Database /> },
      { id: 'mysql', title: 'MySQL', blurb: 'Also MariaDB, TiDB, PlanetScale', icon: <Server /> },
      { id: 'sqlite', title: 'SQLite', blurb: 'A .sqlite / .db file on the server', icon: <HardDrive /> },
    ],
  },
  {
    title: 'Apps & APIs', lead: 'Online services and web endpoints', icon: <Cloud />,
    items: [
      { id: 'gsheets', title: 'Google Sheets', blurb: 'A sheet shared as "anyone with the link"', icon: <Sheet /> },
      { id: 'rest', title: 'REST API', blurb: 'Any JSON endpoint; records found automatically', icon: <Webhook /> },
      { id: 'graphql', title: 'GraphQL', blurb: 'A query against a GraphQL endpoint', icon: <Share2 /> },
    ],
  },
];

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.parquet,.json,.jsonl';

/** Step 1 of adding data: pick the kind of source. "Upload a file" opens the file picker straight away. */
export function SourceTypeCards({ onPick, onFile }: { onPick: (id: string) => void; onFile?: (file: File) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const choose = (id: string) => (id === 'file' && onFile ? fileInput.current?.click() : onPick(id));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {DOMAINS.map((d) => (
        <section key={d.title} className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
          <header className="flex items-center gap-2 px-1">
            <span className="text-primary [&>svg]:size-4">{d.icon}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">{d.title}</h3>
              <p className="text-xs text-muted-foreground">{d.lead}</p>
            </div>
          </header>
          <div className="flex flex-col gap-1.5">
            {d.items.map((it) => (
              <button key={it.id} type="button" onClick={() => choose(it.id)}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:size-4">{it.icon}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{it.title}</span>
                  <span className="text-xs text-muted-foreground">{it.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" aria-hidden tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile?.(f); }} />
    </div>
  );
}
