import { Badge } from '@/components/ui/kit';

export function scoreVariant(v: unknown): 'success' | 'warning' | 'error' | 'neutral' {
  const n = Number(v);
  if (Number.isNaN(n)) return 'neutral';
  if (n >= 95) return 'success';
  if (n >= 80) return 'warning';
  return 'error';
}

export function QualityBadge({ value }: { value: unknown }) {
  const n = Number(value);
  const label = Number.isNaN(n) ? '—' : `${n}`;
  return <Badge variant={scoreVariant(value)} label={label} />;
}
