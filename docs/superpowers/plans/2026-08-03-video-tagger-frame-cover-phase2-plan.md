# Video Tagger 帧封面 · Phase 2 实施方案（集/番剧封面）

> **For agentic workers:** 按任务顺序实施，依赖 Phase 1，任务清单用 `- [ ]` 跟踪。

**Goal:** 集封面自选/上传/智能默认 + 番剧封面兜底 + 级联删封面文件。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-frame-cover-design.md`

## Global Constraints

- 封面纯展示，不进向量化/搜索。
- 智能默认 = 被 clip_tag 标记最多的片段帧，平分取最新；只作查询时解析，不落库。

## 2.1 集封面 API 与服务

- [ ] `CoverService`：`saveEpisodeCover(long episodeId, byte[] bytes)` 写 `ep/{epId}-{ts}.jpg` 并清理旧集封面文件；`saveEpisodeCoverFromClip(long episodeId, long clipId)` 读片段封面文件字节拷贝为集封面（片段无封面则报错）。
- [ ] `EpisodeController`：
  - `POST /api/episodes/{id}/cover`（multipart）→ `saveEpisodeCover`。
  - `POST /api/episodes/{id}/cover-from-clip/{clipId}` → `saveEpisodeCoverFromClip`。
- [ ] `EpisodeService` 增 `setCover` / `setCoverFromClip`，更新 `episode.cover_path`。

## 2.2 智能默认解析（查询层）

- [ ] `ClipMapper`：`selectRepresentativeCoverByEpisode(episodeId)`、`selectRepresentativeCoverByAnime(animeId)`——标量子查询 `ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = c.id) DESC, c.created_at DESC LIMIT 1`，过滤 `cover_path IS NOT NULL`。
- [ ] `EpisodeSummary` 加 `coverPath`（SQL 选 `e.cover_path AS coverPath`）；`AnimeService.episodes()` 对 cover_path 为空的集解析代表性片段封面，`EpisodeDetail` 加 `coverPath` 返回**有效值**。
- [ ] 集搜索卡片同样解析（SearchService 构建 EPISODE 结果时补 `coverPath` 有效值）。

## 2.3 番剧封面兜底

- [ ] `AnimeSummary` 加 `fallbackCoverPath`；`listSummaries / listByLatest / listByCollection / listFiltered` 四个查询 SELECT 追加标量子查询 `fallbackCoverPath`。
- [ ] `AnimeService.get`：`AnimeDetail` 加 `fallbackCoverPath`（无则 `selectRepresentativeCoverByAnime`）。
- [ ] 前端番剧卡片/详情取 `coverPath || fallbackCoverPath`。

## 2.4 级联删封面文件

- [ ] `AnimeService.delete`：循环删除每个集与片段的 cover 文件 + 番剧 cover 文件（`deleteCover`）。
- [ ] 合并 `merge`：fromId 的集移入 intoId，其集封面文件保持不变（文件名按集 id，不受影响），无需额外处理。

## 2.5 前端集行封面 + 选封面弹层

- [ ] `renderEpisodeList`：集行加封面缩略图（`ep.coverPath` 有效值），加「封面」按钮。
- [ ] 选封面 modal：网格展示该集片段缩略图（复用 `GET /api/videos/{fp}/clips`，按 videoFp），点选 → `cover-from-clip`；另含上传文件入口 → `POST /api/episodes/{id}/cover`。
- [ ] `app.css`：集行封面、选封面网格样式。
- [ ] 前端时间线/集列表共用 `coverPath || fallbackCoverPath` 取封面逻辑。

## 2.6 验收

- [ ] 番剧详情每集显示封面（自选后为所选帧，未选为被标记最多片段帧）；点选某片段帧设为集封面后刷新即生效。
- [ ] 无 og:image 番剧在卡片墙显示代表性片段帧兜底。
- [ ] 删除番剧后其下所有封面文件清空。
- [ ] 后端测试：`CoverServiceIT`（集封面落盘/自选拷贝/删除）、`AnimeServiceIT`（级联删封面、兜底解析）、集搜索卡片封面解析。
