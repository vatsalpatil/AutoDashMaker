import { api } from '@/lib/api';

export interface CombinedDataset { id: string; name: string; row_count: number; used: string[]; skipped: { name: string; reason: string }[]; auto_links?: string[] }

/** Join several datasets along their saved relationships into one analysis dataset (POST /transforms/blend-many). */
export function combineDatasets(ids: string[]): Promise<CombinedDataset> {
  return api.post<CombinedDataset>('/transforms/blend-many', { dataset_ids: ids });   // named <main table>_combined
}

export const combinedNote = (d: CombinedDataset) =>
  `${d.used.join(' + ')} → ${d.row_count.toLocaleString()} rows` +
  (d.auto_links?.length ? ` · linked by matching keys: ${d.auto_links.join(', ')}` : '') +
  (d.skipped.length ? ` · left out: ${d.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}` : '');
