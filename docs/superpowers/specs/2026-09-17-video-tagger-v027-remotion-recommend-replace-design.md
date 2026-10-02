# Remotion 替换推荐视频渲染链路 设计规格（v0.27）

- **日期**：2026-09-17
- **关联版本**：v0.27
- **状态**：待用户审阅批准。**未批准前不写执行计划、不改代码。**
- **前置文档**：
  - POC 设计规格：`docs/superpowers/specs/2026-09-14-video-tagger-v027-remotion-multi-media-recommend-poc-design.md`
  - POC 执行计划：`docs/superpowers/plans/2026-09-14-video-tagger-v027-remotion-multi-media-recommend-poc-plan.md`
  - 版本事实：`CHANGELOG.md` 中 v0.26.0 已于 2026-09-08 发布，并写明「正式模板录制/导出仍留在 v0.26 后续阶段」

## 1. 目标

把推荐视频的渲染引擎从 **「HTML 模板 + Puppeteer 实时抓帧 + FFmpeg 封装」** 替换为 **「Remotion 逐帧渲染」**，同时：

- 保持现有 `chapter` 模板的**视觉风格**不变；
- 保留 **BGM** 机制（多曲、循环、时长对齐）；
- 产物**直接带素材原声**；
- 旧渲染链路退役。

属于架构型替换（v0.27），不是新增并存模板。

### 1.1 非目标

- 不改媒体/Clip 的业务模型与选择流程（`ids` + `mediaClips` 语义不变）；
- 不改导出任务队列的 UI 与接口形态；
- 不为 Docker / 桌面端提供视频导出能力（现状本就不支持，见 §12）；
- 不新增数据库表。

## 2. 已确认决策（2026-09-17 用户答复）

| # | 决策 | 说明 |
|---|---|---|
| 1 | **跑在本机** | 后端本机 spawn node 渲染。不追求 Docker/云端/桌面可用性 |
| 2 | **音频直接带原声** | Remotion 产物自带音轨，不再有"静音视频"中间产物 |
| 3 | **替换成 Remotion** | 不是并存。旧 Puppeteer 链路退役 |
| 4 | **BGM 按方案 (b)** | Remotion 出带原声成片；**BGM 混流仍由 Java FFmpeg 负责**（BGM 逻辑、多曲拼接、时长对齐全部留用） |
| 5 | **版本 v0.27** | v0.26.0 已发布；本次技术栈级替换归 v0.27。同时收回 v0.26 方案中「暂不引入 Remotion」的约束 |

## 3. 替换范围

### 3.1 替换掉

| 对象 | 现状位置 | 处置 |
|---|---|---|
| 模板注入 | `RecommendService.buildHtml()` / `readTemplate()` / `normalizeStyle()`（`RecommendService.java:159,548,558`） | 新增 `buildRenderInput()`；HTML 注入仅供仍走旧链路的样式使用 |
| Puppeteer 渲染调用 | `RecommendVideoService.render()` 中 `node render.js --html ... --out silent.mp4` | 换成 Remotion Node 入口 |
| 「静音视频」中间产物 | `work/silent.<fmt>` | 换成 Remotion 产物（带原声）`work/rendered.<fmt>` |
| `recommend-chapter.html`（69KB）的视觉 | `resources/templates/` | 搬进 Remotion 组件（CSS/DOM 照搬，驱动方式改写，见 §7） |

### 3.2 保留不动

- **BGM 全套**：`bgmPaths`（多曲按序 concat）、`bgmTracks`（曲名/进度条数据）、`bgmDurs`（时长）、`-stream_loop` + `-shortest` 混流策略；
- 产物命名 `uniqueExportName()`、导出目录 `data/exports`、任务队列 `VideoExportTaskService`（内存态 `status/message/filePath`，`runAsync/list/get/delete/open`）；
- **`/video` 接口签名与前端调用点**（`app.js:4656`）→ 前端零改动；
- 素材准备 `RecommendClipSourceService.prepare()`（**除音频保留一项，见 §8.1**）；
- `RENDER_TIMEOUT_SECONDS`（40 分钟，`RecommendVideoService.java:37`）。

