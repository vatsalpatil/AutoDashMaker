export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export function bytes(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

/** "3 min ago" style, or "—" when missing. */
export function ago(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).getTime()) / 1000;
  if (s < 60) return 'just now';
  const [n, unit] = s < 3600 ? [s / 60, 'min'] : s < 86400 ? [s / 3600, 'h'] : [s / 86400, 'd'];
  return `${Math.floor(n)} ${unit} ago`;
}
