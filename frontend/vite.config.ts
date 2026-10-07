import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend started with `python backend/main.py` listens on 8000.
// Override when using uvicorn on another port: API_TARGET=http://127.0.0.1:8001 npm run dev
// `npm run dev:online` (mode "online", see .env.online) points this local screen at the live server instead,
// so you sign in and see your online account's data.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = process.env.API_TARGET ?? env.API_TARGET ?? 'http://127.0.0.1:8000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5174,
      // changeOrigin: remote hosts (Cloudflare/Traefik) route by Host header
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
  };
});
