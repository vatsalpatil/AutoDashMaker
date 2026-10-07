import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface TypeRef { kind: string; name?: string | null; ofType?: TypeRef | null }
interface Field { name: string; args?: { name: string; type: TypeRef }[]; type: TypeRef }
interface GqlType { kind: string; name: string; fields?: Field[] | null }
export interface IntrospectionSchema { queryType?: { name: string } | null; mutationType?: { name: string } | null; types: GqlType[] }

export const INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    queryType { name } mutationType { name }
    types { kind name fields { name args { name type { ...T } } type { ...T } } }
  }
}
fragment T on __Type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }`;

/** `[Product!]!` style label and the underlying named type. */
function label(t: TypeRef): { text: string; named: string } {
  if (t.kind === 'NON_NULL' && t.ofType) { const i = label(t.ofType); return { text: `${i.text}!`, named: i.named }; }
  if (t.kind === 'LIST' && t.ofType) { const i = label(t.ofType); return { text: `[${i.text}]`, named: i.named }; }
  return { text: t.name ?? '?', named: t.name ?? '' };
}

/** Docs panel: the root Query (and Mutation) fields; click one to see its type's fields, click a field to insert it. */
export function SchemaExplorer({ schema, onInsert }: { schema: IntrospectionSchema; onInsert: (snippet: string) => void }) {
  const byName = useMemo(() => new Map(schema.types.map((t) => [t.name, t])), [schema]);
  const roots = [schema.queryType?.name, schema.mutationType?.name].filter((n): n is string => !!n);
  const [stack, setStack] = useState<string[]>([]);
  const current = stack[stack.length - 1];
  const list = current ? [byName.get(current)] : roots.map((n) => byName.get(n));

  return (
    <div className="flex h-full min-h-0 flex-col text-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {stack.length > 0 && <button type="button" aria-label="Back" onClick={() => setStack((s) => s.slice(0, -1))} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /></button>}
        <h3 className="font-semibold">{current ?? 'Schema'}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {list.map((t) => t && (
          <section key={t.name} className="mb-3">
            {!current && <h4 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.name}</h4>}
            {(t.fields ?? []).map((f) => {
              const ret = label(f.type);
              const args = (f.args ?? []).map((a) => `${a.name}: ${label(a.type).text}`).join(', ');
              const drill = byName.get(ret.named)?.fields?.length ? ret.named : null;
              return (
                <div key={f.name} className="group flex items-start gap-1 rounded px-1 py-1 hover:bg-accent">
                  <button type="button" className="min-w-0 flex-1 text-left" title="Insert into the query" onClick={() => onInsert(drill ? `${f.name} {\n    \n  }` : f.name)}>
                    <span className="mono text-info">{f.name}</span>{args && <span className="mono text-xs text-muted-foreground">({args})</span>}
                    <span className="mono text-xs text-muted-foreground">: {ret.text}</span>
                  </button>
                  {drill && <button type="button" onClick={() => setStack((s) => [...s, drill])} className="hidden text-xs text-primary hover:underline group-hover:block">fields →</button>}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
