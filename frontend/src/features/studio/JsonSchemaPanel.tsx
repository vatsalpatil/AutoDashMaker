import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { CodeEditor } from '@/components/common/CodeEditor';
import { inferSchema, validate } from '@/lib/jsonSchema';
import { parseLoose, stringify } from '@/lib/jsonTools';

/** Validate the current document against a JSON Schema; "Infer from document" writes a starting schema to edit. */
export function JsonSchemaPanel({ value }: { value: unknown }) {
  const [text, setText] = useState('');
  const schema = useMemo(() => (text.trim() ? parseLoose(text) : null), [text]);
  const issues = useMemo(() => (schema?.value && typeof schema.value === 'object' ? validate(value, schema.value as Record<string, unknown>) : null), [value, schema]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <button type="button" onClick={() => setText(stringify(inferSchema(value)))} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"><Wand2 className="size-3.5" /> Infer from document</button>
        <span className="text-xs text-muted-foreground">Supports type, required, properties, items, enum, min/max, length, pattern</span>
      </div>
      <div className="h-48 shrink-0 border-b"><CodeEditor value={text} onChange={setText} language="json" height="100%" placeholder='Paste a JSON Schema, e.g. { "type": "array", "items": { "required": ["id"] } }' /></div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        {!schema ? <p className="text-muted-foreground">Add a schema above to validate the document.</p>
          : !issues ? <p className="text-destructive">{schema.error ?? 'The schema must be a JSON object.'}</p>
          : issues.length === 0 ? <p className="text-success">✓ The document is valid against this schema.</p>
          : <><p className="mb-2 text-destructive">{issues.length} problem{issues.length === 1 ? '' : 's'}</p>
              <ul className="space-y-1 font-mono">{issues.map((i, n) => <li key={n}><span className="text-info">{i.path}</span> {i.message}</li>)}</ul></>}
      </div>
    </div>
  );
}
