/**
 * 生产预览页构建配置：把 `player.html` + `src/player.tsx` 打成静态包 → `dist-player/`。
 *
 * 产出由 Spring Boot 在 `/recommend-player/**` 下托管（见 backend 的 WebConfig），
 * `/api/recommend/preview` 读取 `dist-player/player.html` 并注入 RenderInput 后返回。
 *
 * 构建：cd backend/remotion && npm run build:player
 * 说明：不引入 @vitejs/plugin-react —— Vite 的 esbuild 直接按 tsconfig 的 `jsx: react-jsx` 转换 TSX，
 *      本页面不需要 HMR，故无需该依赖。
 */
import path from 'node:path';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname);

export default defineConfig({
  root,
  base: '/recommend-player/',   // 页面由 /api/recommend/preview 返回，资源必须走绝对路径
  publicDir: false,
  build: {
    outDir: 'dist-player',
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(root, 'player.html'),
    },
  },
});
