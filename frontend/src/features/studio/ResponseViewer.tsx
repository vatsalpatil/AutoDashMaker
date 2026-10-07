import { useMemo, useState } from 'react';
import { Copy, Download, Loader2, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import { CodeEditor } from '@/components/common/CodeEditor';
import { cn } from '@/lib/utils';
import { describeJson, parseLoose, stringify } from '@/lib/jsonTools';
import { JsonTree } from './JsonTree';
import { RecordsPanel } from './RecordsPanel';
import { formatBytes, statusTone, type ProxyResponse } from './studioModel';

type View = 'pretty' | 'tree' | 'table' | 'headers' | 'raw';

/** A response in Hoppscotch's shape (status, time, size) with JSON Editor Online's views (text / tree / table). */
export function ResponseViewer({ response, defaultName, onSaveSource }: {
  response: ProxyResponse;
  defaultName: string;
  onSaveSource?: (name: string, recordPath: string) => Promise<void>;
}) {
  const parsed = useMemo(() => parseLoose(response.body), [response.body]);
  const isJson = parsed.value !== undefined && !parsed.repaired;
  const [view, setView] = useState<View>('pretty');
  const [explain, setExplain] = useState<{ loading: boolean; text?: string; error?: string } | null>(null);
  async function runExplain() {
    setExplain({ loading: true });
    try {
      const r = await api.post<{ explanation: string }>('/studio/explain', { url: response.url, status: response.status, body: response.body });
      setExplain({ loading: false, text: r.explanation });
    } catch (e) { setExplain({ loading: false, error: (e as Error).message }); }
  }
  const pretty = useMemo(() => (isJson ? stringify(parsed.value) : response.body), [isJson, parsed.value, response.body]);
  const tabs: [View, string][] = [['pretty', 'Body'], ...(isJson ? [['tree', 'Tree'] as [View, string], ['table', 'Table'] as [View, string]] : []), ['headers', `Headers (${Object.keys(response.headers).length})`], ['raw', 'Raw']];
  const active = tabs.some(([v]) => v === view) ? view : 'pretty';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-1.5 text-sm">
        <span className={cn('font-semibold', statusTone(response.status))}>{response.status} {response.status_text}</span>
        <span className="text-muted-foreground">{response.elapsed_ms} ms</span>
        <span className="text-muted-foreground">{formatBytes(response.size)}{response.truncated ? ' (truncated)' : ''}</span>
        {isJson && <span className="text-xs text-muted-foreground">{describeJson(parsed.value)}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={runExplain} disabled={explain?.loading} className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50">{explain?.loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Explain</button>
          <button type="button" title="Copy body" onClick={() => navigator.clipboard?.writeText(response.body)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Copy className="size-4" /></button>
          <button type="button" title="Download body" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([response.body])), download: isJson ? 'response.json' : 'response.txt' }); a.click(); }}><Download className="size-4" /></button>
        </div>
      </div>
      {explain && !explain.loading && (
        <div className="relative border-b bg-primary/5 px-3 py-2 pr-8 text-sm">
          <button type="button" aria-label="Dismiss" onClick={() => setExplain(null)} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          {explain.error ? <p className="text-destructive">{explain.error}</p> : <p className="whitespace-pre-wrap">{explain.text}</p>}
        </div>
      )}
      <div className="flex gap-1 border-b px-2">
        {tabs.map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)} aria-pressed={active === v}
            className={cn('border-b-2 px-3 py-1.5 text-sm font-medium', active === v ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {active === 'pretty' && <CodeEditor value={pretty} language={isJson ? 'json' : 'text'} readOnly height="100%" />}
        {active === 'tree' && <JsonTree value={parsed.value} className="h-full" />}
        {active === 'table' && <RecordsPanel value={parsed.value} defaultName={defaultName} onSaveSource={onSaveSource} />}
        {active === 'headers' && (
          <div className="h-full overflow-auto p-3">
            <table className="w-full text-sm"><tbody className="divide-y">
              {Object.entries(response.headers).map(([k, v]) => <tr key={k}><td className="mono w-1/3 py-1 pr-3 align-top text-info">{k}</td><td className="mono break-all py-1">{v}</td></tr>)}
            </tbody></table>
          </div>
        )}
        {active === 'raw' && <pre className="mono h-full overflow-auto whitespace-pre-wrap break-all p-3 text-xs">{response.body}</pre>}
      </div>
    </div>
  );
}
