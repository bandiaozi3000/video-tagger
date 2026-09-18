/**
 * 推荐工作台编辑器构建：`editor/main.tsx` → `dist-editor/editor.js`（ESM）+ `editor.css`。
 *
 * 方式 A（单页挂载）：宿主 `index.html` 用 `<script type="module" src="/recommend-editor/editor.js">`
 * 加载，React 应用挂进 `#recommend-editor-root`；`app.js` 通过 `window.VTRecommendEditor.mount/unmount` 控制。
 *
 * 构建：cd backend/remotion && npm run build:editor
 */
import path from 'node:path';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  base: '/recommend-editor/',
  publicDir: false,
  // lib 模式不会自动替 React/Remotion 里的 `process.env.NODE_ENV` 字面量 → 浏览器里会 `process is not defined`
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: 'dist-editor',
    emptyOutDir: true,
    lib: {
      entry: path.join(root, 'editor', 'main.tsx'),
      formats: ['es'],
      fileName: () => 'editor.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'editor.[ext]' },
    },
  },
});
