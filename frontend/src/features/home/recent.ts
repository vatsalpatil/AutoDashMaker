/** Pure helpers for Home (no React / aliases, so `npm test` can import them). */

export interface RecentItem { kind: 'dashboard' | 'chart'; id: string; name: string; to: string; when?: string; note?: string }

interface Named { id: string; name: string; created_at?: string; description?: string }

const time = (iso?: string) => {
  if (!iso) return 0;
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Dashboards and charts in one list, newest first. */
export function recentWork(dashboards: Named[], charts: Named[], limit = 8): RecentItem[] {
  const items: RecentItem[] = [
    ...dashboards.map((d): RecentItem => ({ kind: 'dashboard', id: d.id, name: d.name, to: `/dashboards/${d.id}`, when: d.created_at, note: d.description })),
    ...charts.map((c): RecentItem => ({ kind: 'chart', id: c.id, name: c.name, to: `/charts/${c.id}`, when: c.created_at })),
  ];
  return items.sort((a, b) => time(b.when) - time(a.when)).slice(0, limit);
}

/** "Tuesday, 7 October" in the viewer's locale. */
export const todayLabel = (d = new Date()): string => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const greeting = (d = new Date()): string => {
  const h = d.getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
