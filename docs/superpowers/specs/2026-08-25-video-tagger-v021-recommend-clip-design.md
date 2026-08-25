# v0.21 推荐导出插入真实片段 主设计文档

- **日期**：2026-08-25
- **版本**：v0.21.0（规划）
- **状态**：grill 定稿，片段放映式模板已实现，待真实素材端到端验收
- **实施计划**：`docs/superpowers/plans/2026-08-25-video-tagger-v021-recommend-clip-plan.md`
- **模板范围**：章节式与片段放映式并存；章节式保留原样，片段放映式使用独立 `recommend-clip.html`；stream/overview 仅保留旧文件，历史配置回退章节式
- **主计划约定**：本文件是 v0.21 的唯一主需求文档，后续同版本需求变更、新增、方案调整和实现状态持续同步本文件，不另建漂移文档。

## 1. 背景与目标（为什么做）

推荐导出（HTML 自包含网页 / 自动录制 MP4）目前只展示媒体封面 + 标题 + 状态/备注/标签等静态信息。用户积累了大量 Clip（已打标的时间戳片段，且 v0.19/v0.20 已具备「本地视频按时间戳裁剪成 MP4」与「ffmpeg 混剪合成」能力），希望在推荐里选择展示片段，让片段**真实视频**参与展示与成片，提升推荐的冲击力与信息量。

**目标**：推荐向导里媒体可挂片段（连续依次播放），片段真实视频进入 HTML 版与 MP4 版；片段选择随草稿/模板持久化。

**延续**：不替代、不重写 v0.12+ 的推荐导出链路；复用 v0.19 Clip 导出裁剪与 v0.20 素材/产物保护经验。推荐导出继续负责 HTML 视觉卡，真实片段由裁剪产物直接参与（HTML 直放 / 录屏直录），不做高光混剪式的多段重拼接。

## 2. 产品决策（grill 拍板汇总）

| 决策点 | 结论 |
|---|---|
| 选了片段后媒体如何定位 | **附加详情展示**：媒体卡保持现状，片段作为该媒体可选的「详情内容」附加呈现 |
| 界面展示形式 | **详情区附加**：卡保持作品封面，片段出现在详情区，可多段 |
| 视频版片段如何参与 | **插入真实片段视频**：成片里直接播放片段真实视频画面 |
| 片段选择入口 | **独立管理入口**（推荐向导媒体卡上的入口，弹窗管理） |
| 片段数量 | 不做硬管控，由用户自定 |
| HTML 版片段怎么显示 | **卡内小窗连播**：媒体卡内嵌视频小窗，连续依次播放该媒体片段 |
| 草稿/模板 | **存进草稿 + 模板** |
| 展示段落结构 | **两者结合**：静态卡信息 + 连续播放片段 |
| HTML 分发方案 | **HTML + 资源文件夹**（自包含网页 + media/ 片段视频） |
| HTML 交付形态 | **zip 打包**（HTML + media/ 压成一个 zip 下载） |
| 片段连续播放顺序 | **可拖拽排序** |
| 片段连播画面布局 | **卡内小窗连播**（媒体卡封面+标题 + 内部小窗连续播片段 + 备注/标签/状态） |
| 片段播放角标 | **两者结合**：预设勾选组合（媒体标题/片段标题/序号/片段备注）+ 可加自定义文字（含占位符） |
| 素材缺失 | **缺失则拦截提示**（导出前校验，列出缺失片段） |
| 未选片段媒体 | **保持现状**（不渲染片段，完全不变） |
| end_sec 空的瞬时片段 | **不设默认时长，直接播到片段自然结束**（播到源视频结尾） |

## 3. 范围

### 3.1 做

1. 推荐向导：媒体卡「选片段」独立入口 + 片段管理弹窗（勾选 / 拖拽排序 / 角标设置 / 待补时长标记）。
2. 片段选择随推荐草稿/模板持久化（config JSON 新增 `mediaClips`）。
3. HTML 版：媒体卡内「卡内小窗连播」真实片段视频 + 角标；导出产物为「HTML + media/ 片段视频」，zip 打包下载。
4. MP4 版：成片在媒体段落内播放真实片段画面（录屏直录片段小窗）。
5. 导出前素材校验：选中片段本地源视频可解析则产出裁剪 MP4，缺失则拦截并列出。
6. 角标系统：勾选组合 + 自定义文字占位符（`{media}` / `{clip}` / `{i}`）。
7. 片段素材工作区与产物保护（按推荐导出任务隔离、失败不覆盖、清理）。

### 3.2 不做（本版边界）

