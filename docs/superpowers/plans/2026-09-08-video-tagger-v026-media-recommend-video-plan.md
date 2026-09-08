# v0.26 媒体级模板化推荐视频实施计划

- **日期**：2026-09-08
- **版本**：v0.26.0
- **状态**：已提交原型与底层基础，下一会话从 G2 正式业务模板接入继续
- **主设计**：`docs/superpowers/specs/2026-09-08-video-tagger-v026-media-recommend-video-design.md`
- **视觉原型**：`docs/design/2026-09-08-v026-single-media-recommend-template.html`

## 1. 实施原则

1. 面向用户的主体验是模板化推荐视频，不继续扩展一个半专业剪辑器。
2. 用户负责勾选和排序 Clip；系统负责素材检查、场景编排、预览和导出。
3. `ScenePlan` 作为统一输入；HTML 负责视觉和预览，FFmpeg 负责素材处理和必要封装。
4. 复用 `HighlightProject`/`HighlightProjectItem`，不新建第二套单媒体 Clip 选择模型。
5. 缺素材不静默丢弃；可生成当前可用版，但导出快照必须标记排除项。
6. 默认 MP4/1080P、无 BGM；高级选项折叠。
7. 模板先保证稳定观感，再增加选项；不开放原始编码参数和多轨专业剪辑控制。

## 2. 阶段

### G1 方向与原型

- [x] 建立 v0.26 主设计文档；
- [x] 建立本唯一实施计划；
- [x] 明确单媒体推荐与 v0.20/v0.21 的边界；
- [x] 生成并浏览器验证单媒体 HTML 视觉原型；
- [ ] 将原型数据占位符映射为业务 `ScenePlan`。

> **下次会话起点**：从 G2 开始，将 `docs/design/2026-09-08-v026-single-media-recommend-template.html` 收敛为 `backend/src/main/resources/templates/recommend-single.html`，接入 `RecommendService` 的单媒体数据和真实 Clip 资源；不要重新设计高光工作台，也不要先引入 Remotion/Skia。

门禁：用户流程、模板结构、渲染分层和复用边界清楚。

### G2 单媒体推荐模板业务接入

- [ ] 新增 `recommend-single.html` 正式模板（下次会话第一项）；
- [ ] 支持单媒体档案片头：封面、标题、年份/季度、简介、标签、Clip/集统计；
- [ ] 支持推荐导语、片段播放、片段标题淡出和推荐回顾墙；
- [ ] 支持自动章节策略：自动/始终/关闭；
- [ ] 支持单媒体 Clip 的顺序、入出点和剧透状态；
- [ ] 复用浏览器字体体系，避免 FFmpeg `drawtext` 作为主要文字渲染；
- [ ] 媒体封面按本地封面 → 代表性 Clip 帧 → 外部缓存 → 背景回退。

门禁：空简介、空标签、无封面、无集号都能形成完整但不空洞的模板。

### G3 素材与预览链路统一

- [x] 高光准备复用片段素材化的本地源判断；
- [ ] 推荐单媒体模板复用 `MaterializationService`/`HighlightSourceService` 的结果；
- [ ] 生成预览只在用户点击后启动；
- [ ] 预览使用同一 `ScenePlan`，低成本输出可播放结果；
- [ ] 预览完成后支持重新生成和正式导出；
- [ ] 旧预览不能覆盖最新配置。

门禁：本地资产、BT 下载资产、Animeko 缓存和已物化产物行为一致。

### G4 缺源与部分版本

- [ ] 缺源时并行准备可用片段；
- [ ] 显示片段、所属集和缺失原因；
- [ ] 支持重新准备、上传、移除；
- [ ] 允许用户明确选择“导出当前可用版”或“补齐素材后再导出”；
- [ ] 快照和导出记录写入完整/部分版本及排除项；
- [ ] 补齐后可以重新生成完整预览。

### G5 默认设置与产品入口

- [ ] 媒体详情只保留一个“制作推荐视频”入口；
- [ ] 默认进入单媒体推荐模板；
- [ ] 当前高光工作台改为高级编辑/素材处理入口；
- [ ] 默认区只展示 Clip、预览、FULL/SAFE、BGM、章节策略、预计时长；
- [ ] 高级设置折叠：入出点、音量、转场、画质、片头片尾细节；
- [ ] 默认无 BGM、MP4/1080P；
- [ ] 超过建议时长只提醒，不自动删片和压缩。

### G6 多输出与专业衔接

- [ ] HTML 在线预览；
- [ ] HTML + 本地媒体资源包下载；
- [ ] 模板录制 MP4/WEBM；
- [ ] 复用 FFmpeg 做素材标准化、封装和最终校验；
- [ ] 后续以 FCPXML/OTIO 作为专业剪辑工程导出候选；
- [ ] 不把专业工程导出作为普通用户默认流程。

### G7 测试与发布验收

- [x] 单媒体视觉原型浏览器打开验证；
- [ ] ScenePlan/模板数据注入测试；
- [ ] 缺源和部分导出状态测试；
- [ ] 真实 FFmpeg 矩阵：有声/无声、横屏/竖屏、FULL/SAFE、章节/片尾；
- [ ] Web 工作台黄金路径；
- [ ] Electron/打包环境黄金路径；
- [ ] Docker Testcontainers 全量测试；
- [ ] 更新 CHANGELOG、README、story、worklog；
- [ ] 达到发布候选后再标记 v0.26 完成。

## 3. 渲染架构

```text
Media / Clip / VideoAsset
        ↓
Recommendation ScenePlan
        ↓
HTML/CSS 模板 → 浏览器预览 / 分享页 / 录制视频
        ↓
FFmpeg → 素材裁剪、标准化、音频处理和最终校验
```

当前已存在的 `HighlightExportService` 可以作为可靠视频输出和高级编辑兜底，但不继续承担主要视觉模板职责。

## 4. 现有代码复用

- `HighlightProject` / `HighlightProjectItem`：单媒体推荐草稿；
- `MaterializationService` / `HighlightSourceService`：本地素材渠道和准备；
- `RecommendService`：媒体资料、标签、封面和 Clip 数据组装；
- `RecommendClipSourceService`：推荐资源包素材准备经验；
- `recommend-clip.html`：BGM、浏览器播放、录制和资源包经验；
- `HighlightStyleCompiler`：场景计划和基础章节能力；
- 现有异步任务、快照、受控目录和删除保护。

## 5. 不做项

- 多轨专业剪辑器；
- 关键帧、复杂调色、专业字幕和高级特效；
- 自动替用户挑高光；
- 自动删减用户勾选内容；
- 默认版权音乐库；
- 任意 URL 下载；
- HLS/DASH 自动下载；
- 立即引入 Remotion、Skia、游戏引擎等新渲染栈；
- 以 Premiere/DaVinci 工程作为普通用户默认输出。

## 6. 当前状态与风险

- v0.26 代码阶段已有高光素材、导出快照、部分预览接口和默认设置基础；
- 单媒体 HTML 视觉原型已生成，浏览器打开无错误，截图为 `docs/design/2026-09-08-v026-single-media-recommend-template-preview.png`；
- 正式业务模板尚未接入 `RecommendService`；
- 当前旧 8080 实例需要重启后才能验收最新后端代码；
- 全量 Maven 测试曾被 Docker Desktop 拉取 Testcontainers Ryuk 镜像的 I/O 错误阻塞；
- 因此当前状态是“原型验证 + 业务底层已具备”，不是 v0.26 发布完成。
