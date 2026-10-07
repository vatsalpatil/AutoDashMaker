import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type Path = (string | number)[];
const isContainer = (v: unknown): v is object => typeof v === 'object' && v !== null;
const preview = (v: unknown) => (Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v as object).length}}`);

function scalar(v: unknown) {
  if (v === null) return <span className="text-muted-foreground">null</span>;
  if (typeof v === 'string') return <span className="text-success">"{v.length > 200 ? `${v.slice(0, 200)}…` : v}"</span>;
  if (typeof v === 'boolean') return <span className="text-info">{String(v)}</span>;
  return <span className="text-warning">{String(v)}</span>;
}

function Node({ name, value, path, depth, forced, onCopyPath }: {
  name?: string | number; value: unknown; path: Path; depth: number; forced: { open: boolean; tick: number }; onCopyPath: (p: Path, v: unknown) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [seen, setSeen] = useState(forced.tick);
  if (seen !== forced.tick) { setSeen(forced.tick); setOpen(forced.open); }  // "expand all" / "collapse all"
  const container = isContainer(value);
  const entries = container ? Object.entries(value as object) : [];
  return (
    <div>
      <div className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent" style={{ paddingLeft: depth * 14 + 4 }}>
        {container
          ? <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="text-muted-foreground">{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button>
          : <span className="w-3.5" />}
        {name !== undefined && <span className="text-info">{String(name)}</span>}
        {name !== undefined && <span className="text-muted-foreground">:</span>}
        {container ? <span className="text-muted-foreground">{preview(value)}</span> : scalar(value)}
        <button type="button" title="Copy path" aria-label="Copy path" onClick={() => onCopyPath(path, value)}
          className="ml-auto hidden text-muted-foreground hover:text-foreground group-hover:block"><Copy className="size-3" /></button>
      </div>
      {container && open && entries.slice(0, 500).map(([k, v]) => (
        <Node key={k} name={Array.isArray(value) ? Number(k) : k} value={v} path={[...path, Array.isArray(value) ? Number(k) : k]} depth={depth + 1} forced={forced} onCopyPath={onCopyPath} />
      ))}
      {container && open && entries.length > 500 && <div className="text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 14 + 22 }}>… {entries.length - 500} more</div>}
    </div>
  );
}

/** Collapsible JSON tree (JSON Editor Online "tree" mode): expand/collapse all, copy a node's path. */
export function JsonTree({ value, className }: { value: unknown; className?: string }) {
  const [forced, setForced] = useState({ open: true, tick: 0 });
  const [copied, setCopied] = useState('');
  const copyPath = (p: Path) => {
    const jp = p.reduce<string>((s, k) => (typeof k === 'number' ? `${s}[${k}]` : /^[A-Za-z_]\w*$/.test(k) ? `${s}.${k}` : `${s}['${k}']`), '$');
    navigator.clipboard?.writeText(jp);
    setCopied(jp);
    setTimeout(() => setCopied(''), 1500);
  };
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 border-b px-2 py-1 text-xs text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={() => setForced((f) => ({ open: true, tick: f.tick + 1 }))}>Expand all</button>
        <button type="button" className="hover:text-foreground" onClick={() => setForced((f) => ({ open: false, tick: f.tick + 1 }))}>Collapse all</button>
        {copied && <span className="ml-auto font-mono text-success">copied {copied}</span>}
      </div>
      <div className="mono min-h-0 flex-1 overflow-auto p-1 text-[13px]">
        <Node value={value} path={[]} depth={0} forced={forced} onCopyPath={copyPath} />
      </div>
    </div>
  );
}