### 3.3 暂不替换（**待确认项 1**）

| 对象 | 现状 | 建议 |
|---|---|---|
| `recommend-clip.html`（27KB） | `normalizeStyle()` 里 `chapter` / `clip` 都是正式样式，走同一个 `RecommendVideoService.render()` | v0.27 先只替换 `chapter`，`clip` 保留旧链路；`chapter` 验收通过后再跟进 |
| `recommend-single.html` | 单媒体路径，走 `RecommendSingleService`（独立入口） | 不在本次范围 |
| `stream` / `overview` | 已在 `normalizeStyle()` 回退到 `chapter` | 随 `chapter` 一起被替换，无需单独处理 |

## 4. 现状链路（对照基线，读码核实）

```text
前端推荐向导 (app.js)
  └─ POST /api/recommend/video
       └─ VideoExportTaskService.create() → runAsync()
            └─ RecommendVideoService.render(ids, title, fmt, resolution, bgmPaths, bgmTracks, ...25+ 个模板参数)
                 1. RecommendService.buildHtml(groupStyle, ...) → 读 recommend-<style>.html
                    → 注入数据（esc() / jsText() 转成 JS 字面量）→ 写 work/recommend.html
                 2. node render.js --html recommend.html --out silent.mp4
                    （puppeteer-core 连系统 Chrome，实时播放 + screencast 抓帧 → ffmpeg 编码）
                 3. Java FFmpeg 混流：
                    有 BGM → -i silent.mp4 -stream_loop -1 -i bgm -map 0:v:0 -map 1:a:0
                              -c:v copy -c:a aac -shortest → data/exports/{title}.{fmt}
                    无 BGM → 直接把 silent.mp4 改名搬过去
                 4. finally：清理 work 临时目录
```

关键事实：

- **时长由 Java 算**：`durationSeconds = opening + intro + group + detail + ending`（来自 `RecommendService.Durations`，秒），再加上 BGM 收尾余量 `+ ceil(maxTrack) + 5`。
- **实时抓帧是不确定的**：所以才有"录制延长"与 `render.js` 兜底上限。
- **素材被强制去音轨**：`RecommendClipSourceService.java:106` 用 `-an` 生成无声素材。
- **预览/分享**：`/preview`（`app.js:4556`）与 `/html`（`app.js:4591`）都返回 `buildHtml()` 注入后的 HTML，URL 前缀 `media/clip-` 被改写为 `/recommend-previews/{token}/media/clip-`。

## 5. 目标架构

```text
前端推荐向导（几乎不改）
  └─ POST /api/recommend/video（签名不变）
       └─ VideoExportTaskService（不变）
            └─ RecommendVideoService.render()（内部换实现）
                 1. RecommendService.buildRenderInput(...) → RenderInput JSON（快照 + 预检）
                 2. node remotion/scripts/render-recommend.ts --input in.json --output rendered.mp4
                      bundle() → selectComposition() → renderMedia()   ← 产物自带原声
                 3. Java FFmpeg 混流（BGM 换成与原声混合，见 §8.3）
                 4. 产物 → data/exports/{title}.{fmt}
```

分层职责（沿用 POC 已定原则）：

- **Spring Boot**：业务校验、数据快照、素材准备、组装 `RenderInput`、调 Node、BGM 混流、任务记录。
- **Remotion**：只消费 `RenderInput`，用纯函数 `buildScenePlan()` 算出帧级计划，渲染。**不复制第二套时长算法。**

## 6. 数据契约

### 6.1 RenderInput（由 POC 的 input 结构演进）

沿用 POC `MultiMediaPocInput` 形状（`backend/remotion/src/types.ts`），正式版需要扩展：

