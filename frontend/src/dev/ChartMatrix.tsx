import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartView } from '@/features/charts/render/ChartView';
import { TooltipProvider } from '@/components/ui/tooltip';
import { buildCases, dataFor, encodingFor, type Case } from './benchCases';

interface Result { id: string; type: string; label: string; status: 'ok' | 'crash' | 'console' | 'blank'; detail?: string }

class Catch extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { this.props.onError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Empty states that are expected answers, not failures (e.g. "No data to plot." for the no-rows case). */
const EXPECTED_EMPTY = /no data|no rows|no flows|pick 2 or 3|choose a date|every key matches|no rows to show|nothing/i;

/**
 * Dev-only test bench (/dev/charts): renders every case one after another, records crashes, console errors and blank
 * output, and exposes the results as window.__matrix for automated checks. Never part of the production build's routes.
 */
export default function ChartMatrix() {
  const cases = useMemo(() => buildCases(25), []);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const err = useRef<string | null>(null);
  const consoleErr = useRef<string[]>([]);

  useEffect(() => {   // capture console.error during the whole run (React warnings, Recharts errors...)
    const orig = console.error;
    console.error = (...a: unknown[]) => { consoleErr.current.push(a.map(String).join(' ').slice(0, 300)); orig(...a); };
    return () => { console.error = orig; };
  }, []);

  useEffect(() => {
    if (i >= cases.length) { (window as unknown as { __matrix: unknown }).__matrix = summary(results); return; }
    const t = setTimeout(() => {
      const c = cases[i];
      const el = box.current;
      const text = el?.innerText.trim() ?? '';
      const drawn = !!el?.querySelector('svg, table, [role=progressbar]') || text.length > 0;
      const status: Result['status'] = err.current ? 'crash' : consoleErr.current.length ? 'console' : !drawn ? 'blank' : 'ok';
      const detail = err.current ?? consoleErr.current[0] ?? (status === 'blank' ? 'rendered nothing' : undefined);
      setResults((r) => [...r, { id: c.id, type: c.type, label: c.label, status: status === 'blank' && EXPECTED_EMPTY.test(text) ? 'ok' : status, detail }]);
      err.current = null; consoleErr.current = [];
      setI((n) => n + 1);
    }, 40);
    return () => clearTimeout(t);
  }, [i, cases, results]);

  const c = cases[Math.min(i, cases.length - 1)];
  const failures = results.filter((r) => r.status !== 'ok');
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 text-sm text-foreground">
        <h1 className="text-lg font-semibold">Chart test bench</h1>
        <p className="text-muted-foreground">{Math.min(i, cases.length)} / {cases.length} cases · {failures.length} problems</p>
        {i < cases.length && (
          <div className="my-3 rounded border p-2">
            <p className="mb-1 text-xs text-muted-foreground">{c.type} · {c.label}</p>
            <div ref={box} style={{ width: 640, height: 380 }}>
              <Catch key={c.id} onError={(e) => { err.current = e.message; }}>
                <ChartView spec={{ type: c.type, encoding: encodingFor(c.type), options: c.options }} result={dataFor(c.data)} height={360} />
              </Catch>
            </div>
          </div>
        )}
        <ul className="mt-3 space-y-1">
          {failures.map((f) => <li key={f.id} className="font-mono text-xs"><b className="text-destructive">{f.status}</b> {f.id} — {f.detail}</li>)}
        </ul>
      </div>
    </TooltipProvider>
  );
}

function summary(results: Result[]) {
  const byType: Record<string, { cases: number; problems: number }> = {};
  for (const r of results) { const t = (byType[r.type] ??= { cases: 0, problems: 0 }); t.cases += 1; if (r.status !== 'ok') t.problems += 1; }
  return { total: results.length, problems: results.filter((r) => r.status !== 'ok'), byType };
}

export type { Case };
