/** Readable date labels for chart axes (pure, so it is unit-tested). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_MIDNIGHT = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?$/;

/** Date labels people can read: '2023-04-01T00:00:00' -> '2023-04-01', and a series that is all first-of-month -> 'Apr 2023'. */
export function tidyDateLabels<R extends { x?: unknown }>(rows: R[]): R[] {
  const parts = rows.map((r) => (typeof r.x === 'string' ? ISO_MIDNIGHT.exec(r.x) : null));
  if (rows.length === 0 || parts.some((m) => !m)) return rows;
  const monthly = parts.every((m) => m![3] === '01');
  return rows.map((r, i) => ({ ...r, x: monthly ? `${MONTHS[Number(parts[i]![2]) - 1]} ${parts[i]![1]}` : `${parts[i]![1]}-${parts[i]![2]}-${parts[i]![3]}` }));
}
