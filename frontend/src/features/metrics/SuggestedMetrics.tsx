import { Plus, Sparkles } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui/kit';
import type { MetricSuggestion } from '@/lib/types';

/** Starter metrics read off the dataset columns. "Add" saves one as-is; "Edit" opens it in the builder first. */
export function SuggestedMetrics({ items, onAdd, onEdit, busy }: {
  items: MetricSuggestion[]; onAdd: (s: MetricSuggestion) => void; onEdit: (s: MetricSuggestion) => void; busy: boolean;
}) {
  if (items.length === 0) return null;
  const seen: Record<string, number> = {};
  const shown = items.filter((s) => (seen[s.dataset_id] = (seen[s.dataset_id] ?? 0) + 1) <= 3).slice(0, 12); // a few per dataset, not 9 from the first one
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Suggested for your data <Badge label={String(items.length)} /></h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <Card key={`${s.dataset_id}-${s.name}`} padding={3} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium" title={s.label}>{s.label}</span>
              <Badge label={s.dataset_name} />
            </div>
            <code className="mono truncate text-[11px] text-muted-foreground">{s.expression}</code>
            <div className="mt-1 flex gap-1.5">
              <Button size="sm" variant="primary" label="Add" icon={<Plus className="size-3.5" />} onClick={() => onAdd(s)} isDisabled={busy} />
              <Button size="sm" label="Edit first" onClick={() => onEdit(s)} />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
