export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentName = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'pink' | 'teal' | 'slate';
export type Density = 'comfortable' | 'compact';
export type Radius = 'sharp' | 'rounded' | 'round';
export type FontFamily = 'inter' | 'dm-sans' | 'manrope' | 'poppins' | 'nunito' | 'system' | 'lora' | 'merriweather' | 'serif' | 'jetbrains' | 'fira' | 'mono';

export interface ThemePreset {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  /** CSS variables applied to :root */
  vars: {
    bg: string;          // app background
    surface: string;     // sidebar / header / cards
    text: string;        // primary text
    accent: string;      // buttons, links, active states
    accentHover: string;
  };
  /** 3 dots shown in the picker */
  swatch: [string, string, string];
}

export const PRESETS: ThemePreset[] = [
  { id: 'light-aurora', name: 'Aurora', mode: 'light',
    vars: { bg: '#f6f7fb', surface: '#ffffff', text: '#0f1222', accent: '#6366f1', accentHover: '#4f46e5' },
    swatch: ['#f6f7fb', '#6366f1', '#0f1222'] },
  { id: 'light-paper', name: 'Paper', mode: 'light',
    vars: { bg: '#fafafa', surface: '#ffffff', text: '#18181b', accent: '#18181b', accentHover: '#3f3f46' },
    swatch: ['#fafafa', '#18181b', '#18181b'] },
  { id: 'light-ocean', name: 'Ocean', mode: 'light',
    vars: { bg: '#f4f8fb', surface: '#ffffff', text: '#0b1b2b', accent: '#0284c7', accentHover: '#0369a1' },
    swatch: ['#f4f8fb', '#0284c7', '#0b1b2b'] },
  { id: 'light-emerald', name: 'Emerald', mode: 'light',
    vars: { bg: '#f4f9f6', surface: '#ffffff', text: '#0d1f17', accent: '#059669', accentHover: '#047857' },
    swatch: ['#f4f9f6', '#059669', '#0d1f17'] },
  { id: 'light-violet', name: 'Violet', mode: 'light',
    vars: { bg: '#f7f5fd', surface: '#ffffff', text: '#1e1536', accent: '#7c3aed', accentHover: '#6d28d9' },
    swatch: ['#f7f5fd', '#7c3aed', '#1e1536'] },
  { id: 'light-rose', name: 'Rose', mode: 'light',
    vars: { bg: '#fbf6f7', surface: '#ffffff', text: '#1f0f14', accent: '#e11d48', accentHover: '#be123c' },
    swatch: ['#fbf6f7', '#e11d48', '#1f0f14'] },
  { id: 'light-sand', name: 'Sand', mode: 'light',
    vars: { bg: '#faf7f2', surface: '#fffefb', text: '#292524', accent: '#d97706', accentHover: '#b45309' },
    swatch: ['#faf7f2', '#d97706', '#292524'] },
  { id: 'light-midnight', name: 'Midnight', mode: 'light',
    vars: { bg: '#f3f6fc', surface: '#ffffff', text: '#0b1020', accent: '#2563eb', accentHover: '#1d4ed8' },
    swatch: ['#f3f6fc', '#2563eb', '#0b1020'] },
  { id: 'dark-obsidian', name: 'Obsidian', mode: 'dark',
    vars: { bg: '#09090b', surface: '#121216', text: '#f4f4f5', accent: '#818cf8', accentHover: '#a5b4fc' },
    swatch: ['#09090b', '#818cf8', '#f4f4f5'] },
  { id: 'dark-midnight', name: 'Midnight', mode: 'dark',
    vars: { bg: '#0b1020', surface: '#121a30', text: '#e6ebf5', accent: '#60a5fa', accentHover: '#93c5fd' },
    swatch: ['#0b1020', '#60a5fa', '#e6ebf5'] },
  { id: 'dark-graphite', name: 'Graphite', mode: 'dark',
    vars: { bg: '#101113', surface: '#1a1b1e', text: '#ececee', accent: '#f4f4f5', accentHover: '#ffffff' },
    swatch: ['#101113', '#f4f4f5', '#ececee'] },
  { id: 'dark-forest', name: 'Forest', mode: 'dark',
    vars: { bg: '#0a120e', surface: '#111c16', text: '#e5f0e9', accent: '#34d399', accentHover: '#6ee7b7' },
    swatch: ['#0a120e', '#34d399', '#e5f0e9'] },
  { id: 'dark-plum', name: 'Plum', mode: 'dark',
    vars: { bg: '#120b1a', surface: '#1b1226', text: '#efe7f7', accent: '#c084fc', accentHover: '#d8b4fe' },
    swatch: ['#120b1a', '#c084fc', '#efe7f7'] },
  { id: 'dark-sky', name: 'Sky', mode: 'dark',
    vars: { bg: '#07131c', surface: '#0e1e2b', text: '#e3f1fa', accent: '#38bdf8', accentHover: '#7dd3fc' },
    swatch: ['#07131c', '#38bdf8', '#e3f1fa'] },
  { id: 'dark-ember', name: 'Ember', mode: 'dark',
    vars: { bg: '#140d09', surface: '#1e1510', text: '#f5ebe2', accent: '#fb923c', accentHover: '#fdba74' },
    swatch: ['#140d09', '#fb923c', '#f5ebe2'] },
  { id: 'dark-noir', name: 'Rose Noir', mode: 'dark',
    vars: { bg: '#130a0d', surface: '#1d1115', text: '#f7e9ed', accent: '#fb7185', accentHover: '#fda4af' },
    swatch: ['#130a0d', '#fb7185', '#f7e9ed'] },
];