```text
template      模板标识（正式值待定，如 MULTI_MEDIA_RECOMMEND）
title/subtitle/intro
fps/width/height        ← 由 resolution 参数决定（现在 POC 里是常量 30/1280/720）
media[]                 ← mediaId/order/mode/title/originalTitle/year/season/coverAssetPath/description/tags/clips[]
   clips[]              ← clipId/episodeNo/episodeTitle/title/assetPath/durationMs/sourceStartMs/hasAudio
assetBaseUrl            ← 本地静态资源服务地址（不向 Remotion 传 file://）
durations               ← 【新增】opening/intro/group/detail/ending（秒），替代 POC 的硬编码常量
bgm                     ← 【新增，若做 BGM 条 UI】曲目名/进度/下一首提示/bgmScale/bgmX/bgmY
```

### 6.2 时长权威（**本次必须改掉的现状**）

- 现状：Java 算 `durationSeconds`，Remotion POC 的 `buildScenePlan()` 用硬编码常量（opening 3s、clipInfo 3s、infoOnly 5s、ending 3s，`scene-plan.ts:5-8`）。
- 目标：**`buildScenePlan()` 是唯一时长权威**（帧为单位）；`Durations` 与分辨率通过 `RenderInput` 传入；Java 只保留"给用户看的预估时长"，不再作为渲染依据。
- 秒 → 帧的转换只发生在 `buildScenePlan()` 边界（POC 已定原则）。

### 6.3 校验

- Java 侧：复用 `RecommendClipSourceService.prepare()` 的现有预检（媒体 ID、Clip 归属、时间范围、资源路径），**选中 Clip 缺失/越界/不可解码 → 明确报错，不静默退化为资料卡**（POC 规格 §8 已定）。
- Remotion 侧：`validateInput()` 保留为兜底（重复 ID、INFO_ONLY 带 Clip、标题为空等）。

## 7. 视觉与风格对齐（保持 chapter 现有风格）

### 7.1 为什么可行

两套链路都跑 **Chrome** 渲染 DOM：旧链路是"实时播放 + screencast 抓帧"，Remotion 是"跳到第 N 帧再截图"。CSS、字体族、渐变、滤镜、排版行为同源 → **`<style>` 整块与 DOM 结构可以照搬**，这是"搬迁"级工作，不是"重新设计"级。

### 7.2 必须改写（真实工作量）

`recommend-chapter.html`（69KB）的实测构成：23 处 `transition:`、5 处 `@keyframes`、11 处 `setTimeout`、4 处 `setInterval`、2 处 `requestAnimationFrame`、1 `<video>`、1 `<audio>`。

| 旧写法 | 为什么 Remotion 用不了 | 换成 |
|---|---|---|
| `setTimeout` / `setInterval` 切场景 | Remotion 逐帧截图，没有真实时钟在推进 | `useCurrentFrame()` + `<Series>` / `<Sequence>` |
| `requestAnimationFrame` | 同上 | `interpolate()` 按帧计算 |
| CSS `transition:` | 逐帧截图时页面时间不推进 → 静止或跳变 | `interpolate()` / `spring()` |
| CSS `@keyframes` | 同上 | `interpolate()` + frame |
| `<video>` | 需要显式等加载（`delayRender`） | Remotion `<OffthreadVideo>`（POC 已用） |
| `<audio>`（BGM 播放） | 同上；且 BGM 按 (b) 不走 Remotion | 不搬，由 Java FFmpeg 混流负责 |

**唯一需要逐处比对手感的点**：CSS `cubic-bezier(...)` ↔ `Easing.bezier(...)` 的缓动曲线对齐。

### 7.3 也要重画的部分

- **BGM 条 UI**：由 `bgmTracks` + `bgmScale/bgmX/bgmY` 驱动的曲名/进度/下一首提示条 → 必须用 React 重画（它是模板 DOM 的一部分）。若本期不做 BGM 条，要显式接受功能削减（**待确认项 2**）。

