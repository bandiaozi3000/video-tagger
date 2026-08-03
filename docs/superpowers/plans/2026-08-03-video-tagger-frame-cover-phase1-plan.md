# Video Tagger 帧封面 · Phase 1 实施方案（片段封面）

> **For agentic workers:** 按任务顺序实施，任务清单用 `- [ ]` 跟踪。

**Goal:** 片段级帧封面闭环——扩展截帧 → base64 内嵌保存 → 后端落盘 → 前端卡片展示缩略图。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-frame-cover-design.md`

## Global Constraints

- **截帧降级不阻塞保存**：扩展端 `try/catch` 返回 null；服务端解码/落盘失败一律降级为无封面。
- **秒级打标原则**：截帧为异步毫秒级操作，不得插入保存主链路等待。
- 不引前端框架与构建链。

## 1.1 迁移与实体

- [ ] `V6__frame_cover.sql`：`ALTER TABLE episode ADD cover_path VARCHAR(512) NULL`、`ALTER TABLE clips ADD cover_path VARCHAR(512) NULL`。
- [ ] `Episode` / `Clip` 实体加 `coverPath` 字段。

## 1.2 CoverService 重构（分 kind 落盘 + 删除）

- [ ] 落盘目录规划：`{coverDir}/clip/{clipId}.jpg`（稳定文件名，片段封面一经创建不覆盖）、`{coverDir}/ep/{epId}-{ts}.jpg`（版本戳，本期先建能力 Phase 2 用）、番剧维持 `{coverDir}/{animeId}.{ext}`。
- [ ] `String saveClipCover(long clipId, byte[] bytes)`：写 `clip/{clipId}.jpg`，返回 `/covers/clip/{clipId}.jpg`；同名覆盖写。
- [ ] `void deleteCover(String path)`：按 `/covers/**` 相对路径解析并删除文件，**防目录穿越**（只允许 coverDir 内相对路径，拒绝 `..`）。
- [ ] base64 工具：`decodeDataUrl(String)` 支持 `data:image/...;base64,...` 前缀与裸 base64，失败抛非法参数。

## 1.3 保存链路落封面

- [ ] `SaveClipRequest` 加 `@Size(max=300000) String coverDataUrl`。
- [ ] `ClipService.save`：clip 插入拿到 id 后，若 `coverDataUrl` 非空 → 解码 → `saveClipCover` → `clip.setCoverPath` → `updateById`；**解码/落盘异常 try/catch 降级无封面**。
- [ ] `ClipService.delete`：删除时 `coverService.deleteCover(clip.getCoverPath())`（空值跳过）。

## 1.4 扩展截帧

- [ ] `content.js` 新增 `captureFrame(video)`：320px 宽等比 + JPEG 0.7 → base64 data URL；`try/catch` + `videoWidth` 校验，失败返回 null。
- [ ] `grab-video` 消息响应携带 `frameDataUrl`（读 currentTime 的同一瞬间截帧）。
- [ ] 浮层 `save()`：普通模式用 `info.frameDataUrl`；**连续模式每次保存时重新 `captureFrame(video)`**（时间戳同源）。
- [ ] 快存（Ctrl+Shift+1~9 静默直存）携带 `coverDataUrl`。

## 1.5 前端片段卡片缩略图

- [ ] `appendClipCard`：`r.coverPath` 存在时卡片顶部渲染 `<img class="clip-thumb">`；用于搜索 / 时间线 / 相似推荐三处。
- [ ] `app.css`：`.clip-thumb` 16:9 裁切、圆角、失败降级灰底。

## 1.6 验收

- [ ] 扩展保存带截帧：B站/YouTube 页打标，搜索与时间线卡片出现帧缩略图；无 CORS 站点截帧失败降级无图不阻塞保存。
- [ ] 连续打标模式每条截帧随保存落盘。
- [ ] 删片段后 cover 文件消失。
- [ ] 后端测试新增 `CoverServiceIT` / `ClipServiceIT` 覆盖保存落盘与删除清理。
