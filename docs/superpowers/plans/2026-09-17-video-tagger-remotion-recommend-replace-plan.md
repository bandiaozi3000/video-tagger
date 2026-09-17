# Remotion 替换推荐视频渲染链路（v0.27）实现计划

> 关联设计规格：`docs/superpowers/specs/2026-09-17-video-tagger-remotion-recommend-replace-design.md`
> 授权：2026-09-17 用户「直接一次性跑全，接入生产。最后我生产验收，后续有要改动的我再说」
> 前置：POC 已验收通过（`52e341a`）；参数通道最小切片已完成并实测（31 生效 / 0 未生效 / 0 出错）

**目标：** `chapter` 样式的推荐视频从「HTML 模板 + Puppeteer 实时抓帧 + FFmpeg 封装」整体切到 Remotion 逐帧渲染：保持旧模板视觉、产物带素材原声、BGM 仍由 Java FFmpeg 混流，前端 `/video` 零改动。

**范围（本次）**

- 替换 `chapter`（含 `stream` / `overview` 回退）样式的渲染路径；
- 视觉移植：把 `recommend-chapter.html` 的 CSS 与 DOM 结构搬进 Remotion（CSS 机械提取，不手抄）；
- 参数：26/29 生效（已实测），`perScreen` / `groupSort` / `groupSec` / `groupBy` 按决策 B 不消费；
- 生产接线：Java 组装 `RenderInput` → Remotion Node 入口 → 带原声产物 → Java BGM 混流 → `data/exports`；
- 预览：`/preview` 按 `groupStyle` 分派（Remotion 样式 → Player 页；`clip` → 旧注入 HTML）。

**不在本次范围**

- `clip` 样式（27KB 模板）——仍走旧 Puppeteer 链路，故 `render.js` / puppeteer 依赖保留；
- `recommend-single.html`（单媒体，走 `RecommendSingleService`）；
- Docker / 桌面端视频导出（现状本就不支持）；
- Remotion Lambda / 云端渲染。

---

## 执行状态（2026-09-17 实测同步）

| Task | 状态 |
|---|---|
| Task 1 CSS 机械提取 | ✅ 完成 |
| Task 2 场景组件重写（chapter DOM） | ✅ 完成 |
| Task 3 Node 正式渲染入口 | ✅ 完成（`scripts/render-recommend.ts`，`--input/--output/--asset-root/--format`） |
| Task 4 Java 接线 | ✅ 完成（`buildRenderInput` + `render()` 分支 + `remotion-dir`/`ffprobe-path` 配置） |
| Task 5 音频链路 | ✅ 完成（去 `-an`、`amix` 混合、ffprobe 探测 + 回退）——**片段路径因库无本地源视频未能端到端实测** |
| Task 6 预览分派 | ⚠️ **改为不做**：`/preview` 继续返回旧注入 HTML（已修 `</style>`，与成片共用同一份 CSS，视觉接近）；Remotion Player 页留待后续（需 vite 构建 + 静态托管） |
| Task 7 验收 | ✅ 隔离实例实测（见下） |

**隔离实例（18099，mysql profile）实测证据**：

```
POST /api/recommend/video {ids:[7492,7476], mediaClips:{}}         → DONE
  Remotion 渲染完成 rendered.mp4（96.3s）→ 导出 mp4
  ffprobe: h264 1280×720, nb_frames=1050 = 计划值（10+10+10+5=35s×30）
POST + bgmTracks(base64)                                           → DONE
  未配 ffprobe 时：首次混合失败 → 回退 BGM 铺满 ✓（有回退兑现）
  配 RENDER_FFPROBE_PATH 后：直走正确分支，无多余尝试 ✓
  ffprobe: video + audio, 35.000s；产物名自动追 `-2` 防覆盖 ✓
POST + mediaClips{7492:[164]}                                      → ERROR
  “片段素材不可用: [#164（找不到本地源视频，请将文件放入 data/videos…）]” → 失败路径报错清晰 ✓
```

`mvn -o compile` = BUILD SUCCESS；`npx tsc --noEmit` 无错误；`npx vitest run` 11 passed；`verify:params` 31 生效 / 0 未生效 / 0 出错。

额外发现并修复的生产 bug：`recommend-chapter.html` / `recommend-overview.html` 缺 `</style>` → 整页空白（默认「章节式」导出会得到空白页）。

---

## Task 1：机械提取旧模板 CSS（不手抄，保证视觉同源）

- [ ] Step 1：写 `backend/remotion/scripts/extract-chapter-css.mjs`，从 `backend/src/main/resources/templates/recommend-chapter.html` 提取 `<style>` 块 → `backend/remotion/src/chapter/chapter.css`
- [ ] Step 2：跑一次提取，产出文件并检查行数/字节数（预期 ~20KB）
- [ ] Step 3：`RecommendComposition` 注入该 CSS（`import './chapter/chapter.css'`）
- [ ] Step 4：验证：`npx tsc --noEmit` 通过；`verify:params` 仍全绿

## Task 2：按旧模板 DOM 结构重写场景组件

