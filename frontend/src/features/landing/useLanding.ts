import { createElement, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { DocsPage } from '@/features/docs/DocsPage';
import { LandingPage } from './LandingPage';

const KEY = 'dashtor.entered';
const entered = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const markEntered = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked: landing simply shows again */ } };

/**
 * URL rules for the public pages of the main app (the backoffice does not use them):
 *   /welcome            landing page, always
 *   /docs               public documentation, always
 *   signed out, /       landing page          → "Get started" goes to /login
 *   signed out, /login  sign-in page          → after sign-in, back to ?next= or /
 *   signed out, other   → /login?next=<that page>
 *   signed in,  /login  → ?next= or /
 *   local mode (no login): landing at / once per tab session, then the app.
 * Returns the page to show, or null to show the app.
 */
export function usePublicPage({ active, enabled, signedIn, notice }: { active: boolean; enabled: boolean; signedIn: boolean; notice: string | null }): ReactNode {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  if (!active) return null;
  const next = new URLSearchParams(search).get('next');
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/';
  const go = (to: string) => () => { markEntered(); window.scrollTo(0, 0); navigate(to); };

  const enter = go(enabled && !signedIn ? '/login' : '/');
  if (pathname === '/docs') return createElement(DocsPage, { onEnter: enter, onHome: () => { window.scrollTo(0, 0); navigate(signedIn || !enabled ? '/welcome' : '/'); } });
  if (pathname === '/welcome') return createElement(LandingPage, { onEnter: go(enabled && !signedIn ? '/login' : '/') });

  if (enabled && !signedIn) {
    if (notice || pathname === '/login') return createElement(LoginPage, { notice, onBack: () => navigate('/') });
    if (pathname === '/') return createElement(LandingPage, { onEnter: go('/login') });
    return createElement(Navigate, { to: `/login?next=${encodeURIComponent(pathname + search)}`, replace: true });
  }

  if (pathname === '/login') return createElement(Navigate, { to: safeNext, replace: true });
  if (!enabled && pathname === '/' && !entered()) return createElement(LandingPage, { onEnter: go('/') });
  return null;
}
