import { useState } from 'react';

const KEY = 'dashtor.entered';
const read = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

/**
 * Visitors arriving at the site root see the landing page first (once per browser tab session);
 * deep links (/dashboards/…) go straight to the app. `/welcome` always shows it.
 */
export function useLanding(): [boolean, () => void] {
  const path = window.location.pathname;
  const [show, setShow] = useState(path === '/welcome' || (path === '/' && !read()));
  const enter = () => {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked: landing simply shows again next visit */ }
    if (window.location.pathname === '/welcome') window.history.replaceState(null, '', '/');
    window.scrollTo(0, 0);
    setShow(false);
  };
  return [show, enter];
}
