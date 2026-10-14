import { useParams, useSearchParams } from 'react-router-dom';
import { ChartStudio } from '@/features/charts/ChartStudio';
import type { ChartType } from '@/lib/types';

/** `/charts/new` starts a blank chart (`?type=` preselects the kind, `?dashboard=&page=` adds it there on save); `/charts/:id` edits one. */
export default function ChartDetailPage() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const target = q.get('dashboard') ? { dashboard: q.get('dashboard')!, page: q.get('page') ?? 'main' } : undefined;
  return <ChartStudio key={id ?? 'new'} id={id && id !== 'new' ? id : undefined} startType={(q.get('type') as ChartType) || undefined} target={target} />;
}
