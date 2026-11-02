import { useState } from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACCENTS, FAMILIES, applyPrefs, familyOf, isDarkNow, loadPrefs, savePrefs, swatchOf, type ThemePrefs } from '@/lib/theme';

/** Header theme menu on the landing page: light/dark, colour theme and accent. Saved like Settings, so the app opens in the same look. */
export function ThemePicker() {
  const [prefs, setPrefs] = useState<ThemePrefs>(() => loadPrefs());
  const update = (patch: Partial<ThemePrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next); savePrefs(next); applyPrefs(next);
  };
  const dark = isDarkNow(prefs.mode);
  const family = familyOf(prefs.preset)?.id;

  return (
    <Popover>
      <PopoverTrigger render={<button type="button" aria-label="Change theme" title="Theme"
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" />}>
        <Palette className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {([['light', Sun, 'Light'], ['dark', Moon, 'Dark']] as const).map(([mode, Icon, label]) => (
            <button key={mode} onClick={() => update({ mode })}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition ${(mode === 'dark') === dark ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
              <Icon className="size-3.5" />{label}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Colour theme</p>
          <div className="grid grid-cols-4 gap-2">
            {FAMILIES.map((f) => (
              <button key={f.id} onClick={() => update({ preset: f.light })} title={f.name}
                className={`group flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] transition hover:bg-muted ${family === f.id ? 'bg-muted ring-1 ring-primary' : ''}`}>
                <span className="relative flex size-8 overflow-hidden rounded-full border">
                  <span className="flex-1" style={{ background: swatchOf(dark ? f.dark : f.light, 0) }} />
                  <span className="flex-1" style={{ background: swatchOf(dark ? f.dark : f.light, 1) }} />
                </span>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Accent colour</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button key={a.name} onClick={() => update({ accent: a.name })} title={a.name} aria-label={`${a.name} accent`}
                className="flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition hover:scale-110"
                style={{ background: a.hex, boxShadow: prefs.accent === a.name ? `0 0 0 2px ${a.hex}` : undefined }}>
                {prefs.accent === a.name && <Check className="size-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
