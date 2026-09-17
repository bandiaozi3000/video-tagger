# Remotion 原生重写推荐视频渲染链路 执行计划（v0.27）

- **日期**：2026-09-18
- **设计规格**：`docs/superpowers/specs/2026-09-18-video-tagger-remotion-native-recommend-design.md`
- **状态**：用户已批准规格并授权「一次性执行完毕」（含四条决策：保留分组/每屏、`/html` 退役、`clip` 按新风格、一次性重写；版本仍归 v0.27）。

## 任务分解

| # | 任务 | 产物 | 验收 |
|---|---|---|---|
| 1 | Remotion 契约层重写 | `src/theme.ts`（视觉令牌，两套模板形态共用）、`src/params.ts`（瘦身 + bgm/group/style）、`src/scene-plan.ts`（时长权威：分组 / 每屏 / 两套样式） | `npx vitest run` 计划级断言 |
| 2 | 场景组件重写（全帧驱动） | `src/scenes/*`、`src/chrome.tsx`、`src/audio.tsx`、`src/RecommendComposition.tsx` | `npx tsc --noEmit`；渲染抽帧目视 |
| 3 | 删除旧视觉载体 | `chapter/chapter.css`、`chapter-css.ts`、`chapter/geometry.ts`、`scripts/extract-chapter-css.mjs` | 无引用 |
| 4 | 渲染入口 | `scripts/render-recommend.ts`：去 FFmpeg 混流依赖、显式编码参数、bundle 缓存 | 真实渲染产物带原声+BGM |
| 5 | 门禁（可自动化） | `scripts/check-native.mjs`（硬禁则）、`scripts/verify-params.ts`（新契约参数矩阵 + **多场景多帧确定性**） | 两脚本全绿 |
| 6 | Java 输入契约 | `RecommendService.buildRenderInput`：分组标签、BGM（名/时长/路径）、样式、封面 | 隔离实例 `/preview` + 导出 |
| 7 | Java 渲染路径收敛 | `RecommendVideoService`：删 BGM concat / `remixMixCommand` / `runMix` / `probeHasAudio`、`render()` 单路径（不再分样式） | `mvn -o compile` |
| 8 | 预览与分享 | `/preview` 统一 Remotion Player；删 `legacyPreview`；`/html` 退役；前端去掉「导出 HTML」入口 | 真实浏览器 |
| 9 | 旧链路归档 | `templates/recommend-{chapter,clip,overview}.html`、`scripts/render.js` → `archive/` | grep 无引用 |
| 10 | 验证与文档 | 隔离实例 E2E 导出 + `ffprobe`；CHANGELOG / story / worklog / 规格状态 | 见「验收证据」 |

## 验收证据清单（已执行，2026-09-18）

1. `cd backend/remotion && npx tsc --noEmit` → No errors
2. `cd backend/remotion && npx vitest run` → 2 files / 26 tests passed
3. `cd backend/remotion && node scripts/check-native.mjs` → 22 源文件无硬禁则违规
4. `cd backend/remotion && npm run verify:params -- --scale 0.4` → 38 项 37 生效 / 0 出错 + 4 场景×2 次确定性一致（随后补 detailShow.note，复测全绿）
5. `cd backend/remotion && npm run build:player` → dist-player 453KB
6. `cd backend && mvn -o compile && mvn -o test` → 362 tests / BUILD SUCCESS
7. 隔离实例（18099）：/preview 200（Player 注入 style/group/perScreen 正确）、3 次导出 DONE（124.6/123.1/124.7s，720P），帧数 720 == 计划值，aac 音轨 189kb/s
8. 抽帧目视：开场 / 一屏 N 部 / 结尾 均正常（截图见 worklog 增量四）


1. `cd backend/remotion && npx tsc --noEmit`
2. `cd backend/remotion && npx vitest run`
3. `cd backend/remotion && node scripts/check-native.mjs`
4. `cd backend/remotion && npm run verify:params`
5. `cd backend/remotion && npm run build:player`
6. `cd backend && mvn -o compile`
7. 隔离实例：`/api/recommend/video`（chapter）/ `/preview`（Player）/ `ffprobe` 帧数与音轨
8. 真实浏览器：推荐向导 → 预览 → 导出 → 任务列表 → 打开目录

## 需要偏离规格的地方（先声明，完成后写进 worklog）

- **保留 `scripts/asset-server.ts`**（规格 §9 原写删除）：实测可用的素材通道不推倒重建，`publicDir/staticFile` 的收益（36 行）不足以抵掉三种运行环境（渲染 / Player 预览 / 单帧验证）的素材解析风险。
- **封面仍用 data URI（embed）**（规格 §8 原写改相对路径）：同理，避免为封面额外复制文件；渲染自足性已验证。
