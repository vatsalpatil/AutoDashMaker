import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Copy, Download, FileUp, Globe, Minimize2, SortAsc, Trash2, Wrench } from 'lucide-react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import { describeJson, parseLoose, sortKeys, stringify, type Json } from '@/lib/jsonTools';
import { cn } from '@/lib/utils';
import { JsonCompare } from './JsonCompare';
import { JsonSchemaPanel } from './JsonSchemaPanel';
import { JsonQuery } from './JsonQuery';
import { JsonTree } from './JsonTree';
import { RecordsPanel } from './RecordsPanel';
import type { ProxyResponse } from './studioModel';

type View = 'tree' | 'table' | 'query' | 'compare' | 'schema';
const SAMPLE = stringify({ store: { name: 'Demo', items: [{ id: 1, name: 'Dark chocolate', price: 12.5, tags: ['cocoa', 'vegan'], supplier: { country: 'Peru' } }, { id: 2, name: 'Milk chocolate', price: 8, tags: ['milk'], supplier: { country: 'Ghana' } }, { id: 3, name: 'White chocolate', price: 9.5, tags: [], supplier: { country: 'Ecuador' } }] } });

/** JSON workspace (JSON Editor Online style): text editor with format / compact / sort / repair, plus tree, table and query views. */
export function JsonLab() {
  const [text, setText] = useLocalStorage('studio.json.text', SAMPLE);
  const [view, setView] = useState<View>('tree');
  const [parsedText, setParsedText] = useState(text);
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setParsedText(text), 250); return () => clearTimeout(t); }, [text]);  // parse after typing pauses
  const parsed = useMemo(() => parseLoose(parsedText), [parsedText]);
  const strict = useMemo(() => { try { JSON.parse(parsedText); return true; } catch { return false; } }, [parsedText]);

  const apply = (fn: (v: Json) => string, label?: string) => {
    if (parsed.value === undefined) return;
    setText(fn(parsed.value));
    if (label) { setNote(label); setTimeout(() => setNote(null), 2500); }
  };
  async function loadUrl() {
    const url = window.prompt('Load JSON from URL');
    if (!url) return;
    try {
      const r = await api.post<ProxyResponse>('/studio/request', { method: 'GET', url, headers: { Accept: 'application/json' } });
      setText(r.body);
    } catch (e) { setNote((e as Error).message); }
  }
  const tabs: [View, string][] = [['tree', 'Tree'], ['table', 'Table'], ['query', 'Query'], ['compare', 'Compare'], ['schema', 'Schema']];
  const btn = 'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5">
        <button type="button" className={btn} disabled={parsed.value === undefined} onClick={() => apply((v) => stringify(v), 'Formatted')}><AlignLeft className="size-3.5" /> Format</button>
        <button type="button" className={btn} disabled={parsed.value === undefined} onClick={() => apply((v) => JSON.stringify(v), 'Compacted')}><Minimize2 className="size-3.5" /> Compact</button>
        <button type="button" className={btn} disabled={parsed.value === undefined} onClick={() => apply((v) => stringify(sortKeys(v)), 'Keys sorted')}><SortAsc className="size-3.5" /> Sort keys</button>
        <button type="button" className={btn} disabled={strict || parsed.value === undefined} onClick={() => apply((v) => stringify(v), 'Repaired')}><Wrench className="size-3.5" /> Repair</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={btn} onClick={() => file.current?.click()}><FileUp className="size-3.5" /> Open file</button>
        <button type="button" className={btn} onClick={loadUrl}><Globe className="size-3.5" /> From URL</button>
        <button type="button" className={btn} onClick={() => navigator.clipboard?.writeText(text)}><Copy className="size-3.5" /> Copy</button>
        <button type="button" className={btn} onClick={() => Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'document.json' }).click()}><Download className="size-3.5" /> Download</button>
        <button type="button" className={btn} onClick={() => setText('')}><Trash2 className="size-3.5" /> Clear</button>
        {note && <span className="ml-auto text-xs text-success">{note}</span>}
        <input ref={file} type="file" accept=".json,.txt,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ''; }} />
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={45} minSize={20}>
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1"><CodeEditor value={text} onChange={setText} language="json" height="100%" placeholder="Paste or type JSON — sloppy JSON can be repaired automatically" /></div>
            <div className={cn('flex items-center gap-2 border-t px-3 py-1 text-xs', strict ? 'text-success' : parsed.value !== undefined ? 'text-warning' : 'text-destructive')}>
              {text.trim() === '' ? <span className="text-muted-foreground">Empty</span>
                : strict ? <span>✓ Valid JSON · {describeJson(parsed.value)}</span>
                : parsed.value !== undefined ? <span>Not valid JSON, but it can be repaired automatically — click Repair</span>
                : <span className="truncate" title={parsed.error}>✕ {parsed.error}</span>}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex gap-1 border-b px-2">
              {tabs.map(([v, l]) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={cn('border-b-2 px-3 py-1.5 text-sm font-medium', view === v ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{l}</button>)}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {parsed.value === undefined
                ? <p className="p-4 text-sm text-muted-foreground">Fix the JSON on the left to see it here.</p>
                : view === 'tree' ? <JsonTree value={parsed.value} className="h-full" />
                : view === 'table' ? <RecordsPanel value={parsed.value} defaultName="json_records" />
                : view === 'schema' ? <JsonSchemaPanel value={parsed.value} />
                : view === 'compare' ? <JsonCompare value={parsed.value} />
                : <JsonQuery value={parsed.value} onApply={setText} />}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
