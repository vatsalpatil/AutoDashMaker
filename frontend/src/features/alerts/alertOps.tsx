import { Badge } from '@/components/ui/kit';

export const OPERATORS: { value: string; label: string }[] = [
  { value: 'lt', label: 'falls below' },
  { value: 'lte', label: 'at or below' },
  { value: 'gt', label: 'rises above' },
  { value: 'gte', label: 'at or above' },
  { value: 'eq', label: 'equals' },
  { value: 'pct_up_gt', label: 'rises by more than %' },
  { value: 'pct_down_gt', label: 'falls by more than %' },
];

export const opLabel = (op: string) => OPERATORS.find((o) => o.value === op)?.label ?? op;

export function StatusBadge({ status }: { status?: string | null }) {
  if (status === 'ok') return <Badge variant="green" label="ok" />;
  if (status === 'triggered' || status === 'error') return <Badge variant="red" label={status} />;
  return <Badge variant="neutral" label="never run" />;
}
