import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@/index.css';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { applyStoredPrefs } from '@/lib/theme';
import { BackofficeApp } from './BackofficeApp';

applyStoredPrefs();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <BackofficeApp />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
