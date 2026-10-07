import { useParams } from 'react-router-dom';
import { ChartStudio } from '@/features/charts/ChartStudio';

/** `/charts/new` starts a blank chart; `/charts/:id` edits a saved one. Both are the chart studio. */
export default function ChartDetailPage() {
  const { id } = useParams();
  return <ChartStudio key={id ?? 'new'} id={id && id !== 'new' ? id : undefined} />;
}