const LEGACY_PRESETS: Record<string, string> = { 'light-slate': 'light-aurora', 'dark-midnight': 'dark-midnight' };

export interface ThemePrefs {
  mode: ThemeMode;
  accent: AccentName;
  density: Density;
  fontScale: number; // FONT_MIN – FONT_MAX, 1 = default
  radius: Radius;
  font: FontFamily;
  preset: string; // any variant of the chosen theme family; the mode picks which variant paints
}

export const ACCENTS: { name: AccentName; hex: string }[] = [
  { name: 'blue', hex: '#6366f1' },
  { name: 'violet', hex: '#8b5cf6' },
  { name: 'emerald', hex: '#10b981' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'rose', hex: '#f43f5e' },
  { name: 'cyan', hex: '#06b6d4' },
  { name: 'orange', hex: '#f97316' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'teal', hex: '#14b8a6' },
  { name: 'slate', hex: '#64748b' },
];

export const FONT_MIN = 0.8;
export const FONT_MAX = 1.2;   // symmetric around the 1.0 default

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "ui-serif, Georgia, Cambria, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Web fonts are loaded from Google Fonts in index.html; keep the two lists in sync. */
export const FONTS: { id: FontFamily; label: string; stack: string }[] = [
  { id: 'inter', label: 'Inter', stack: `'Inter', ${SANS}` },
  { id: 'dm-sans', label: 'DM Sans', stack: `'DM Sans', ${SANS}` },
  { id: 'manrope', label: 'Manrope', stack: `'Manrope', ${SANS}` },
  { id: 'poppins', label: 'Poppins', stack: `'Poppins', ${SANS}` },
  { id: 'nunito', label: 'Nunito', stack: `'Nunito', ${SANS}` },
  { id: 'system', label: 'System', stack: SANS },
  { id: 'lora', label: 'Lora', stack: `'Lora', ${SERIF}` },
  { id: 'merriweather', label: 'Merriweather', stack: `'Merriweather', ${SERIF}` },
  { id: 'serif', label: 'Serif', stack: SERIF },
  { id: 'jetbrains', label: 'JetBrains Mono', stack: `'JetBrains Mono', ${MONO}` },
  { id: 'fira', label: 'Fira Code', stack: `'Fira Code', ${MONO}` },
  { id: 'mono', label: 'Mono', stack: MONO },
];

const STORAGE_KEY = 'autodash-theme';

export const DEFAULT_PREFS: ThemePrefs = {
  mode: 'system',
  accent: 'blue',
  density: 'comfortable',
  fontScale: 1,
  radius: 'rounded',
  font: 'inter',
  preset: 'light-aurora',
};

/** Saved prefs may name a preset that no longer exists (older palettes): fall back to the default. */
function resolvePreset(id?: string): string {
  if (!id) return DEFAULT_PREFS.preset;
  const next = LEGACY_PRESETS[id] ?? id;
  return PRESETS.some((x) => x.id === next) ? next : DEFAULT_PREFS.preset;
}

export function loadPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ThemePrefs>;
    const preset = resolvePreset(parsed.preset);
    return {
      mode: parsed.mode ?? DEFAULT_PREFS.mode,
      accent: parsed.accent ?? DEFAULT_PREFS.accent,
      density: parsed.density ?? DEFAULT_PREFS.density,
      fontScale:
        typeof parsed.fontScale === 'number'
          ? Math.min(FONT_MAX, Math.max(FONT_MIN, parsed.fontScale))
          : DEFAULT_PREFS.fontScale,
      radius: parsed.radius ?? DEFAULT_PREFS.radius,
      font: parsed.font ?? DEFAULT_PREFS.font,
      preset,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: ThemePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // storage unavailable (private mode, quota) — ignore
  }
}

