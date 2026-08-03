# Video Tagger 详情页 · Phase 1 实施方案（列表改版 + 地基）

> **For agentic workers:** 按任务顺序实施，任务清单用 `- [ ]` 跟踪。

**Goal:** 片段卡片左缩略图横排 + 两个 GET 端点 + 两个详情视图骨架 + 视图历史栈。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-detail-pages-design.md`

## Global Constraints

- 不引前端框架与构建链。
- 点击行为变更保持向后可用：进详情页前确认所有片段卡片统一入口。

## 1.1 后端端点

- [ ] `GET /api/clips/{id}`：`ClipService.get(id)`（selectById，不存在抛 NoSuchElement）。
- [ ] `GET /api/episodes/{id}`：`EpisodeService.detail(id)` 构建 EpisodeDetail（解析封面 + 集标签 + clipCount/latestAt + videoFp）；注入 `ClipMapper`。

## 1.2 列表左缩略图

- [ ] `appendClipCard` 改横排：`.cc-thumb`（128px 16:9）+ `.cc-body`（标题/时间/标签/操作）；无封面省略缩略图槽位。
- [ ] `app.css`：`.card-clip` flex 布局 + 移动端不塌。
- [ ] 卡片点击 → `openClipDetail(r)`（Phase 2 接详情渲染；Phase 1 先留桩跳原视频保可用）。

## 1.3 两个视图骨架 + 视图历史栈

- [ ] `index.html` 加 `view-episode-detail`、`view-clip-detail` 骨架（head + actions + 区块容器 + back 按钮）。
- [ ] `app.js`：`viewHistory` 栈 + `pushView`/`goBack` + `restoreView` 分发（search/anime/timeline/anime-detail/episode-detail/clip-detail）。
- [ ] 新视图 back 按钮接 `goBack`；`showView` 注册两个新视图到 `views` map。

## 1.4 验收

- [ ] 片段卡片全站横排左缩略图；无封面卡片布局正常。
- [ ] `GET /api/clips/{id}`、`GET /api/episodes/{id}` 返回正确。
- [ ] 进入两个详情视图骨架能正常渲染与返回。
