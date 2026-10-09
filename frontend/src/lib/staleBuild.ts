/**
 * A tab that was open before a deploy still points at the old hashed files (e.g. SettingsPage-BnXzCoWs.js), which the new
 * build no longer has, so opening a page fails with "Failed to fetch dynamically imported module". Reloading fetches the new
 * index.html and its files. We reload at most once per 30 s, so a genuinely broken server can't cause a reload loop.
 */
const STALE = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;
const KEY = 'dashtor.staleReload';

export const isStaleBuildError = (e: unknown): boolean => STALE.test(String((e as Error | undefined)?.message ?? e));

/** Reloads the page unless it already did so a moment ago. Returns whether a reload was started. */
export function reloadForNewBuild(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked: still reload once; the browser won't loop on its own */ }
  window.location.reload();
  return true;
}
