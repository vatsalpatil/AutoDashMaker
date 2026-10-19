import { Link } from 'react-router-dom';
import { Check, Database, Hammer, Keyboard, LayoutGrid, Loader2, Wand2 } from 'lucide-react';
import { Ring } from '@/features/ai/usage/ProviderUsageCard';
import { cn } from '@/lib/utils';
import { STEP_TITLES } from '../GenerationTimeline';
import { formatDuration, stepMs, totalMs, useTicker } from './timing';
import type { useGenerateSession } from './useGenerateSession';

type Session = ReturnType<typeof useGenerateSession>;

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b px-4 py-3 last:border-0">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h3>
      {children}
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{k}</span><span className="truncate text-right font-medium">{v}</span></div>
);

/** Right-hand overview of the AI session: every step with its time, the data, the plan's shape, build results and the final score. */
export function SessionPanel({ s, datasetName }: { s: Session; datasetName?: string }) {
  const now = useTicker(s.busy);
  const byN = new Map(s.steps.map((x) => [x.n, x]));
  const ok = s.widgets.filter((w) => w.status === 'ok');
  const fixed = ok.filter((w) => w.fixed || w.notes?.length).length;
  const perPage = s.plan ? s.plan.pages.map((p) => ({ name: p.name, n: s.plan!.widgets.filter((w) => w.page === p.id).length })) : [];

  return (
    <aside className="h-full w-full overflow-y-auto bg-card/40 backdrop-blur" aria-label="Session overview">
      <Section icon={<Loader2 className={cn('size-3.5', s.busy && 'animate-spin text-primary')} />} title="Progress">
        <ol className="flex flex-col gap-1">
          {STEP_TITLES.map((t, i) => {
            const st = byN.get(i + 1);
            const running = !!st && !st.done && s.busy;
            return (
              <li key={t} className={cn('flex items-center gap-2 text-xs', !st && 'opacity-45')}>
                <span className={cn('grid size-4 place-items-center rounded-full border text-[9px]', st?.done ? 'border-success/40 bg-success/15 text-success' : running ? 'border-primary text-primary' : '')}>
                  {st?.done ? <Check className="size-2.5" /> : running ? <Loader2 className="size-2.5 animate-spin" /> : i + 1}
                </span>
                <span className={cn('flex-1 truncate', running && 'font-medium text-primary')}>{t}</span>
                {st && <span className="tabular-nums text-muted-foreground">{formatDuration(stepMs(st, now))}</span>}
              </li>
            );
          })}
        </ol>
        {s.steps.length > 0 && <Row k="AI working time" v={formatDuration(totalMs(s.steps, now))} />}
      </Section>

      <Section icon={<Database className="size-3.5" />} title="Data">
        {s.setup ? <>
          <Row k="Dataset" v={datasetName ?? '…'} />
          <Row k="Style" v={s.setup.template === 'auto' ? 'Best fit' : s.setup.template} />
          {s.setup.focus && <p className="text-xs text-muted-foreground">“{s.setup.focus}”</p>}
          {!!s.setup.images?.length && <Row k="Images" v={`${s.setup.images.length} attached`} />}
          {s.evidence && <Row k="Rows · columns" v={`${s.evidence.rows.toLocaleString()} · ${s.evidence.describe.length}`} />}
          {s.understanding && <Row k="Questions" v={`${Object.keys(s.answers).filter((k) => k !== 'notes').length} / ${s.understanding.questions.length} answered`} />}
        </> : <p className="text-xs text-muted-foreground">Pick a dataset to start.</p>}
      </Section>

      <Section icon={<LayoutGrid className="size-3.5" />} title="Plan">
        {s.plan ? <>
          <p className="text-sm font-medium">{s.plan.name}</p>
          {perPage.map((p) => (
            <div key={p.name} className="text-xs">
              <div className="flex justify-between"><span>{p.name}</span><span className="tabular-nums text-muted-foreground">{p.n}</span></div>
              <div className="mt-0.5 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(100 * p.n) / Math.max(1, ...perPage.map((x) => x.n))}%` }} /></div>
            </div>
          ))}
        </> : <p className="text-xs text-muted-foreground">Appears after the AI understands your data.</p>}
      </Section>

      <Section icon={<Hammer className="size-3.5" />} title="Build">
        {s.widgets.length ? <>
          <Row k="Built" v={<span className="text-success">{ok.length}</span>} />
          <Row k="Skipped" v={s.widgets.length - ok.length} />
          <Row k="Auto-corrected" v={<span className="inline-flex items-center gap-1 text-primary"><Wand2 className="size-3" />{fixed}</span>} />
        </> : <p className="text-xs text-muted-foreground">Each widget is checked as it is built.</p>}
      </Section>

      {s.result && (
        <Section icon={<Check className="size-3.5" />} title="Result">
          <div className="flex items-center gap-3">
            {s.result.score !== undefined && <Ring pct={s.result.score} label={String(s.result.score)} sub="quality" size={72} />}
            <div className="min-w-0 text-xs">
              <p className="truncate text-sm font-medium">{s.result.name}</p>
              <p className="text-muted-foreground">{s.result.widgets.length} widgets · {s.result.pages.length} pages</p>
            </div>
          </div>
          <Link to={`/dashboards/${s.result.dashboard_id}`} className="rounded-lg bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground">Open dashboard</Link>
        </Section>
      )}

      <Section icon={<Keyboard className="size-3.5" />} title="Tips">
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          <li><b className="text-foreground">Enter</b> sends · <b className="text-foreground">Shift+Enter</b> new line</li>
          <li><b className="text-foreground">Ctrl+V</b> pastes a screenshot to copy a look</li>
          <li>Every question takes several answers</li>
          <li>Scroll up to read; <b className="text-foreground">Latest</b> jumps back</li>
        </ul>
      </Section>
    </aside>
  );
}
