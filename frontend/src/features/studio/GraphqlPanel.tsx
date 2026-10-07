import { useRef, useState } from 'react';
import { BookOpen, History, Loader2, Play } from 'lucide-react';
import { CodeEditor, type CodeEditorHandle } from '@/components/common/CodeEditor';
import { Button } from '@/components/ui/kit';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { parseLoose } from '@/lib/jsonTools';
import { cn } from '@/lib/utils';
import { AuthEditor } from './AuthEditor';
import { HistoryList } from './HistoryList';
import { KeyValueEditor } from './KeyValueEditor';
import { ResponseViewer } from './ResponseViewer';
import { SchemaExplorer, INTROSPECTION_QUERY, type IntrospectionSchema } from './SchemaExplorer';
import { buildGraphql, newGraphql, readEnv, type GraphqlDraft, type ProxyResponse } from './studioModel';
import { useSend } from './useSend';


type Tab = 'query' | 'variables' | 'headers' | 'auth';
type Side = 'none' | 'docs' | 'history';

/** GraphQL workspace: query + variables, headers/auth, schema docs from introspection, and the same response views as REST. */
export function GraphqlPanel() {
  const [draft, setDraft] = useLocalStorage<GraphqlDraft>('studio.graphql', newGraphql());
  const [tab, setTab] = useState<Tab>('query');
  const [side, setSide] = useState<Side>('none');
  const [schema, setSchema] = useState<IntrospectionSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const editor = useRef<CodeEditorHandle>(null);
  const s = useSend();
  const set = (patch: Partial<GraphqlDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const run = () => {
    if (!draft.url.trim() || s.loading) return;
    try { s.send(buildGraphql(draft, readEnv()), 'graphql', draft); } catch (e) { s.setResponse(null); alert((e as Error).message); }
  };

  async function loadSchema() {
    setSide('docs'); setLoadingSchema(true); setSchemaError(null);
    try {
      const r = await api.post<ProxyResponse>('/studio/request', buildGraphql({ ...draft, query: INTROSPECTION_QUERY, variables: '{}' }, readEnv()));
      const parsed = parseLoose(r.body).value as { data?: { __schema?: IntrospectionSchema }; errors?: { message: string }[] } | undefined;
      if (!parsed?.data?.__schema) throw new Error(parsed?.errors?.[0]?.message ?? 'The server did not return a schema (introspection may be disabled).');
      setSchema(parsed.data.__schema);
    } catch (e) { setSchemaError((e as Error).message); } finally { setLoadingSchema(false); }
  }

  const saveSource = async (name: string, recordPath: string) => {
    const r = buildGraphql(draft, readEnv());
    const { query, variables } = JSON.parse(r.body ?? '{}');
    const headers = Object.fromEntries(Object.entries(r.headers).filter(([k]) => k.toLowerCase() !== 'content-type'));
    await api.post('/sources', { name, type: 'graphql', config: { url: r.url, query, variables, headers, record_path: recordPath, flatten_sep: '_' } });
  };

  const tabs: [Tab, string][] = [['query', 'Query'], ['variables', 'Variables'], ['headers', 'Headers'], ['auth', 'Auth']];
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <input value={draft.url} onChange={(e) => set({ url: e.target.value })} spellCheck={false} aria-label="GraphQL endpoint" placeholder="https://api.example.com/graphql"
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
            className="h-8 min-w-48 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          <Button variant="primary" icon={s.loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} label="Run" onClick={run} isDisabled={s.loading || !draft.url.trim()} title="Run (Ctrl+Enter)" />
          <Button variant="secondary" icon={<BookOpen className="size-4" />} label="Docs" onClick={() => (side === 'docs' ? setSide('none') : schema ? setSide('docs') : loadSchema())} />
          <Button variant="ghost" icon={<History className="size-4" />} aria-label="History" onClick={() => setSide(side === 'history' ? 'none' : 'history')} />
        </div>
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={46} minSize={15}>
            <div className="flex h-full flex-col">
              <div className="flex gap-1 border-b px-2">
                {tabs.map(([t, label]) => <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
                  className={cn('border-b-2 px-3 py-1.5 text-sm font-medium', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>)}
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {tab === 'query' && <CodeEditor ref={editor} value={draft.query} onChange={(query) => set({ query })} onRun={run} height="100%" placeholder="{ products { id name } }" />}
                {tab === 'variables' && <CodeEditor value={draft.variables} onChange={(variables) => set({ variables })} language="json" onRun={run} height="100%" />}
                {tab === 'headers' && <div className="p-3"><KeyValueEditor rows={draft.headers} onChange={(headers) => set({ headers })} keyPlaceholder="Header" /></div>}
                {tab === 'auth' && <AuthEditor auth={draft.auth} onChange={(auth) => set({ auth })} />}
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={54} minSize={20}>
            {s.error && <p className="m-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{s.error}</p>}
            {s.response ? <ResponseViewer response={s.response} defaultName="graphql" onSaveSource={saveSource} />
              : !s.error && <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground"><div><p className="font-medium text-foreground">Run a query to see the response</p><p className="mt-1">Open <b>Docs</b> to browse the schema, click a field to insert it, then save the result as a dataset or a refreshable source.</p></div></div>}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {side === 'docs' && (
        <aside className="w-80 shrink-0 border-l">
          {loadingSchema && <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading schema…</p>}
          {schemaError && <p className="p-3 text-sm text-destructive">{schemaError}</p>}
          {schema && <SchemaExplorer schema={schema} onInsert={(snippet) => { setTab('query'); setTimeout(() => editor.current?.insertText(snippet), 0); }} />}
        </aside>
      )}
      {side === 'history' && (
        <aside className="w-72 shrink-0 border-l">
          <HistoryList items={s.history.filter((h) => h.kind === 'graphql')} onClear={s.clearHistory} onToggleSaved={s.toggleSaved} onPick={(h) => { setDraft(h.draft as GraphqlDraft); setSide('none'); }} />
        </aside>
      )}
    </div>
  );
}
