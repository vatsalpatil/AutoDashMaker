import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config';

// Backoffice (admin panel): a separate entry + build so no admin code ships in the public app bundle.
// dev: npm run dev:backoffice (port 5175) · build: npm run build:backoffice -> dist-backoffice/
const spaEntry: Plugin = {
  name: 'backoffice-spa',  // dev server: every page URL serves backoffice.html (not the main app's index.html)
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && !req.url.startsWith('/api') && req.headers.accept?.includes('text/html')) req.url = '/backoffice.html';
      next();
    });
  },
};

export default defineConfig((env) => mergeConfig(base(env), {
  plugins: [spaEntry],
  build: { outDir: 'dist-backoffice', rollupOptions: { input: 'backoffice.html' } },
  server: { port: 5175 },
}));