### 7.4 对齐验证方法

沿用 POC 已建立的"逐场景抽帧"流程：同一份数据分别用旧模板与 Remotion 渲染，按场景在对应帧抽图人工比对。这是本规格 §14 验收第 1 条的唯一判定方式。

## 8. 音频与 BGM（方案 b）

### 8.1 必改：素材准备保留原声

`RecommendClipSourceService.java:106` 当前为 `-an -movflags +faststart -f mp4`，即**准备出来的 Clip 素材没有音轨**。

- 处置：去掉 `-an`（保留原声），或为 Remotion 路径新增一条保留原声的准备命令。
- 影响面：旧链路（若 `clip` 样式仍跑）输出的是静音视频，素材带音轨**无害**。
- 附带：`PreparedClip` 记录中需要能表达"该 Clip 是否有音轨"（POC 用 `hasAudio` 决定 `muted`），需要从素材或 Clip 元数据判定。

### 8.2 Remotion 产物带原声

`renderMedia` 不做静音处理；片段场景 `<OffthreadVideo muted={!clip.hasAudio}>`（POC 已实现并验收：有声段 mean −31.4dB，无声段 −91.0dB）。

### 8.3 Java FFmpeg 混流改造

现状（有 BGM）：

```text
ffmpeg -y -i silent.mp4 -stream_loop -1 -i bgm.mp3 \
       -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest out.mp4
```

目标（有 BGM + 产物带原声）：把"BGM 铺在静音上"改为"**原声 + BGM 混合**"，视频流仍 `-c:v copy` 不重编码：

```text
ffmpeg -y -i rendered.mp4 -stream_loop -1 -i bgm.mp3 \
       -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0[a]" \
       -map 0:v:0 -map "[a]" -c:v copy -c:a aac -shortest out.mp4
```

三个必须处理的边界：

1. **产物无音轨时**（全员无声素材）`amix` 会失败 → 需 `ffprobe` 探测后回退到"BGM 铺满"的旧写法；
2. **多曲 BGM**：现在是多曲按序 concat 成一条再混入 → 保持不变；
3. **ducking（有原声时压低 BGM）**：见 **待确认项 4**。建议 v0.27 先做**固定增益混合**，ducking 作为后续增强；若要求一次到位，改用 `sidechaincompress`。

### 8.4 时长对齐

现状的 `durationSeconds + ceil(maxTrack) + 5` 是"等当前 BGM 放完"的实时录制补丁（`RecommendVideoService.java:253`）。Remotion 下改为**按帧精确表达**；BGM 侧继续用 `-stream_loop -1` + `-shortest` 以视频时长为硬边界裁切。

## 9. 渲染调用与进程管理

- **Node 入口**：`backend/remotion/scripts/render-recommend.ts`（POC 契约：`--input <json> --output <mp4>`，`scripts/render-poc.ts` 已跑通 `bundle → selectComposition → renderMedia`）。
- **Java 配置**：新增 `videotagger.render.remotion-dir`（默认 `backend/remotion`）；复用 `node-path` / `ffmpeg-path`；`chrome-path` 对 Remotion **无效**（用 Remotion 自带 Chrome Headless Shell），旧链路退役后可保留给 `clip` 样式。
- **超时**：沿用 40 分钟。POC 实测 813 帧 / 720P：冷 168.5s、热 106.9s → 1080P/4K 需实测重估（**风险项**）。
- **并发**：POC 用 `concurrency: 1`。Remotion 默认多进程，需在入口显式固定，避免任务叠加时打满机器。
- **临时目录与清理**：沿用现有 `work` 临时目录 + `finally deleteTree()`。
- **首次环境准备（写进 README/环境事实）**：`cd backend/remotion && npm install`；实测该目录 `node_modules` = **562MB**、自带 Chrome Headless Shell = **269MB**。

