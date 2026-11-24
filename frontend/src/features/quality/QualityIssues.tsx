export interface QualityIssue { column: string; problem: string; rows: number; example: string }

/** Problems the validity rules found (mixed date formats, numbers as text, negative stock, -999 placeholders, case variants). */
export function QualityIssues({ issues }: { issues: QualityIssue[] }) {
  if (!issues.length) return <p className="mt-3 text-sm text-success">No validity problems found.</p>;
  return (
    <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5">
      <div className="border-b border-warning/30 px-3 py-1.5 text-xs font-medium uppercase text-warning">
        {issues.length} problem{issues.length === 1 ? '' : 's'} to fix
      </div>
      <ul className="divide-y">
        {issues.map((i) => (
          <li key={i.column + i.problem} className="px-3 py-2 text-sm">
            <span className="mono font-medium">{i.column}</span>: {i.problem}
            <div className="text-xs text-muted-foreground">
              {i.rows.toLocaleString()} row{i.rows === 1 ? '' : 's'} · e.g. <span className="mono">{i.example}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
