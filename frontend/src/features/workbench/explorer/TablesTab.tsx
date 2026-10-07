import { useEffect, useMemo, useRef, useState } from 'react';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { Columns3, CornerDownLeft, Database, Play, Table2 } from 'lucide-react';
import { Tree, TreeItem, TreeItemLabel } from '@/components/reui/tree';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import type { Dataset, DatasetSchema, Source } from '@/lib/types';

interface Node { name: string; children?: string[]; kind: 'root' | 'schema' | 'table' | 'column' | 'preview'; table?: string; dtype?: string; ident?: string; rows?: number }

const ident = (n: string) => (/^[a-z_][a-z0-9_]*$/i.test(n) ? n : `"${n.replace(/"/g, '""')}"`);
const short = (n?: number) => (n == null ? '' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const INDENT = 16;

/** Where a table lives: its connection's name, "Files" for uploads, "Derived" for blends / transforms. */
function schemaOf(d: Dataset, sources: Map<string, string>): string {
  if (d.kind === 'derived' || d.kind === 'blend') return 'Derived';
  if (d.kind === 'file') return 'Files';
  return (d.source_id && sources.get(d.source_id)) || d.kind || 'Other';
}

/** Tables of the workspace as a ReUI Tree: schema → table → (preview + columns, loaded on demand). */
export function TablesTab({ datasets, onInsert, onRun }: {
  datasets: Dataset[];
  onInsert: (text: string) => void;
  onRun: (sql: string) => void;
}) {
  const sources = useApi<Source[]>('/sources').data;   // schema names come from the connections: wait, so tree ids never change under it
  const names = useMemo(() => new Map((sources ?? []).map((x) => [x.id, x.name])), [sources]);
  if (!sources) return <p className="p-2 text-xs text-muted-foreground">Loading…</p>;
  if (datasets.length === 0) return <p className="p-2 text-xs text-muted-foreground">No match.</p>;
  return <StructuredTables datasets={datasets} sourceNames={names} onInsert={onInsert} onRun={onRun} />;
}

function StructuredTables({ datasets, sourceNames, onInsert, onRun }: { datasets: Dataset[]; sourceNames: Map<string, string>; onInsert: (t: string) => void; onRun: (s: string) => void }) {
  const [schemas, setSchemas] = useState<Record<string, DatasetSchema>>({});
  const asked = useRef(new Set<string>());

  // fetch column lists in the background; the tree shows them as soon as they arrive
  useEffect(() => {
    for (const d of datasets) {
      if (asked.current.has(d.id)) continue;
      asked.current.add(d.id);
      api.get<DatasetSchema>(`/datasets/${d.id}/schema`).then((s) => setSchemas((p) => ({ ...p, [d.id]: s }))).catch(() => {});
    }
  }, [datasets]);

  const items = useMemo(() => {
    const groups = new Map<string, Dataset[]>();
    for (const d of datasets) {
      const g = schemaOf(d, sourceNames);
      groups.set(g, [...(groups.get(g) ?? []), d]);
    }
    const m: Record<string, Node> = { root: { name: 'Schemas', kind: 'root', children: [...groups.keys()].sort().map((g) => `s:${g}`) } };
    for (const [g, list] of groups) m[`s:${g}`] = { name: g, kind: 'schema', rows: list.length, children: list.map((d) => `t:${d.id}`) };
    for (const d of datasets) {
      const name = d.name;   // the dataset's own name: SQL accepts it (the server maps it to the physical table)
      const cols = schemas[d.id]?.columns ?? [];
      m[`t:${d.id}`] = { name, kind: 'table', ident: ident(name), rows: d.row_count, children: [`p:${d.id}`, ...cols.map((c) => `c:${d.id}:${c.name}`)] };
      m[`p:${d.id}`] = { name: 'Preview first 100 rows', kind: 'preview', table: ident(name) };
      for (const c of cols) m[`c:${d.id}:${c.name}`] = { name: c.name, kind: 'column', dtype: c.dtype, ident: ident(c.name) };
    }
    return m;
  }, [datasets, schemas, sourceNames]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const tree = useTree<Node>({
    rootItemId: 'root',
    indent: INDENT,
    getItemName: (i) => i.getItemData().name,
    isItemFolder: (i) => (i.getItemData().children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (id) => itemsRef.current[id] ?? { name: id, kind: 'column' as const },   // a stale id (filter changed) must not crash the tree
      getChildren: (id) => itemsRef.current[id]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });
  const opened = useRef(new Set<string>());
  useEffect(() => {
    tree.rebuildTree();
    // schemas start expanded (once each), so the tables are visible right away
    for (const id of itemsRef.current.root.children ?? []) {
      if (!opened.current.has(id)) { opened.current.add(id); tree.getItemInstance(id)?.expand(); }
    }
  }, [items, tree]);

  return (
    <Tree indent={INDENT} tree={tree}>
      {tree.getItems().filter((i) => i.getId() !== 'root').map((item) => {
        const n = item.getItemData();
        return (
          <TreeItem key={item.getId()} item={item}>
            {/* the click goes on the label: TreeItem's own onClick is overwritten by the tree library's item props */}
            <TreeItemLabel className="bg-transparent py-1 text-xs"
              onClick={() => { if (n.kind === 'column') onInsert(n.ident ?? n.name); if (n.kind === 'preview') onRun(`SELECT * FROM ${n.table} LIMIT 100`); }}>
              {n.kind === 'schema' && <Database className="size-3.5 text-info" />}
              {n.kind === 'table' && <Table2 className="size-3.5 text-primary" />}
              {n.kind === 'column' && <Columns3 className="size-3 text-muted-foreground" />}
              {n.kind === 'preview' && <Play className="size-3 text-success" />}
              <span className={n.kind === 'table' || n.kind === 'column' ? 'mono truncate' : n.kind === 'schema' ? 'truncate font-semibold' : 'truncate'}>{n.name}</span>
              {n.kind === 'schema' && <span className="ml-auto text-[10px] text-muted-foreground">{n.rows} table{n.rows === 1 ? '' : 's'}</span>}
              {n.kind === 'table' && <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">{short(n.rows)}
                <span role="button" tabIndex={0} title={`Insert ${n.name}`} aria-label={`Insert ${n.name}`}
                  onClick={(e) => { e.stopPropagation(); onInsert(n.ident ?? n.name); }}
                  className="rounded p-0.5 hover:bg-background hover:text-foreground"><CornerDownLeft className="size-3" /></span></span>}
              {n.kind === 'column' && <span className="ml-auto text-[10px] uppercase text-muted-foreground">{n.dtype}</span>}
            </TreeItemLabel>
          </TreeItem>
        );
      })}
    </Tree>
  );
}
