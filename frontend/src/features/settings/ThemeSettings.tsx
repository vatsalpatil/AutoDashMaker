import { useEffect, useRef, useState } from 'react';
import { PreviewSelect } from './PreviewSelect';
import { SelectField } from '@/components/common/SelectField';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  ACCENTS,
  FONTS,
  FONT_MAX,
  FONT_MIN,
  FAMILIES,
  PRESETS,
  familyOf,
  applyPrefs,
  loadPrefs,
  savePrefs,
  type FontFamily,
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

  const prefsRef = useRef(prefs);   // latest committed prefs: hover previews restore to this, never to a stale render
  const update = (patch: Partial<ThemePrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    applyPrefs(next);
    savePrefs(next);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs ">
      <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Customize theme, accent color, density, and text size. Changes apply instantly.
      </p>

      {/* Font family */}
      <div className="mt-6 max-w-xs">
        <SelectField label="Font" value={prefs.font} onChange={(e) => update({ font: e.target.value as FontFamily })}>
          {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </SelectField>
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
          min={FONT_MIN}
          max={FONT_MAX}
          step={0.01}
          value={prefs.fontScale}
          onChange={(e) => update({ fontScale: Number(e.target.value) })}
          className="mt-2 w-full accent-foreground "
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground/70">
          <span>{Math.round(FONT_MIN * 100)}%</span>
          <button type="button" onClick={() => update({ fontScale: 1 })} className="hover:text-foreground">Default 100%</button>
          <span>{Math.round(FONT_MAX * 100)}%</span>
        </div>
      </div>

      {/* Mode */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">Theme</label>
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

      <PreviewSelect
        label="Theme"
        value={familyOf(prefs.preset)?.id ?? ''}
        groups={[{ options: FAMILIES.map((f) => ({ value: f.id, label: f.name, swatch: <Dots colors={[swatchOf(f.light, 0), swatchOf(f.light, 1), swatchOf(f.dark, 0)]} /> })) }]}
        onChange={(id) => { const f = FAMILIES.find((x) => x.id === id); if (f) update({ preset: f.light }); }}
        onPreview={(id) => { const f = FAMILIES.find((x) => x.id === id); applyPrefs(f ? { ...prefsRef.current, preset: f.light } : prefsRef.current); }}
      />

      <PreviewSelect
        label="Accent color"
        value={prefs.accent}
        groups={[{ options: ACCENTS.map((a) => ({ value: a.name, label: a.name[0].toUpperCase() + a.name.slice(1), swatch: <Dots colors={[a.hex]} /> })) }]}
        onChange={(name) => update({ accent: name as ThemePrefs['accent'] })}
        onPreview={(name) => applyPrefs(name ? { ...prefsRef.current, accent: name as ThemePrefs['accent'] } : prefsRef.current)}
      />

      {/* Density */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground">Density</label>
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

      <Segmented label="Corner radius" value={prefs.radius} options={['sharp', 'rounded', 'round']} onChange={(radius) => update({ radius })} />
    </section>
  );
}

/** Labelled single-choice pill toggle. */
function Segmented<T extends string>({ label, value, options, labels, onChange }: { label: string; value: T; options: readonly T[]; labels?: Record<string, string>; onChange: (v: T) => void }) {
  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-2 inline-flex max-w-full flex-wrap rounded-lg border border-border bg-muted p-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${value === o ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {labels?.[o] ?? o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Dots({ colors }: { colors: string[] }) {
  return (
    <span className="flex gap-1">
      {colors.map((c, i) => <span key={i} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: c }} />)}
    </span>
  );
}

const swatchOf = (id: string, i: number) => PRESETS.find((p) => p.id === id)?.swatch[i] ?? '#888';
