import path from 'node:path';
import os from 'node:os';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root,
  base: '/',
  publicDir: false,
  build: {
    outDir: path.join(os.tmpdir(), 'vt-bgm-probe-dist'),
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(import.meta.dirname, 'bgm.html') },
  },
});
