// Banc navigateur et frontal de la coquille Tauri. Port : --port, sinon FO_PORT, sinon 5300 (devUrl de Tauri).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
const port = Number(process.env.FO_PORT ?? 5300);

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  define: { __FO_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: { host: '127.0.0.1', port, strictPort: true },
  preview: { host: '127.0.0.1', port },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
