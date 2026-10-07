// Browser-tab icon that follows the theme: the Dashtor "D" redrawn in the current primary colour
// (same dark-to-light gradient as the in-app logo) whenever the theme changes.
import { LOGO_CUT_PATH, LOGO_D_PATH } from '@/lib/logo';

type RGB = [number, number, number];

/** Resolve any CSS colour (hex, oklch, color-mix…) to RGB through a canvas. Null when the browser can't parse it. */
function toRgb(css: string): RGB | null {
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.fillStyle = '#000';
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

const mix = (a: RGB, b: RGB, t: number): string => `rgb(${a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)).join(',')})`;

function faviconSvg(primary: RGB): string {
  const dark = mix(primary, [0, 0, 0], 0.38);
  const light = mix(primary, [255, 255, 255], 0.3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs>` +
    `<linearGradient id="g" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/><path d="${LOGO_CUT_PATH}" stroke="black" stroke-width="1.7" stroke-linecap="round"/></mask></defs>` +
    `<path mask="url(#m)" fill="url(#g)" fill-rule="evenodd" d="${LOGO_D_PATH}"/></svg>`;
}

let last = '';

export function syncFavicon(): void {
  try {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const rgb = css ? toRgb(css) : null;
    if (!rgb) return; // keep the static /favicon.svg
    const href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(rgb))}`;
    if (href === last) return;
    last = href;
    document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove()); // swapping the node refreshes the tab icon in every browser
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = href;
    document.head.appendChild(link);
  } catch {
    /* favicon is cosmetic: never break the app over it */
  }
}

/** Call once at startup: draws the icon now and redraws it whenever the theme (colour preset, accent, dark mode) changes. */
export function startFaviconSync(): void {
  syncFavicon();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; syncFavicon(); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-preset'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(syncFavicon));
}
