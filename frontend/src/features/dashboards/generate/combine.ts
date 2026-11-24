import { api } from '@/lib/api';

export interface CombinedDataset { id: string; name: string; row_count: number; used: string[]; skipped: { name: string; reason: string }[] }

/** Join several datasets along their saved relationships into one analysis dataset (POST /transforms/blend-many). */
export function combineDatasets(ids: string[]): Promise<CombinedDataset> {
  return api.post<CombinedDataset>('/transforms/blend-many', { dataset_ids: ids });   // named <main table>_combined
}

export const combinedNote = (d: CombinedDataset) =>
  `${d.used.join(' + ')} → ${d.row_count.toLocaleString()} rows` +
  (d.skipped.length ? ` · left out: ${d.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}` : '');
