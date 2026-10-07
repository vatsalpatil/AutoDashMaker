import { useMemo, useState } from 'react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { Button } from '@/components/ui/kit';
import { queryJson, stringify } from '@/lib/jsonTools';

const EXAMPLES = ['$..name', '$.items[0]', '$.items[?(@.price>10)]', '$..[?(@.id)]'];

/** JSONPath over the document with a live result; "Use as document" replaces the editor content with the result. */
export function JsonQuery({ value, onApply }: { value: unknown; onApply: (json: string) => void }) {
  const [expr, setExpr] = useState('$');
  const result = useMemo(() => {
    try { return { text: stringify(queryJson(value, expr)), error: null as string | null }; }
    catch (e) { return { text: '', error: (e as Error).message }; }
  }, [value, expr]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <input value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} aria-label="JSONPath query" placeholder="$.items[?(@.price>10)].name"
          className="mono h-8 min-w-48 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        <Button variant="secondary" size="sm" label="Use as document" onClick={() => result.text && onApply(result.text)} isDisabled={!result.text} />
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-2 py-1.5">
        {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setExpr(e)} className="mono rounded-full border bg-card px-2 py-0.5 text-xs hover:border-primary hover:text-primary">{e}</button>)}
      </div>
      {result.error ? <p className="p-3 text-sm text-destructive">{result.error}</p> : <div className="min-h-0 flex-1"><CodeEditor value={result.text} language="json" readOnly height="100%" /></div>}
    </div>
  );
}
