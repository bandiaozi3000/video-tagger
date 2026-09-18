import path from 'node:path';
import os from 'node:os';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname, '..');

/** 探针构建：产物落系统临时目录，不碰生产 `dist-player/`。 */
export default defineConfig({
  root,
  base: '/',
  publicDir: false,
  build: {
    outDir: path.join(os.tmpdir(), 'vt-probe-dist'),
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(import.meta.dirname, 'player.html') },
  },
});
