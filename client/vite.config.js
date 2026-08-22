import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Long-lived browser cache for static game images */
function assetCacheHeaders() {
  return {
    name: 'asset-cache-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/assets/') || /\.(webp|png|jpg|jpeg|gif|svg|woff2?)(\?|$)/i.test(url)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/assets/') || /\.(webp|png|jpg|jpeg|gif|svg|woff2?)(\?|$)/i.test(url)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), assetCacheHeaders()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
