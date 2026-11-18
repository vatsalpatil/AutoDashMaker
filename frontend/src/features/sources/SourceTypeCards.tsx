import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Database, FileUp, Link2, Sheet } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tile = { id: string; title: string; blurb: string; icon: React.ReactNode; tags?: string[] };

/** One row, one tile per thing the user knows they have (research: docs/product/ux/data-workbench-builder.md → "Add data").
 *  APIs are added from API Studio (linked under the row), which is the better place to build and test a request. */
const TILES: Tile[] = [
  { id: 'file', title: 'Upload a file', blurb: 'From your computer', icon: <FileUp />, tags: ['CSV', 'Excel', 'Parquet', 'JSON'] },
  { id: 'gsheets', title: 'Google Sheets', blurb: 'A sheet shared as "anyone with the link"', icon: <Sheet /> },
  { id: 'url', title: 'File from a link', blurb: 'A public URL to a data file', icon: <Link2 /> },
  { id: 'postgres', title: 'Database', blurb: 'Copy tables in, or query them live', icon: <Database />, tags: ['PostgreSQL', 'MySQL'] },
];
const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.parquet,.json,.jsonl';

function TileButton({ t, onClick, primary }: { t: Tile; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex h-full items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
        primary && 'border-primary/50 bg-primary/5')}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-[18px]">{t.icon}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold">{t.title}</span>
        <span className="text-xs text-muted-foreground">{t.blurb}</span>
        {t.tags && (
          <span className="flex flex-wrap gap-1 pt-0.5">
            {t.tags.map((x) => <span key={x} className="rounded border px-1.5 py-px text-[11px] text-muted-foreground">{x}</span>)}
          </span>
        )}
      </span>
    </button>
  );
}

/** Step 1 of adding data. "Upload a file" opens the file picker straight away; the others open their form. */
export function SourceTypeCards({ onPick, onFile }: { onPick: (id: string) => void; onFile?: (file: File) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const choose = (id: string) => (id === 'file' && onFile ? fileInput.current?.click() : onPick(id));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t, i) => <TileButton key={t.id} t={t} primary={i === 0} onClick={() => choose(t.id)} />)}
      </div>
      <p className="text-xs text-muted-foreground">
        Adding a REST or GraphQL API? Build and test it in <Link to="/sources/studio" className="font-medium text-primary hover:underline">API Studio</Link>, then save it as a source.
      </p>
      <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" aria-hidden tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile?.(f); }} />
    </div>
  );
}
