# v0.21 推荐导出插入真实片段 实施计划

- **日期**：2026-08-25
- **版本**：v0.21.0
- **状态**：待开工
- **设计文档**：`docs/superpowers/specs/2026-08-25-video-tagger-v021-recommend-clip-design.md`
- **主计划约定**：本文件是 v0.21 的唯一实施计划。后续同版本范围、设计、实际文件、验收和变更均直接更新本文件，不另建漂移子计划。

## 1. 实施原则

1. v0.21 是推荐导出（v0.12+）的增强，不重写/删除现有 HTML 单文件导出与视频渲染链路；无片段时行为完全不变。
2. 真实片段素材复用 v0.19 `ClipExportService` 本地裁剪 + v0.20 素材/产物保护经验，不重复造轮子。
3. 片段视频不进 base64、不放入高光混剪式 ffmpeg 重拼接；本版 HTML 直放相对路径 + 录屏直录。
4. 素材必须在导出前 READY：缺失/非法片段导出前拦截，禁止静默漏片。
5. 受控路径、ProcessBuilder 参数数组、临时产物成功后替换、明确错误反馈为硬约束（沿用 v0.19/v0.20）。
6. 所有 UI 遵守现有深色霓虹、毛玻璃、16:9 宽屏弹窗、toast/confirm 规范。
7. 片段选择存进推荐草稿 + 模板（config JSON `mediaClips`），随 `collectRecommendConfig/applyRecommendConfig` 收放。

## 2. Phase 0：现状核对与边界（进行中）

- [ ] 核对 `ClipExportService` 对 `end_sec` 为空时的裁剪行为（spec §2 拍板为「播到源视频自然结束」，需与现状对齐/微调）；
- [ ] 核对 `render.js` puppeteer 启动参数是否含 `--autoplay-policy=no-user-gesture-required`（video 自动播放必需）；
- [ ] 核对 `POST /api/recommend/html` 现返回单文件的方式，确定 zip 化改造点；
- [ ] 确认 v0.21 版本号（用户拍板）并建立本 plan 变更记录基线。

## 3. Phase 1：后端数据链路

### 3.1 片段素材准备服务

新增 `RecommendClipSourceService`：
- `validate(mediaClips)`：逐片段校验 `videoFp` 可解析源视频（`LocalVideoResolver`）、时间合法；返回缺失/非法列表。
- `prepare(mediaClips, workDir)`：逐片段调用本地裁剪产出 `media/clip-<id>.mp4`（同任务去重）；产物隔离在任务目录。

### 3.2 buildHtml 注入

- `RecommendService` 新增可选 `mediaClips` 参数；`SLIDES` 每媒体注入 `clips` 数组（clipId/title/note/startSec/endSec/角标）。
- 片段标题/备注/角标自定义文本注入前转义（JS/HTML 双保险）。

### 3.3 接口

- 新增 `POST /api/recommend/prepare-clips`：批量准备 + 校验，返回缺失列表或素材清单（clipId → `media/clip-<id>.mp4`）。
- `POST /api/recommend/html`：入参加 `mediaClips`；响应改为 zip 流（HTML + media/）。
- `POST /api/recommend/video`：入参加 `mediaClips`。

**测试**：`RecommendClipSourceServiceTest`（校验/去重/产物隔离）、`RecommendService` 注入单测。

## 4. Phase 2：HTML 模板 + 小窗连播 + 角标

- 三个模板（stream/chapter/overview）媒体卡新增片段小窗容器 + 角标层；无片段媒体保持现状。
- 小窗：`<video src="media/clip-<id>.mp4" muted autoplay playsinline loop>` 连续播放该媒体片段，播完循环或顺序切片。
- 角标渲染：勾选组合 + 自定义占位符（`{media}`/`{clip}`/`{i}`）。
- zip 打包：后端把 HTML + media/ 压成 zip 返回。

**测试**：模板渲染含/不含片段两分支、zip 结构与内容、角标占位符替换。

## 5. Phase 3：前端片段管理

- 推荐向导媒体卡「选片段」入口 + 片段管理弹窗（16:9 毛玻璃，左全部/右已选、拖拽排序、角标设置、待补时长标记）。
- `collectRecommendConfig()`/`applyRecommendConfig()` 收放 `mediaClips`；草稿自动保存/恢复、模板另存/载入沿用现有机制。
- 预览：HTML 预览前调 `prepare-clips` 准备素材，缺失显示占位提示。