let systemListenerAttached = false;

function setDarkClass(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
}

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** A theme family: the same colour identity in a light and a dark variant, so switching mode keeps the theme. */
export const FAMILIES: { id: string; name: string; light: string; dark: string }[] = [
  { id: 'aurora', name: 'Aurora', light: 'light-aurora', dark: 'dark-obsidian' },
  { id: 'paper', name: 'Paper', light: 'light-paper', dark: 'dark-graphite' },
  { id: 'ocean', name: 'Ocean', light: 'light-ocean', dark: 'dark-sky' },
  { id: 'emerald', name: 'Emerald', light: 'light-emerald', dark: 'dark-forest' },
  { id: 'violet', name: 'Violet', light: 'light-violet', dark: 'dark-plum' },
  { id: 'rose', name: 'Rose', light: 'light-rose', dark: 'dark-noir' },
  { id: 'sand', name: 'Sand', light: 'light-sand', dark: 'dark-ember' },
  { id: 'midnight', name: 'Midnight', light: 'light-midnight', dark: 'dark-midnight' },
];

export const familyOf = (presetId: string) => FAMILIES.find((f) => f.light === presetId || f.dark === presetId);
export const isDarkNow = (mode: ThemeMode) => (mode === 'system' ? prefersDark() : mode === 'dark');

/** The preset to paint: the chosen family's light or dark variant, following the mode (light / dark / system→OS). */
export function resolvePresetFor(p: ThemePrefs): ThemePreset | undefined {
  const fam = familyOf(p.preset);
  const id = fam ? (isDarkNow(p.mode) ? fam.dark : fam.light) : p.preset;
  return PRESETS.find((x) => x.id === id);
}

/** Black or white text, whichever reads better on this background colour. */
function onColor(hex: string): string {
  const m = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0f172a' : '#ffffff';
}

function setAccent(hex: string, hover?: string): void {
  const root = document.documentElement;
  root.style.setProperty('--adm-accent', hex);
  root.style.setProperty('--adm-accent-hover', hover ?? `color-mix(in oklab, ${hex} 85%, black)`);
  root.style.setProperty('--adm-on-accent', onColor(hex));
}

/** The accent swatch overrides the preset's accent unless it is the default (blue). */
function applyAccent(accent: AccentName): void {
  if (accent === 'blue') return; // keep the preset's own accent
  setAccent(ACCENTS.find((a) => a.name === accent)?.hex ?? ACCENTS[0].hex);
}

function applyFontScale(fontScale: number): void {
  const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, fontScale));
  document.documentElement.style.fontSize = `${16 * clamped}px`;
}

function applyPresetVars(presetId: string): void {
  const preset = PRESETS.find((x) => x.id === presetId);
  const root = document.documentElement;
  if (!preset) {
    // clear any preset vars
    for (const k of ['--adm-bg', '--adm-surface', '--adm-text', '--adm-accent', '--adm-accent-hover', '--adm-on-accent']) {
      root.style.removeProperty(k);
    }
    return;
  }
  root.style.setProperty('--adm-bg', preset.vars.bg);
  root.style.setProperty('--adm-surface', preset.vars.surface);
  root.style.setProperty('--adm-text', preset.vars.text);
  setAccent(preset.vars.accent, preset.vars.accentHover);
  root.dataset.preset = preset.id;
}

export function applyPrefs(p: ThemePrefs): void {
  const preset = resolvePresetFor(p);
  setDarkClass(preset ? preset.mode === 'dark' : p.mode === 'dark' || (p.mode === 'system' && prefersDark()));
  applyPresetVars(preset?.id ?? p.preset);
  applyAccent(p.accent);
  document.documentElement.dataset.density = p.density;
  document.documentElement.dataset.radius = p.radius;
  document.documentElement.dataset.font = p.font;
  document.documentElement.style.setProperty('--app-font', (FONTS.find((f) => f.id === p.font) ?? FONTS[0]).stack);
  applyFontScale(p.fontScale);
  if (!systemListenerAttached) {
    // follow the OS while the mode is "system"
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (loadPrefs().mode === 'system') applyPrefs(loadPrefs());
    });
    systemListenerAttached = true;
  }
}

export function applyStoredPrefs(): void {
  applyPrefs(loadPrefs());
}


/** Flip between light and dark (an explicit choice, leaving "system" mode). Persists and applies immediately. */
export function toggleDarkMode(): ThemePrefs {
  const prefs = loadPrefs();
  const next: ThemePrefs = { ...prefs, mode: document.documentElement.classList.contains('dark') ? 'light' : 'dark' };
  savePrefs(next);
  applyPrefs(next);
  return next;
}
