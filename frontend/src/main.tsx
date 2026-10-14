import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import './index.css';
import './theme-effects.css';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { PublicDashboardPage } from '@/features/dashboards/share/PublicDashboardPage';
import { applyStoredPrefs } from '@/lib/theme';
import { startFaviconSync } from '@/lib/favicon';
import { reloadForNewBuild } from '@/lib/staleBuild';

applyStoredPrefs();
startFaviconSync();
// Vite fires this when a page's files can't be loaded (the site was redeployed): get the new version instead of an error
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadForNewBuild(); });

// /s/<token> is a public share link: no login, no app shell
const shareToken = /^\/s\/([\w-]+)\/?$/.exec(window.location.pathname)?.[1];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {shareToken ? <PublicDashboardPage token={shareToken} /> : (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>,
);