**测试**：前端 Node 语法检查；cache-bust 更新。

## 6. Phase 4：MP4 版录屏直录

- `POST /api/recommend/video` 链路：prepare-clips → buildHtml（片段区 `<video>` 引用 media/ 相对路径）→ render.js 录屏直录 → BGM 混流。
- 确认/补齐 render.js puppeteer autoplay 参数；片段工作区与 render.js 相对路径可达。

**测试**：真实短视频验证成片含片段画面 + BGM；无片段媒体段落不变。

## 7. Phase 5：测试与验收门禁

1. 离线 Maven compile 与指定服务单测；不混跑 Testcontainers IT。
2. 真实短视频验证：HTML 小窗连播 + 角标 + zip；MP4 含真实片段；素材缺失拦截。
3. 回归 v0.12+：无片段推荐导出（HTML zip、视频）行为兼容；v0.19 片段导出、v0.20 高光不受影响。
4. 同步主 spec、本 plan、worklog、CHANGELOG、story、项目记忆正文/frontmatter/MEMORY.md。

## 8. 预计文件范围

```text
backend/src/main/java/com/videotagger/service/RecommendClipSourceService.java   (新)
backend/src/main/java/com/videotagger/controller/RecommendController.java        (改)
backend/src/main/java/com/videotagger/service/RecommendService.java             (改)
backend/src/main/java/com/videotagger/service/RecommendVideoService.java        (改)
backend/src/main/resources/templates/recommend-{stream,chapter,overview}.html   (改)
backend/src/main/resources/static/{index.html,app.js,app.css}                   (改)
backend/scripts/render.js                                                       (改, autoplay 参数)
backend/src/test/java/com/videotagger/service/RecommendClipSourceServiceTest.java (新)
docs/superpowers/specs/2026-08-25-video-tagger-v021-recommend-clip-design.md   (主 spec)
docs/superpowers/plans/2026-08-25-video-tagger-v021-recommend-clip-plan.md     (本文件)
docs/worklog/2026-08-25.md
CHANGELOG.md
docs/story.md
memory/video-tagger-v021-recommend-clip.md
memory/MEMORY.md
```

## 9. UI 审阅原型（2026-08-25）

- `docs/design/2026-08-25-v021-recommend-clip-preview.html`：最终推荐 HTML 的独立视觉原型（非业务实现），覆盖媒体封面叙事、卡内片段小窗连播、角标、播放顺序、无片段回退与底部导览。
- 用户审阅并确认视觉方案后，收敛为独立 `recommend-clip.html`；章节式模板保持独立，不把原型直接拷贝覆盖章节模板。

## 10. 实施进度（2026-08-25）

- [x] Phase 0：核对无 `end_sec` 片段自然结束语义、render.js autoplay 参数；补 SQLite v04 重复列幂等迁移。
- [x] Phase 1：`RecommendMediaClips` 配置模型、素材校验/裁剪工作区、`/prepare-clips`、`/preview`、HTML zip/视频任务透传。
- [x] Phase 2：新增独立 `recommend-clip.html`，完成开篇观前速览、前言、媒体/Clip 放映、无片段静态回退、结尾总览；章节式模板保持独立。
- [x] Phase 3：推荐卡/列表“选片段”入口、16:9 编排弹窗、候选/拖拽排序/角标、自定义占位符、草稿/模板持久化；模板选择改为章节式/片段放映式。
- [ ] Phase 4：真实用户片段素材的 MP4/WEBM 端到端导出与浏览器/Electron 人工验收。
- [x] Phase 5：离线编译、推荐/Clip/SQLite 定向测试、Node 语法、diff 检查；控制器测试已补 mapper 隔离并通过。

**当前限制：**本机验收库没有可用媒体/本地视频素材，因此尚未实际点击带片段卡片、生成真实 HTML zip 或录制 MP4；需使用真实 Clip 素材继续验收。

## 11. 变更记录

| 日期 | 状态 | 变更 |
|---|---|---|
| 2026-08-25 | 计划建立 | 基于 grill 定稿 spec 建立本实施计划（Phase 0-5）。 |
| 2026-08-25 | 拍板 | 用户确认升 v0.21、暂缓开工；Phase 0 待办：核对 ClipExportService end_sec 空行为 + render.js autoplay 参数。 |