## 10. 预览与导出接线

| 端点 | 现状 | 处置 |
|---|---|---|
| `/video` + `/video/tasks*` | 创建异步任务、列出/打开/删除 | **签名与行为不变**，内部换渲染实现 → 前端零改动 |
| `/preview`（`app.js:4556`） | 返回 `buildHtml()` 注入后的 HTML | 见 **待确认项 3** |
| `/html`（`app.js:4591`） | 返回 HTML 分享包字节流 | 见 **待确认项 3** |

**待确认项 3 的候选方案**：

- **P1（建议）**：新增 `/preview/remotion`，返回 Remotion `<Player>` 页面（复用 `backend/remotion/player.html` + bundle）；`/preview` 与 `/html` 保留给旧样式（`clip`）。互不干扰，可回退。
- **P2**：`/preview` 直接改成 Player 页面；`/html` 的等价物（Player 静态分享包）本期不做，需显式接受"HTML 分享包能力消失"。
- **P3**：`/html` 改为导出"Player 静态包"（zip），工作量最大，可后置。

## 11. 模板参数支持矩阵（已实测，待确认项 2 已按决策 B 定案）

### 11.1 结论：26 / 29 已生效，余 3 项按决策 B 不消费

已在本仓 Remotion 沙盒（`backend/remotion`，不影响生产链路）实现参数通道，并用可重复的自动验证实测：

```bash
cd backend/remotion && npm run verify:params -- --scale 0.4
```

验证方法（见 `scripts/verify-params.ts`）：同一帧、同一输入，**只改一个参数**各导一张 PNG；字节不同 ⇒ 参数生效，字节相同 ⇒ 未生效。带**确定性对照**（同输入两渲字节必须一致）保证判定成立。

实测结果（2026-09-17，输入 `poc/real-input.json`，报告 `poc/output/params/param-verification.json`）：

| 状态 | 数量 | 项目 |
|---|---|---|
| ✅ 生效 | 31 | `title` `brandTitle` `subtitle` `intro` `prologueTitle` `endingTitle` `endingText` `coverSize` `detailShow`(status/note/tag) `bgColor` `bgImages` `bgRotationSec` `bgOpacity` `bgBlur` `bgBrightness` `bgmTracks` `bgmScale` `bgmX` `bgmY` `openingSpeed` `endingScrollSpeed` `openingIds` `openingSec` `introSec` `detailSec` `endingSec` `fps` `width` `height` |
| ➖ 不消费 | 4 | `perScreen` `groupSort` `groupSec` ＋ Java 侧 `groupBy` —— **2026-09-17 用户选定决策 B：本版不补「分组网格屏」**，这四项在 Remotion 模板下有意不实现 |
| ❌ 出错 | 0 | — |

判定口径：“生效” = **参数能被渲染出来**；不等于“与旧模板像素级一致”（后者仍需 §7.4 的逐屏同帧比对，工作量不变）。

### 11.2 两项必须注意的语义变化

1. **`openingSpeed` / `endingScrollSpeed`**：旧模板是“实时滚动像素/秒”，帧模型下重定义为“动画用多少帧完成”（`speedToFrames`：0→36 帧、50→22 帧、100→8 帧）。**手感需重调，不承诺与旧模板像素级一致。**
2. **`bgm*`**：只接了 **UI**（BGM 条）；音频本身仍由 Java FFmpeg 混流（§8.3），与决策 (b) 一致。

### 11.3 参数默认值与 clamp 区间已逐项对齐 Java

`src/params.ts` 的 `DEFAULT_PARAMS` 与 Java `RecommendService`（`clamp` / `clampSpeed` / `normalizeCoverSize` / `normalizeDurations` / `buildDetailShowJson`）逐项一致，并由单测锁定（`src/params.test.ts`）。避免两侧对同一参数给出两套语义。

### 11.4 决策 B 的接线约束（**必须执行，否则变成死开关**）

