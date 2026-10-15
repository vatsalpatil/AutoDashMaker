import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartView } from '@/features/charts/render/ChartView';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ENABLE, HOVER_ONLY, buildCases, dataFor, encodingFor, type Case } from './benchCases';
import { DEFAULTS } from '@/features/charts/optionSchema';

interface Result { id: string; type: string; label: string; status: 'ok' | 'crash' | 'console' | 'blank'; detail?: string; key?: string; value?: unknown; sig?: string; base?: string }

/** The rendered output without generated ids, so two renders of the same chart compare equal. */
const signature = (el: HTMLElement | null) => (el?.innerHTML ?? '').replace(/(id|clip-path|mask|fill|filter)="(url\(#)?[^"]*recharts[^"]*"/g, '').replace(/recharts\d+-\w+/g, '').replace(/_r_\w+_/g, '');

class Catch extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { this.props.onError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Options that cannot change THIS bench's picture, by design (checked by hand, 2026-10-15):
 *  radar formats show only in the hover tooltip; the others need data the bench does not have (a value inside the gauge
 *  ranges, a value below the goal, positive-only data, more than 20 rows, sources within the tolerance). */
const EXPECTED_NO_EFFECT = new Set(['radar:numberFormat', 'radar:decimals', 'radar:currency', 'radar:prefix', 'radar:suffix',
  'gauge:showRangeLabel', 'progress:progressColor', 'boxplot:whisker' /* no outliers: both whisker rules reach the same points */, 'line:unpinZero', 'timebreak:tbPageSize', 'reconcile:tolerance']);

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
      setResults((r) => [...r, { id: c.id, type: c.type, label: c.label, status: status === 'blank' && EXPECTED_EMPTY.test(text) ? 'ok' : status, detail, key: c.key, value: c.value, base: c.base, sig: signature(el) }]);
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
  // effect check: an option value that renders exactly like the defaults did nothing (unless it IS the default)
  const base = new Map(results.filter((r) => /:(default|enabled\d)$/.test(r.id)).map((r) => [`${r.type}:${r.id.split(':')[1]}`, r.sig]));
  const DEF = DEFAULTS as Record<string, unknown>;
  const changed = new Map<string, boolean>();   // type:key -> did ANY value of this option change the output?
  for (const r of results) {
    if (!r.key || HOVER_ONLY.has(r.key) || EXPECTED_NO_EFFECT.has(`${r.type}:${r.key}`)) continue;
    const k = `${r.type}:${r.key}`;
    const isDefault = r.value === DEF[r.key] || r.value === '' || (DEF[r.key] === undefined && (r.value === false || r.value === 0));
    const ref = base.get(`${r.type}:${r.base ?? 'default'}`);
    const sameAsEnabled = r.base?.startsWith('enabled') && r.value === ENABLE[r.key];
    if (!isDefault && !sameAsEnabled) changed.set(k, (changed.get(k) ?? false) || r.sig !== ref);
  }
  const noEffect = [...changed].filter(([, c]) => !c).map(([k]) => k);
  return { total: results.length, problems: results.filter((r) => r.status !== 'ok'), byType, noEffect };
}

export type { Case };
