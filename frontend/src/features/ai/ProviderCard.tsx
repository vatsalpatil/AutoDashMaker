import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui/kit';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { AiProvider, AiProviderStats } from '@/lib/types';
import { ModelList } from './ModelList';

export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

/** One connected provider: active model, Test connection (+ stats), and its available models. */
export function ProviderCard({ p, label, expanded, onToggle, onCollapse, onChanged, onRemove }: {
  p: AiProvider;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const [stats, setStats] = useState<AiProviderStats | 'testing' | { error: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Collapse the model list on a click outside this card, or Escape.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onCollapse();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCollapse();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded, onCollapse]);

  async function test() {
    setStats('testing');
    try {
      setStats(await api.post<AiProviderStats>(`/ai/providers/${p.id}/stats`));
    } catch (e) {
      setStats({ error: (e as Error).message });
    }
  }

  const result = stats && stats !== 'testing' && !('error' in stats) ? stats : null;

  return (
    <div ref={rootRef}>
    <Card padding={4}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left" aria-expanded={expanded}>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground/70" /> : <ChevronRight className="h-4 w-4 text-muted-foreground/70" />}
            <span className="text-base font-semibold">{label}</span>
          </button>
          {p.is_default && <Badge variant="success" label="active" />}
          <span className="mr-auto truncate font-mono text-xs text-muted-foreground">{p.model}</span>
          <Button variant="secondary" size="sm" label={stats === 'testing' ? 'Testing…' : 'Test connection'}
            isDisabled={stats === 'testing'} onClick={test} />
          <button onClick={onRemove} className="p-1 text-muted-foreground/70 hover:text-destructive" aria-label={`Disconnect ${label}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {stats && stats !== 'testing' && 'error' in stats && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">Test failed: {stats.error}</p>
        )}
        {result && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.ok ? 'success' : 'red'} label={result.ok ? 'connected' : 'failed'} />
            <StatChip label="Round trip" value={`${(result.latency_ms / 1000).toFixed(1)} s`} />
            <StatChip label="Models available" value={String(result.model_count)} />
            <StatChip label="Free models" value={String(result.free_count)} />
            <StatChip label="Model list" value={result.models_source === 'live' ? 'live' : 'built-in'} />
            {!result.ok && result.detail && <span className="text-xs text-destructive">{result.detail}</span>}
          </div>
        )}

        {expanded && <ModelList provider={p} onChanged={onChanged} />}
      </div>
    </Card>
    </div>
  );
}

/** Pick a provider that is not connected yet, then enter its key. */