- 选择 Remotion 模板时，推荐向导里 **`perScreen`（每屏几部）/ `groupSort`（分组排序）/ `groupBy`（分组维度）/ `groupSec`（分组屏时长）四项控件必须隐藏或禁用**。
- **只能按模板隐藏，不能全局删**：`clip` 样式在过渡期仍走旧 Puppeteer 链路，那四项在那里仍然有效。
- 参数本身**保留在 `RenderParams` 契约里**（与 Java `RecommendExportRequest` 保持 1:1，JSON 直接透传），仅在 Remotion 侧不消费；代码里以 `NOT_CONSUMED_KEYS` 显式标记，**不是 TODO**。
- 若将来要做「一屏多部」的分组网格，这是**信息结构层面**的变更（POC 是逐部展示），需重新评估而非“把参数接上”。

### 11.5 追加约束

- `src/scene-plan.ts` 现在消费 `durations` / `fps` / `width` / `height`：**旧的 4 份 POC 输入 JSON 不传 `params` 时会走 Java 默认时长（10/5/5/10/5）**，与之前 POC 的硬编码（3/–/3或5/3 秒）不同——重跑旧样本的产物会变长，属预期。
- 旧公式 `detail 屏时长 = max(detailSec, Σ片段时长+2)`（模板 `storyHold()`）只在“片段同屏滚筒”结构下成立；本切片保持 POC 的“资料卡 + 每片段独立场景”结构，故 `detailSec` 就是资料卡时长。滚筒结构移植时需一并改回该公式。
- **其余参数（`bg*` / `coverSize` / `detailShow` 等）的视觉仍不是旧模板风格**：本次只做了参数通道，视觉移植（§7）尚未开始。

## 12. 环境前提与部署边界

- **仅本机可用**：与现状一致。`Dockerfile` 是纯 JRE（无 node/chrome/ffmpeg），容器内视频导出本就不可用（`application.yml:161` 注释已承认）；桌面端已按 `docs/rules.md` §13 冻结。
- 本次替换**不触碰**前端静态资源、桌面壳、数据库结构。
- 前端构建产物仍是同一份 `backend/src/main/resources/static/`。

## 13. 不做（本期明确排除）

- Electron 打包集成、Docker/云端渲染、Remotion Lambda；
- 云端或远程 URL 素材直接交给 Remotion 播放（继续只喂已准备的本地素材）；
- 向量检索/数据库结构变更（无新表）；
- 自定义 CSS 主题编辑器、多轨时间线、字幕轨、FCPXML/OTIO 导出。

## 14. 验收标准

1. **视觉一致**：`chapter` 风格在相同数据下，旧模板与 Remotion 逐场景同帧抽图人工比对一致（判定标准见 §7.4）；
2. **音频**：有声片段原声可听、无声片段静音；有 BGM 时能听到 BGM 且不爆音；无音轨产物不导致混流失败；
3. **时序**：成片帧数等于 `buildScenePlan().durationInFrames`；同一输入两次渲染场景顺序与帧数一致；Clip 切点误差 ≤ 1 帧；
4. **接线无回归**：导出任务队列的创建/进度/列表/打开目录/删除行为不变；产物命名与 `data/exports` 位置不变；
5. **旧链路退役干净**：grep 确认 `render.js` 不再被调用；`backend/scripts` 的处置按 **待确认项 5** 执行；
6. **分辨率**：720P 必过；1080P 至少跑通一次并记录耗时；
7. **失败路径**：素材缺失报错文案明确；渲染超时不挂死进程；临时目录失败后清理干净；
8. **UI 真实链路验收**（规则 11）：真实浏览器完整走一遍 推荐向导 → 预览 → 导出 → 任务列表 → 打开目录，不只跑后端测试；
9. **参数功能覆盖（可自动化门禁）**：`cd backend/remotion && npm run verify:params` 全部通过（当前 31 项生效、4 项结构待补、0 出错，且确定性对照成立）；后续每新增一个参数接线，该清单对应项由“未生效”转“生效”。

