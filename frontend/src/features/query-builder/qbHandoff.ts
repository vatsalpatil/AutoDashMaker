import { readStorage, writeStorage } from '@/hooks/useLocalStorage';
import { api } from '@/lib/api';
import type { QbSpec } from './qbModel';

/**
 * Workbench <-> Query builder transfer. Builder -> Workbench remembers the steps behind each SQL text, so opening that SQL again
 * restores them exactly; any other SQL is converted by the server (`/qb/from-sql`), which says whether the steps reproduce the
 * query ("exact") or the query was kept whole as a raw-SQL first stage ("wrapped").
 */
export type Fidelity = 'exact' | 'linked' | 'wrapped';
export interface QbIncoming { spec: QbSpec; fidelity: Fidelity; notes: string[] }

const LINKS = 'qb.links';
const MAILBOX = 'qb.incoming';
export const QB_EVENT = 'qb:incoming';
const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();

export function rememberSpec(sql: string, spec: QbSpec): void {
  const links = readStorage<[string, QbSpec][]>(LINKS, []);
  writeStorage(LINKS, [...links.filter(([k]) => k !== norm(sql)), [norm(sql), spec] as [string, QbSpec]].slice(-50));
}

/** Put the query in the builder's mailbox; the caller then navigates to /builder (the mounted builder also listens for the event). */
export async function sendToBuilder(sql: string): Promise<QbIncoming> {
  const hit = readStorage<[string, QbSpec][]>(LINKS, []).find(([k]) => k === norm(sql));
  const incoming: QbIncoming = hit ? { spec: hit[1], fidelity: 'linked', notes: [] } : await api.post<QbIncoming>('/qb/from-sql', { sql });
  writeStorage(MAILBOX, incoming);
  window.dispatchEvent(new Event(QB_EVENT));
  return incoming;
}

export function takeIncoming(): QbIncoming | null {
  const m = readStorage<QbIncoming | null>(MAILBOX, null);
  if (m) try { localStorage.removeItem(MAILBOX); } catch { /* storage unavailable */ }
  return m?.spec ? m : null;
}