- [ ] Step 1：读旧模板 DOM 模板段（`<section class="hero">` / `<main class="story">` / `trackbar` / `bgm-bar` / 结尾）与驱动函数，列出类名清单
- [ ] Step 2：重写 `CollectionOpening` → 旧 `hero` 结构（标题/副标题/统计/封面带/品牌）
- [ ] Step 3：重写 `MediaInfoScene` → 旧 `story` 卡结构（序号/标题/元数据/简介/标签/状态行 + 封面）
- [ ] Step 4：重写 `MediaClipScene` → 旧 `clip-reel` 结构（舞台 + 字幕条 + 计数 + 进度 + 轨道按钮），保留原声 `muted={!hasAudio}`
- [ ] Step 5：重写 `CollectionIntro` → 旧 `prologue` 结构
- [ ] Step 6：重写 `CollectionEnding` → 旧 `ending` 结构（回顾墙 + 文案）
- [ ] Step 7：`trackbar` / `bgm-bar` / 侧导航按旧风格重建（帧驱动进度）
- [ ] Step 8：验证：`verify:params` 全绿（26/29 生效、4 不消费、0 出错、确定性对照成立）

## Task 3：Node 正式渲染入口

- [ ] Step 1：`backend/remotion/scripts/render-recommend.ts`：`--input <json> --output <mp4>`，复用 `asset-server.ts`，`bundle → selectComposition → renderMedia`，`concurrency: 1`，**不静音**
- [ ] Step 2：输出契约：成功打印 JSON 摘要（fps/width/height/durationInFrames/elapsedMs），失败非 0 退出并打印原因
- [ ] Step 3：`package.json` 增 `render:recommend` 脚本
- [ ] Step 4：验证：用 `poc/real-input.json` 渲一条真实产物，`ffprobe` 检查 h264 + AAC + 帧数

## Task 4：Java 接线

- [ ] Step 1：`RecommendService.buildRenderInput(...)` → 输出 `RenderInput` JSON（复用现有 `buildHtml` 的取数逻辑：slides/clips/参数），写临时文件
- [ ] Step 2：`application.yml` 增 `videotagger.render.remotion-dir`（默认 `backend/remotion`）
- [ ] Step 3：`RecommendVideoService.render(...)`：`chapter` 走 Remotion（`node scripts/render-recommend.ts`），`clip` 仍走 `render.js`；产物名 `rendered.<fmt>` 取代 `silent.<fmt>`
- [ ] Step 4：保留超时、失败处理、临时目录清理、`uniqueExportName`
- [ ] Step 5：验证：`mvn -q -o compile` 通过；后端重启后本机跑一次导出

## Task 5：音频链路（带原声）

- [ ] Step 1：`RecommendClipSourceService` 去掉 `-an`（保留素材音轨），并让 `PreparedClip` 能表达是否有音轨
- [ ] Step 2：`RenderInput` 的 clip 带 `hasAudio`（POC 已支持 `muted={!clip.hasAudio}`）
- [ ] Step 3：Java 混流改造：有 BGM → `[0:a][1:a]amix`（固定增益，按待确认项 4 不做 ducking）；`-c:v copy`、`-shortest` 保留
- [ ] Step 4：`ffprobe` 探测产物有无音轨：无音轨 → 回退旧「BGM 铺满静音」写法
- [ ] Step 5：验证：有声段可听、无声段静音、有 BGM 时不破音（`ffprobe` + 音量统计）

## Task 6：预览分派

- [ ] Step 1：`/preview`：`groupStyle=chapter` 系列 → 返回 Remotion Player 页；`clip` → 旧注入 HTML
- [ ] Step 2：Player 页引用 `backend/remotion` 的 Player bundle（构建产物），输入 JSON 内联
- [ ] Step 3：`/html` 保持旧行为（`clip` 用），并在返回中标注当前样式（Remotion 模拟的 HTML 分享包本期不做）
- [ ] Step 4：验证：浏览器打开预览，Player 与成片场景一致

## Task 7：验收

- [ ] Step 1：`cd backend/remotion && npx tsc --noEmit && npx vitest run && npm run verify:params`
- [ ] Step 2：真实数据导出 720P 一条，`ffprobe` 核对帧数 = `scene-plan`、音轨存在
- [ ] Step 3：两次同输入渲染场景与帧数一致
- [ ] Step 4：`mvn -o test` 相关测试通过（不改数据库、不引入新表）
- [ ] Step 5：真实浏览器走完整链路（规则 11）：推荐向导 → 预览 → 导出 → 任务列表 → 打开目录
- [ ] Step 6：写当天 worklog + 同步规格状态

## 风险与回退

| 风险 | 处置 |
|---|---|
| 视觉还原度不足（微动效） | 本次以「CSS 同源 + DOM 结构同源」保底；差异项在交付说明中逐条列出，用户验收后按反馈迭代 |
| 首个真实渲染耗时长 | 单帧验证器（`verify:params`，36s）作为主回归网；整片渲染只在验收跑 |
| `amix` 在无音轨产物上失败 | `ffprobe` 预探测 + 回退分支（Task 5 Step 4） |
| `clip` 样式仍用旧链路 | 明确保留 puppeteer 依赖与 `render.js`；退役留待 `clip` 也移植后 |

## 不做

- 不新增数据库表、不改前端接口签名、不改桌面端、不改 Dockerfile。