- 不做片段原声混入成片（MP4 以 BGM 为主，片段原声忽略；后续增强）。
- 不做 HLS/DASH 流媒体片段源（沿用 v0.19 本地视频 + 直链/上传素材能力）。
- 不把片段视频 base64 注入 HTML（沿用 v0.20 音画解耦结论：相对路径 media/ 文件，避免阻塞主线程）。
- 不做片段级侧链 ducking / 逐片段音量（沿用 v0.20 fixed 策略边界）。
- 不把真实片段放入高光混剪式的多段 ffmpeg 重拼接（本版录屏直录；若性能不达标，见 §8 演进路线）。

## 4. 数据模型与存储

- **不新增数据库表**。片段选择（`mediaClips`）作为推荐草稿/模板 config JSON 的一个字段：
  ```json
  "mediaClips": {
    "12": {
      "order": [101, 87, 92],        // 该媒体挂的 clipId 顺序（拖拽排序）
      "badge": {"title": true, "clipTitle": true, "index": false, "note": true,
                "custom": "★ {media} · {clip} #{i}"}
    }
  }
  ```
- `badge.custom` 为空 → 只用勾选组合；`{media}`/`{clip}`/`{i}` 为占位符，渲染时替换。
- 草稿/模板沿用 `RecommendPresetService`（`POST/GET /api/recommend/draft`、模板列表/载入/另存为）。`collectRecommendConfig()` 收集 `mediaClips`，`applyRecommendConfig()` 还原。
- 片段素材工作区按推荐导出任务隔离：`data/exports/<任务>/media/clip-<id>.mp4`，产物成功才替换，失败不覆盖旧成片。

## 5. 后端设计

### 5.1 复用能力

- `ClipMapper.listByMedia(mediaId)`：拉某媒体全部片段（已按集+时间排序）。
- `LocalVideoResolver.resolve(videoFp)`：指纹 → `data/videos` 定位本地源视频。
- `ClipExportService`：本地视频按 `timestamp_sec`/`end_sec` 裁剪 MP4。
- `RecommendService.buildHtml`：注入配置渲染 HTML。
- `RecommendVideoService.render`：node render.js（puppeteer 录屏）+ BGM 混流。

### 5.2 新增服务：片段素材准备

`RecommendClipSourceService`（或并入现有服务）：
- `prepareMediaClips(mediaClips, workDir)`：遍历选中片段，逐片调用本地裁剪产出 `media/clip-<id>.mp4`；同一 clipId 去重（同一导出任务内复用）。
- `validateAll(mediaClips)`：导出前校验每个片段的 `videoFp` 能否解析源视频、时间是否合法；返回缺失/非法片段列表（含 clipId、标题、原因），任一缺失则导出拦截。
- 产物隔离与清理：按任务目录，完成后保留 zip/成片、清理中间裁剪物。

### 5.3 接口

- `GET /api/clips?mediaId=`（已有）：片段管理弹窗数据源。
- 新增 `POST /api/recommend/prepare-clips`（body：`mediaClips`）：导出前批量准备 + 校验，返回缺失列表或素材清单（clipId → 相对路径 `media/clip-<id>.mp4`）。
- `POST /api/recommend/html`：入参新增 `mediaClips`；返回改为 **zip 流**（HTML + media/）。响应头 `Content-Type: application/zip`、`Content-Disposition: attachment; filename=*.zip`。
- `POST /api/recommend/video`：入参新增 `mediaClips`；buildHtml 片段区用 `<video src="media/clip-<id>.mp4">`，录屏直录真实画面；成片 MP4 不变。

### 5.5 片段放映式独立模板

v0.21 不把新版片段视觉继续嵌入章节式详情卡，而新增 `recommend-clip.html`。两套正式模板共用 `SLIDES`、配置和导出链路，但页面结构独立：

```text
开篇观前速览 → 前言（可选） → 媒体/Clip 放映 → 结尾总览
```

片段放映式包含媒体/Clip 统计、开场封面速览、新版媒体故事卡、真实 Clip 连播、无 Clip 静态回退和结尾回顾墙；现有背景、BGM、开场/结尾、详情显示和速度/时长配置继续生效。`groupBy`/排序作为媒体元信息和顺序使用，不复制章节式独立章节转场。

章节式模板保留原有行为与文件作为独立样式；stream/overview 文件不删除但不再作为 UI 正式选项，旧配置值安全回退到 chapter。


## 6. 前端设计

### 6.1 独立管理入口

推荐向导步骤 1 媒体卡右上角加「选片段」入口（沿用现有角标/操作位风格，毛玻璃 + 项目色板）。点击打开片段管理弹窗。

### 6.2 片段管理弹窗（16:9 宽屏 + 多列卡片，沿用 ui-modal-169-convention）

