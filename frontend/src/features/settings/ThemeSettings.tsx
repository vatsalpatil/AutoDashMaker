import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  ACCENTS,
  PRESETS,
  applyPrefs,
  loadPrefs,
  resolvePresetFor,
  savePrefs,
  type ThemeMode,
  type ThemePrefs,
} from '@/lib/theme';

const MODES: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export default function ThemeSettings() {
  const [prefs, setPrefs] = useState<ThemePrefs>(() => loadPrefs());

  useEffect(() => {
    applyPrefs(prefs);
  }, []);

  const update = (patch: Partial<ThemePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      applyPrefs(next);
      savePrefs(next);
      return next;
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs ">
      <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Customize theme, accent color, density, and text size. Changes apply instantly.
      </p>

      {/* Mode */}
      <div className="mt-6">
        <label className="text-sm font-medium text-foreground">Theme</label>
        <div className="mt-2 inline-flex rounded-lg border border-border bg-muted p-1 ">
          {MODES.map(({ value, label, Icon }) => {
            const active = prefs.mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => update({ mode: value })}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-card text-foreground shadow-xs '
                    : 'text-muted-foreground hover:text-foreground '
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preset gallery: 10 light + 10 dark */}
      {(['light', 'dark'] as const).map((mode) => (
        <div key={mode} className="mt-6">
          <label className="text-sm font-medium capitalize text-foreground">
            {mode} themes
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {PRESETS.filter((p) => p.mode === mode).map((p) => {
              const active = (resolvePresetFor(prefs)?.id ?? prefs.preset) === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => update({ preset: p.id, mode: p.mode })}
                  title={p.name}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                    active
                      ? 'border-blue-500 ring-2 ring-blue-500/40 dark:border-blue-400'
                      : 'border-border hover:border-ring '
                  }`}
                  style={{ backgroundColor: p.vars.bg }}
                >
                  <span className="flex gap-1">
                    {p.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span
                    className="max-w-full truncate text-[11px] font-medium"
                    style={{ color: p.vars.text }}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Accent */}
      <div className="mt-6">
        <label className="text-sm font-medium text-foreground">Accent color</label>
        <div className="mt-2 flex flex-wrap gap-3">
          {ACCENTS.map(({ name, hex }) => {
            const active = prefs.accent === name;
            return (
              <button
                key={name}
                type="button"
                aria-label={`Accent ${name}`}
                onClick={() => update({ accent: name })}
                className={`h-8 w-8 rounded-full transition-shadow ${
                  active
                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-white dark:ring-offset-slate-800'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Density */}
      <div className="mt-6">
        <label className="text-sm font-medium text-foreground">Density</label>
        <div className="mt-2 inline-flex rounded-lg border border-border bg-muted p-1 ">
          {(['comfortable', 'compact'] as const).map((d) => {
            const active = prefs.density === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => update({ density: d })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  active
                    ? 'bg-card text-foreground shadow-xs '
                    : 'text-muted-foreground hover:text-foreground '
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Font scale */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label
            htmlFor="theme-font-scale"
            className="text-sm font-medium text-foreground"
          >
            Font size
          </label>
          <span className="text-sm tabular-nums text-muted-foreground">
            {Math.round(prefs.fontScale * 100)}%
          </span>
        </div>
        <input
          id="theme-font-scale"
          type="range"
          min={0.9}
          max={1.15}
          step={0.05}
          value={prefs.fontScale}
          onChange={(e) => update({ fontScale: Number(e.target.value) })}
          className="mt-2 w-full accent-foreground "
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground/70">
          <span>90%</span>
          <span>115%</span>
        </div>
      </div>

      {/* Radius */}
      <div className="mt-6">
        <label className="text-sm font-medium text-foreground">Corner radius</label>
        <div className="mt-2 inline-flex rounded-lg border border-border bg-muted p-1 ">
          {(['rounded', 'sharp'] as const).map((r) => {
            const active = prefs.radius === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => update({ radius: r })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  active
                    ? 'bg-card text-foreground shadow-xs '
                    : 'text-muted-foreground hover:text-foreground '
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
