# Video Tagger 双图封面 · 实施方案（缩略图 + 详情大图 + 悬浮预览）

> **For agentic workers:** 按任务顺序实施，任务清单用 `- [ ]` 跟踪。

**Goal:** 片段存两张图（320px 缩略 + 1280px 详情），列表展示缩略图、悬浮展示详情大图、详情页 hero 用大图。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-dual-cover-design.md`

## Global Constraints

- 任一步失败降级，不反噬保存主链路。
- 历史数据无详情图 → 悬浮回退缩略图，不做回填。

## 1 后端

- [ ] `V7__detail_cover.sql`：`ALTER TABLE clips ADD COLUMN detail_cover_path VARCHAR(512) NULL`。
- [ ] `Clip` 实体加 `detailCoverPath`。
- [ ] `CoverService`：`saveClipDetailCover(long clipId, byte[] body)` 写 `clip/{clipId}-xl.jpg`，返回 `/covers/clip/{clipId}-xl.jpg`。
- [ ] `SaveClipRequest` 加 `@Size(max=900_000) String detailCoverDataUrl`（顺带修两个既有便捷构造器的参数量）。
- [ ] `ClipService.save`：缩略 + 详情分别解码落盘并 `updateById` 两列；任一步失败降级。
- [ ] `ClipService.delete` / `AnimeService.delete`：级联删除两张图。
- [ ] `SearchResult` 加 `detailCoverPath`，`toClipResult` 透传。

## 2 扩展

- [ ] `captureFrame` 改 `captureFrames(video)`：一次画两档 → `{ thumb, detail }`（thumb=320px JPEG 0.7、detail=min(videoWidth,1280) JPEG 0.75）。
- [ ] `grab-video` 响应携带 `frameDataUrl` + `detailFrameDataUrl`；浮层保存、快存静默直存、连续模式携带两个 data URL。

## 3 前端

- [ ] `index.html` 加全局 `#vt-hover-preview` 悬浮层。
- [ ] `app.js`：`appendClipCard` 给 `.cc-thumb` 绑定 mouseenter/mouseleave，展示 `r.detailCoverPath || r.coverPath`；无 coverPath 不绑定。
- [ ] 片段详情页 hero 用 `clip.detailCoverPath || clip.coverPath`。
- [ ] `app.css`：悬浮层样式（fixed、圆角、阴影、锚定右侧越界左移）。

## 4 验收

- [ ] 打标保存后列表缩略图、悬浮出详情大图；无详情图片段悬浮回退缩略图。
- [ ] 片段详情页 hero 为详情大图。
- [ ] 删片段后缩略 + 详情两张图文件均消失。
- [ ] 后端测试：`CoverServiceIT` 双图落盘/删除/降级。
