type Row = Record<string, unknown>;

const cellText = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const csvField = (v: unknown) => {
  const s = cellText(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(columns: string[], rows: Row[]): string {
  return [columns.map(csvField).join(','), ...rows.map((r) => columns.map((c) => csvField(r[c])).join(','))].join('\r\n');
}

/** Save `rows` (restricted to `columns`, in that order) as a CSV or JSON file in the browser. */
export function downloadRows(format: 'csv' | 'json', columns: string[], rows: Row[], name = 'results') {
  const body = format === 'csv'
    ? toCsv(columns, rows)
    : JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))), null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: format === 'csv' ? 'text/csv' : 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.${format}` });
  a.click();
  URL.revokeObjectURL(url);
}