## 15. 风险与遗留

| 风险 | 说明 | 处置 |
|---|---|---|
| 风格对齐工作量 | 23 处 transition + 5 处 keyframes + 时间轴全部要改写；缓动曲线需逐处比对 | 本规格最大的工作量，需在 plan 里拆成可验收的小步 |
| 参数倒退 | 按决策 B，`perScreen` / `groupSort` / `groupSec` / `groupBy` 在 Remotion 模板下失效 | 接线时按§11.4 隐藏对应 UI（**不能全局删**，`clip` 旧链路仍需要） |
| 音频混流边界 | 无音轨产物 + `amix` 组合会失败 | 先用 `ffprobe` 探测再分支（§8.3） |
| 首次环境准备 | `npm install` 562MB、自带 Chrome 269MB | 写进 README / 环境事实；不进 Git |
| 1080P/4K 耗时未测 | POC 只测了 720P | 验收第 6 条覆盖 1080P；4K 记录风险不承诺 |
| Remotion 许可证与商业分发 | POC 规格 §12 已列为待核验，尚未完成 | 若本项目自用，需你确认接受；否则先核验 |
| BGM ducking | 固定增益混合在"原声较响 + BGM 较响"时可能糊 | 先固定增益，作为后续增强 |

## 16. 待用户确认项（评审时逐条拍板）

1. **`clip` 样式**：本期是否与 `chapter` 一起替换？（建议：先只替换 `chapter`）
2. **参数支持矩阵**（§11）：**已定案**——2026-09-17 用户选决策 B（不补「分组网格屏」），26/29 生效、4 项不消费（含 Java 侧 `groupBy`）；接线时按 §11.4 按模板隐藏这四项控件；`openingSpeed` / `endingScrollSpeed` 接受“手感重调、不承诺像素级一致”。
3. **`/preview` 与 `/html`**：选 P1 / P2 / P3？（建议 P1）
4. **BGM 混音**：固定增益就够，还是要 `sidechaincompress` ducking？
5. **旧链路代码**：`backend/scripts/render.js` 与 puppeteer 依赖本期是否一并删除？（建议：先保留到 `chapter` 验收通过后再删）
6. **许可证**：Remotion 商业分发/许可条件是否已接受？

## 17. 审阅与变更记录

- 2026-09-17：初版。基于 POC 结论（通过）+ 用户当日答复（跑本机 / 带原声 / 替换 / BGM 方案 b / v0.27）编写。**等待用户审阅批准；批准前不写执行计划。**
- 2026-09-17（当日追加）：用户授权“按你的理解采用最小步骤实现”，已完成**参数通道**最小切片（仅动 `backend/remotion` 沙盒）：新增 `src/params.ts`（29 占位符 + 默认值/clamp 对齐 Java）、`Backdrop` / `BgmBar` / `CollectionIntro` 三个新场景组件、场景自带底色为背景层让位、`scene-plan` 改由参数驱动时长/分辨率/帧率；新增 `scripts/verify-params.ts`（renderStill 逐参数生效验证 + 确定性对照）与 `src/params.test.ts`。实测 **31 项生效 / 4 项待补结构 / 0 出错**。§11 已改为实测结果；§14 新增可自动化门禁。**视觉移植（§7）与生产接线仍未开始。**
- 2026-09-17（当日二次追加）：用户选定**决策 B**（不补「分组网格屏」）。沙盒侧把 `STRUCTURE_PENDING_KEYS` 改为 `NOT_CONSUMED_KEYS` 并写明“非 TODO、是有意不实现”；验证报告把这四项从“未生效”改为单列“不消费”，结论变为 **31 生效 / 0 未生效 / 0 出错**。规格 §11.1、§11.4（新增“决策 B 接线约束”）、§15 同步。
