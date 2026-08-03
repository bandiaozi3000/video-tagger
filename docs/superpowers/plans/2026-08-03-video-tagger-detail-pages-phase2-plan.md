# Video Tagger 详情页 · Phase 2 实施方案（详情页完整交互）

> **For agentic workers:** 依赖 Phase 1，任务清单用 `- [ ]` 跟踪。

**Goal:** 片段详情 / 集详情全交互，点击行为全局切换到详情页。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-detail-pages-design.md`

## 2.1 片段详情页

- [ ] `renderClipDetail(id)`：并发取 `/api/clips/{id}` + `/api/episodes/{episodeId}` + `/api/anime/{animeId}`；再取同集片段 `/api/videos/{fp}/clips`（排除自身）与相似 `/api/search/similar`。
- [ ] 头部：大图（截帧）+ 标题/时间戳/标签/备注。
- [ ] 集/番剧导航链接：点击进集详情 / 番剧详情。
- [ ] 操作：去原视频（复用 `jump`）/ 编辑（`openEditModal`）/ 删除（`confirmDelete`）/ 相似（滚动到相似区块）。
- [ ] 同集其他片段列表（左缩略图，点进各自详情）+ 相似片段列表。

## 2.2 集详情页

- [ ] `renderEpisodeDetail(id)`：取 `/api/episodes/{id}` + `/api/anime/{animeId}` + `/api/videos/{fp}/clips`。
- [ ] 头部：集封面 + 标题/S1-Ep3 + 片段数 + 最近标记 + 番剧导航链接。
- [ ] 集标签：复用现有详情标签 chip（可删）+ 添加输入框。
- [ ] 操作：打标签（`openEpisodeTagModal`）/ 设封面（`openEpisodeCoverModal`）/ 时间线（`openTimeline`）/ 去原视频（`jump` 到 url 起点）。

## 2.3 点击行为全局切换

- [ ] 片段卡片点击 → `openClipDetail`（搜索/时间线/相似弹窗/集详情内片段/片段详情内同集片段）。
- [ ] 集卡片点击 → `openEpisodeDetail`（搜索结果）。
- [ ] 相似弹窗内点卡片：先入栈关弹窗再进详情，返回能回原视图。
- [ ] 时间线轴标记小圆点保持直接跳转。

## 2.4 编辑/删除刷新

- [ ] `refreshCurrentView` 扩展支持 `clip-detail` / `episode-detail` 的刷新。
- [ ] 详情页编辑/删除/加标签/设封面后刷新当前详情。

## 2.5 验收

- [ ] 搜索点片段卡片 → 片段详情（大图/元信息/导航/同集/相似齐全）；点集卡片 → 集详情。
- [ ] 片段详情点所属集 → 集详情 → 点所属番剧 → 番剧详情，逐层返回正确。
- [ ] 片段详情点同集片段 → 新片段详情，返回回到原片段。
- [ ] 相似弹窗内进详情后返回正常。
- [ ] 详情页内编辑/删除/加标签/设封面后视图即时刷新。
- [ ] 后端测试：`ClipController`/`EpisodeController` 新端点（或 Service 层 `get`/`detail`）。
