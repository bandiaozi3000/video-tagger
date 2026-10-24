/**
 * 统计视频**页内预览**构建：`preview/trend-main.tsx` → `dist-trend/trend-preview.js`（ESM）。
 *
 * 与 `vite.editor.config.ts` 同一套做法（单页挂载）：宿主 `index.html` 用
 * `<script type="module" src="/stats-trend-preview/trend-preview.js">` 加载，
 * 统计页通过 `window.VTTrendPreview.mount(root, inputProps)` 把它挂进预览弹层。
 *
 * 构建：cd backend/remotion && npm run build:trend-preview
 * （未构建时统计页会给出这条命令，而不是白屏 —— 与推荐工作台的 `mountRecommendEditor` 同套路）
 */
import path from 'node:path';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  base: '/stats-trend-preview/',
  publicDir: false,
  // lib 模式不会自动替 React/Remotion 里的 `process.env.NODE_ENV` 字面量 → 浏览器里会 `process is not defined`
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: 'dist-trend',
    emptyOutDir: true,
    lib: {
      entry: path.join(root, 'preview', 'trend-main.tsx'),
      formats: ['es'],
      fileName: () => 'trend-preview.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'trend-preview.[ext]' },
    },
  },
});
