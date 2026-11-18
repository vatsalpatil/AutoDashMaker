import { useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, TextInput } from '@/components/ui/kit';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { api } from '@/lib/api';
import type { SemanticDefinition, SemanticSynonym } from '@/lib/types';

/** Business language the AI should know: definitions ("Active customer = …") and synonyms ("sales" means net_revenue). */
export function GlossaryPanel({ definitions, synonyms, onChanged }: { definitions: SemanticDefinition[]; synonyms: SemanticSynonym[]; onChanged: () => void }) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [word, setWord] = useState('');
  const [mapsTo, setMapsTo] = useState('');
  const [addDef, { busy: b1 }] = useAsyncAction(async () => { await api.post('/semantic/definitions', { term: term.trim(), definition: definition.trim() }); setTerm(''); setDefinition(''); onChanged(); });
  const [addSyn, { busy: b2 }] = useAsyncAction(async () => { await api.post('/semantic/synonyms', { term: word.trim(), maps_to: mapsTo.trim() }); setWord(''); setMapsTo(''); onChanged(); });
  const [remove] = useAsyncAction(async (entity: string, id: string) => { await api.del(`/semantic/${entity}/${id}`); onChanged(); });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold">Definitions</h3>
          <p className="text-sm text-muted-foreground">Plain-English business rules, used when the AI explains or writes a query.</p>
        </div>
        <Card padding={3} className="flex flex-col gap-2">
          <TextInput label="Term" value={term} onChange={setTerm} placeholder="Active customer" />
          <TextInput label="Means" value={definition} onChange={setDefinition} placeholder="At least one completed order in the period" />
          <Button className="self-start" variant="primary" size="sm" label="Add definition" icon={<Plus className="size-3.5" />} onClick={() => addDef()} isDisabled={b1 || !term.trim() || !definition.trim()} />
        </Card>
        {definitions.length === 0 ? <EmptyState title="No definitions yet" isCompact /> : definitions.map((d) => (
          <Card key={d.id} padding={3} className="flex items-start gap-2">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1"><div className="font-medium">{d.term}</div><p className="text-sm text-muted-foreground">{d.definition}</p></div>
            <button aria-label={`Delete ${d.term}`} onClick={() => remove('definitions', d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold">Synonyms</h3>
          <p className="text-sm text-muted-foreground">So “sales” and “revenue” can mean the same metric or column.</p>
        </div>
        <Card padding={3} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <TextInput label="Someone says" value={word} onChange={setWord} placeholder="sales" />
          <TextInput label="Means" value={mapsTo} onChange={setMapsTo} placeholder="net_revenue" />
          <Button variant="primary" size="sm" label="Add" icon={<Plus className="size-3.5" />} onClick={() => addSyn()} isDisabled={b2 || !word.trim() || !mapsTo.trim()} />
        </Card>
        {synonyms.length === 0 ? <EmptyState title="No synonyms yet" isCompact /> : (
          <div className="flex flex-wrap gap-2">
            {synonyms.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {s.term}<span className="text-muted-foreground">=</span><code className="mono text-primary">{s.maps_to}</code>
                <button aria-label={`Delete ${s.term}`} onClick={() => remove('synonyms', s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
