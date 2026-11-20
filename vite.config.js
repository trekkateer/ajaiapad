import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app lives in client/ and builds to dist/, which the Node server serves.
// In development, Vite serves the UI on :5173 and proxies /api to the Node server on :3000.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
