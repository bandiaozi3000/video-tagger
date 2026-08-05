# Video Tagger v0.8 媒体/集层备注 + 搜索全字段高亮 实施计划

> 日期：2026-08-06
> 设计：`docs/superpowers/specs/2026-08-06-video-tagger-media-episode-note-design.md`
> 前置：设计已 grilling 拍板，直接开工。

## P1 后端（先做，可独立验证）

| 步骤 | 改动 | 验证 |
|---|---|---|
| P1.1 | `V9__media_episode_note.sql`：media/episode 加 `note VARCHAR(2000) NULL` | Flyway 迁移通过 |
| P1.2 | `Media.java` / `Episode.java` 加 `note` 字段 | 编译 |
| P1.3 | `MediaRequest` 加 note；`MediaService.create/update` 落库 + note 变更 `enqueue(MEDIA)` | 单测 |
| P1.4 | 新增 `EpisodeUpdateRequest` + `EpisodeController.PUT /api/episodes/{id}` + `EpisodeService.update`（更新 note + `enqueue(EPISODE)`） | 单测 |
| P1.5 | `MediaMapper.searchByKeyword` / `EpisodeMapper.searchByKeyword` SQL 加 `note LIKE` | 单测 |
| P1.6 | `EmbeddingTaskService.buildText`：MEDIA/EPISODE 分支拼 note | 单测 |
| P1.7 | `SearchResult` 加 `mediaTitle/mediaFormat/subcategory/createdAt`；enrich 补 clip 的 mediaId + 各结果媒体元信息 + createdAt | 单测 |
| P1.8 | `/api/search` 加 `from`/`to` 时间范围参数（created_at 后置过滤，先于 limit） | 单测 |

## P2 前端（依赖 P1 接口）

| 步骤 | 改动 | 验证 |
|---|---|---|
| P2.1 | 媒体弹层加备注 textarea；新建/编辑带 note；媒体详情页展示 note | 浏览器目测 |
| P2.2 | 集详情页头部备注内联编辑（展示/编辑/保存走 PUT） | 浏览器目测 |
| P2.3 | `hl(text, q)` 辅助 + 搜索卡片 title/tag/note 全字段高亮；媒体/集卡片补显 note | 浏览器目测 |
| P2.4 | 搜索「按媒体聚合」开关 + 按 mediaId 分组渲染（含格式角标/计数/进详情） | 浏览器目测 |
| P2.5 | 搜索时间范围筛选（不限/近7/30/90天/自定义）+ 卡片显示打标时间 | 浏览器目测 |
| P2.6 | 搜索卡片格式/子分类/站点角标（站点前端解析 hostname） | 浏览器目测 |
| P2.7 | `app.css`：textarea / `mark.hl` / `.result-badge` / 聚合分组 / 详情备注样式 | 浏览器目测 |

## P3 收尾

| 步骤 | 改动 | 验证 |
|---|---|---|
| P3.1 | `mvn -f backend/pom.xml test` 全量单测通过 | 测试 |
| P3.2 | pom 0.7.0→0.8.0；CHANGELOG 追加 0.8.0；README 功能/架构更新 | diff 复核 |
| P3.3 | 静态资源复制 `target/classes/static`；worklog 记录当日 | 起服务目测 |

> 验收提示：`docker compose build app` 重建镜像（compose up 不重建）；浏览器强刷 Ctrl+F5 绕过 app.js 缓存。