- 左侧：该媒体全部片段列表（`GET /api/clips?mediaId=`），缩略图 + 标题 + 时间区间 + 备注；`end_sec` 空标「待补时长」（仅提示，不拦截——按拍板不设默认时长，播到源视频自然结束）。
- 右侧：已选片段（可拖拽排序、删除）。
- 底部：角标设置区——勾选组合（媒体标题/片段标题/序号/片段备注）+ 自定义文字输入（占位符说明）。保存写回 `mediaClips`。

### 6.3 草稿/模板

`collectRecommendConfig()` 收集 `mediaClips`；`applyRecommendConfig()` 还原；草稿自动保存防抖沿用现有 `markRecommendDirty(saveNow)` 机制。

### 6.4 预览

HTML 预览（预览设置 iframe）中媒体卡渲染小窗连播。预览时需要片段素材存在：预览前调用 `prepare-clips` 准备到预览工作区，或预览时对缺失素材显示占位并提示（导出前正式拦截）。

### 6.5 导出流程

- HTML 导出：`POST /api/recommend/html`（带 `mediaClips`）→ 后端校验素材 → 返回 zip 下载。
- 视频导出：`POST /api/recommend/video`（带 `mediaClips`）→ 后端校验素材 → 录屏直录 → 出 MP4。
- 校验失败：toast + 弹窗列出缺失/非法片段（clipId、标题、原因），不产出。

## 7. MP4 版技术方案（录屏直录）

- buildHtml 媒体卡片段区渲染 `<video src="media/clip-<id>.mp4" muted autoplay playsinline loop>`（角标叠加在 video 上）。
- 素材准备阶段产出 `media/*.mp4` 到 render.js 工作区相对路径，puppeteer 加载本地 HTML 可直接访问。
- render.js 录屏天然抓到真实片段画面（screencast 抓的是页面渲染帧）；时间轴天然对齐（录到什么就是什么）。
- BGM 仍走最终混流（render.js 只出静音视频，音画解耦不变）；片段原声本版不混入。
- 风险与缓解：
  - 片段多/大 → 页面加载多视频可能慢：不加硬上限（尊重拍板「不管控」），但导出校验提示片段总数；后续若性能不达标走 §8 演进。
  - video 自动播放 → 需要 puppeteer `--autoplay-policy=no-user-gesture-required`（render.js 已有无头参数，确认补上）。
  - 无声音频 → muted playsinline 保证无声也能播画面（不依赖音频解码）。

## 8. 演进路线（本版不实施，作为风险兜底）

- 若录屏直录片段出现性能/帧率/时长漂移不达标 → 改为「ffmpeg 时间轴合成」：媒体卡静态部分录屏，片段连播段由 ffmpeg 按裁剪产物拼接，按精确时间轴 concat。复杂、工作量大，仅在直录不可行时启用。
- 片段原声混入、片段级音频策略、更多角标占位符：后续增强。

## 9. 边界与安全

- 本地路径不透出：前端只拿 clipId，不拿 `source_path`（沿用 v0.20 受控 API 读取）。
- 素材校验：视频指纹白名单格式、`data/videos` 路径越界防护（复用 `LocalVideoResolver` 既有校验）。
- 工作区隔离与清理：按导出任务目录隔离，失败不覆盖旧成片，完成后清理中间物。
- HTML 注入转义：片段标题/备注/角标自定义文本注入模板前做 JS/HTML 转义（沿用 v0.20 文本转义规范，防多行/引号炸脚本）。
- 片段数量与总时长：导出前校验提示，避免工作区无界增长。

## 10. 验收标准

1. 离线编译、指定服务/迁移单测通过（不混跑 Testcontainers IT）。
2. 片段管理：入口打开弹窗、勾选/拖拽排序/角标设置/待补时长标记，存草稿/模板可恢复。
3. HTML 版：媒体卡小窗连播真实片段、角标正确、zip 下载解压后 media/ 视频可播放；未选片段媒体完全不变。
4. MP4 版：成片媒体段落内播放真实片段画面、BGM 正常、无片段媒体不变。
5. 素材缺失：导出前拦截并列出缺失片段，不产出半成品。
6. 回归 v0.12+：无片段推荐导出（HTML 单文件→zip、视频）行为兼容。
7. 同步主 spec/plan、worklog、CHANGELOG、story、项目记忆（正文/frontmatter/MEMORY.md）。

## 11. 变更记录

| 日期 | 状态 | 变更 |
|---|---|---|
| 2026-08-25 | grill 定稿 | 复盘上次会话 5 批决策，补齐 3 个未决项（角标=两者结合、HTML 交付=zip、瞬时片段=播到自然结束），撰写本主设计文档。 |
