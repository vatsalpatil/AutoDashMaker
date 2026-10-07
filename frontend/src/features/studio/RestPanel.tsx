import { useState } from 'react';
import { History, Layers, Loader2, Send } from 'lucide-react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/kit';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { parseCurl } from '@/lib/jsonTools';
import { cn } from '@/lib/utils';
import { AuthEditor } from './AuthEditor';
import { HistoryList } from './HistoryList';
import { KeyValueEditor } from './KeyValueEditor';
import { ResponseViewer } from './ResponseViewer';
import { buildRest, kv, METHODS, newRest, readEnv, type BodyType, type RestDraft } from './studioModel';
import { useSend } from './useSend';

type Tab = 'params' | 'headers' | 'body' | 'auth';
const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return 'api'; } };

/** REST workspace: method + URL, params / headers / body / auth, send through the server, inspect and save the reply. */
export function RestPanel() {
  const [draft, setDraft] = useLocalStorage<RestDraft>('studio.rest', newRest());
  const [tab, setTab] = useState<Tab>('params');
  const [showHistory, setShowHistory] = useState(false);
  const [paging, setPaging] = useState(false);
  const s = useSend();
  const set = (patch: Partial<RestDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const request = () => buildRest(draft, readEnv());
  const run = () => { if (draft.url.trim() && !s.loading) s.send(request(), 'rest', draft); };

  // pasting a curl command into the URL box fills the whole request (Hoppscotch's "import curl")
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const c = parseCurl(e.clipboardData.getData('text'));
    if (!c) return;
    e.preventDefault();
    const isJson = /json/i.test(c.headers['Content-Type'] ?? '') || /^[\s]*[{[]/.test(c.body);
    set({ method: c.method, url: c.url, headers: [...Object.entries(c.headers).map(([k, v]) => kv(k, v)), kv()], body: c.body, bodyType: c.body ? (isJson ? 'json' : 'text') : 'none' });
    setTab(c.body ? 'body' : 'headers');
  };

  /** Follow Link/next-URL pagination (or count `page` up) and show every page's records as one JSON array. */
  async function allPages() {
    const r = request();
    const page = window.prompt('Query parameter to count pages with (blank = follow the next link / Link header)', '') ?? null;
    if (page === null) return;
    setPaging(true);
    try {
      const out = await api.post<{ records: unknown[]; pages: number; elapsed_ms: number }>('/studio/pages', { ...r, page_param: page.trim() || undefined });
      const body = JSON.stringify(out.records, null, 2);
      s.setResponse({ status: 200, status_text: `${out.pages} pages merged`, ok: true, elapsed_ms: out.elapsed_ms, size: body.length, truncated: false, headers: {}, body, url: r.url });
    } catch (e) { window.alert((e as Error).message); } finally { setPaging(false); }
  }

  const saveSource = async (name: string, recordPath: string) => {
    const r = request();
    await api.post('/sources', { name, type: 'rest', config: { url: r.url, method: r.method, headers: r.headers, params: r.params, body: r.body, record_path: recordPath, flatten_sep: '_' } });
  };

  const tabs: [Tab, string][] = [['params', `Params${draft.params.filter((p) => p.key).length ? ` (${draft.params.filter((p) => p.key).length})` : ''}`], ['headers', `Headers${draft.headers.filter((p) => p.key).length ? ` (${draft.headers.filter((p) => p.key).length})` : ''}`], ['body', 'Body'], ['auth', 'Auth']];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="w-28"><SelectField aria-label="Method" value={draft.method} onChange={(e) => set({ method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</SelectField></div>
          <input value={draft.url} onChange={(e) => set({ url: e.target.value })} onPaste={onPaste} spellCheck={false} aria-label="Request URL"
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }} placeholder="https://api.example.com/items — or paste a curl command"
            className="h-8 min-w-48 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          <Button variant="primary" icon={s.loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} label="Send" onClick={run} isDisabled={s.loading || !draft.url.trim()} title="Send (Ctrl+Enter)" />
          <Button variant="outline" icon={paging ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />} label="All pages" onClick={allPages} isDisabled={paging || !draft.url.trim()} title="Follow pagination and merge every page" />
          <Button variant="ghost" icon={<History className="size-4" />} aria-label="History" onClick={() => setShowHistory((v) => !v)} />
        </div>

        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={42} minSize={15}>
            <div className="flex h-full flex-col">
              <div className="flex gap-1 border-b px-2">
                {tabs.map(([t, label]) => (
                  <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
                    className={cn('border-b-2 px-3 py-1.5 text-sm font-medium', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-auto" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(); }}>
                {tab === 'params' && <div className="p-3"><KeyValueEditor rows={draft.params} onChange={(params) => set({ params })} keyPlaceholder="Parameter" /></div>}
                {tab === 'headers' && <div className="p-3"><KeyValueEditor rows={draft.headers} onChange={(headers) => set({ headers })} keyPlaceholder="Header" /></div>}
                {tab === 'auth' && <AuthEditor auth={draft.auth} onChange={(auth) => set({ auth })} />}
                {tab === 'body' && (
                  <div className="flex h-full flex-col">
                    <div className="flex items-center gap-3 px-3 py-2 text-sm">
                      {(['none', 'json', 'text', 'form'] as BodyType[]).map((t) => (
                        <label key={t} className="flex items-center gap-1.5"><input type="radio" name="bodytype" checked={draft.bodyType === t} onChange={() => set({ bodyType: t })} />{t === 'none' ? 'No body' : t === 'form' ? 'Form (key=value lines)' : t.toUpperCase()}</label>
                      ))}
                    </div>
                    {draft.bodyType !== 'none' && <div className="min-h-0 flex-1 border-t"><CodeEditor value={draft.body} onChange={(body) => set({ body })} language={draft.bodyType === 'json' ? 'json' : 'text'} onRun={run} height="100%" placeholder={draft.bodyType === 'json' ? '{ "key": "value" }' : ''} /></div>}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={58} minSize={20}>
            {s.error && <p className="m-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">{s.error}</p>}
            {s.response
              ? <ResponseViewer response={s.response} defaultName={hostOf(draft.url).replace(/\W+/g, '_')} onSaveSource={saveSource} />
              : !s.error && <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground"><div><p className="font-medium text-foreground">Send a request to see the response</p><p className="mt-1">Ctrl+Enter sends. Paste a curl command into the URL box to import it. Use {'{{variables}}'} from the Environment menu.</p></div></div>}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {showHistory && (
        <aside className="w-72 shrink-0 border-l">
          <HistoryList items={s.history.filter((h) => h.kind === 'rest')} onClear={s.clearHistory} onToggleSaved={s.toggleSaved}
            onPick={(h) => { setDraft(h.draft as RestDraft); setShowHistory(false); }} />
        </aside>
      )}
    </div>
  );
}
