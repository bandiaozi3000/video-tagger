# Video Tagger 番剧三层打标 · Phase 1 实施方案（地基 + 番剧档案）

> **For agentic workers:** 按任务顺序实施，Phase 1 为全项目地基，不可跨期并行提交。任务清单用 `- [ ]` 跟踪。

**Goal:** 完成三层 schema 重构与历史数据迁移，产出可用的"番剧网站"形态——番剧列表 / 详情页、状态 / 评分 / 封面、最近观看；扩展打标链路接入番剧归属（浮层小字确认）。此期**不引入三层搜索**（Phase 2）。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`

**前置依赖：** 无（本期即地基）。开工前核查历史数据量（规格 §12）。

## Global Constraints

- 保持初版约束：包根 `com.videotagger`；端口 8080；不引前端框架与构建链；提交格式 `type: 中文描述`。
- **密钥管理**：真实 API key 只存在于 `.env`；后端绑定 `127.0.0.1`。
- **打标主链路不碰 LLM**：保存时仅前缀 + 正则识别；LLM 后台归组属 Phase 3。
- **schema 迁移**：三层结构走 Flyway `V3__*` 起；历史数据回填用一次性脚本或启动回填。
- **标签语义**：无则建、有则关联；同名标签跨层共享词条。
- **封面**：扩展携带 `og:image`；后端异步下载落盘；不上 minio。

## 1.1 数据模型与迁移

- [x] Flyway `V3__anime_tiered.sql`：新建 `anime / episode / tag / anime_tag / episode_tag / clip_tag`；`clips` 新增 `episode_id`（保留 `title / url / tag` 作 Phase 1 过渡兼容）。
- [x] 历史数据：无历史数据需迁移（§12 已确认），V3 干净建表即可；`TitleParser` 就绪以便后续如有数据再补回填。
- [x] 新增 `TitleParser` 工具：正则提取番剧名前缀 / 季 / 集号；`VideoFingerprint` 保持不动。

## 1.2 后端 API

- [x] 番剧 CRUD：`POST /api/anime`、`GET /api/anime/{id}`、`PUT /api/anime/{id}`、`DELETE /api/anime/{id}`（级联删除集/片段/标签/向量）。
- [x] 番剧改名 / 合并：`POST /api/anime/{id}/rename`、`POST /api/anime/{id}/merge?into={targetId}`（集归属迁移 + 标签合并去重）。
- [x] 集列表：`GET /api/anime/{id}/episodes`（带集级标签与片段统计）。
- [x] 标签补全：`GET /api/tags`（沿用现接口语义）。
- [x] 封面：`POST /api/anime/{id}/cover`（multipart）+ `POST /api/anime/{id}/cover-url`；`CoverService` 异步下载落盘 + `/covers/**` 静态映射。
- [x] 最近观看：`GET /api/anime/recent`（按最新标记时间聚合）。
- [x] 保存链路改造：`POST /api/clips` —— 按 `video_fp` 查/建 `episode` → 标题前缀查/建 `anime` → 写 `clip_tag` 关联；接收 `ogImage` 触发封面异步下载；响应携带 `{animeId, animeTitle, episodeNo}`。

## 1.3 浏览器扩展

- [x] 保存请求携带 `og:image`（读 `meta[property="og:image"]`）。
- [x] 浮层小字：保存响应后显示「识别到：番剧 · 第X集」（A 做轻，不阻塞保存，稍作停留）。
- [x] 静默直存路径同步携带 og:image 并显示归属。

## 1.4 Web UI

- [x] 导航新增「番剧」页：卡片墙（封面 + 标题 + 状态徽章 + 评分 + 待确认标记），最近观看 / 全部番剧切换。
- [x] 番剧详情页：头部（封面/标题/状态/评分）、作品标签管理（添加/删除）、集列表（集号/标题/片段数/集级标签 + 打标签 + 时间线入口）。
- [x] 集级打标：集详情「打标签」对话框（Web UI 手动，Phase 1 形态）。
- [x] 手动创建/编辑番剧对话框；改名/合并对话框；封面设置对话框（URL / 文件上传）；删除确认。
- [x] 最近观看 tab。

## 1.5 测试与验收

- [x] 单元 / 集成：`TitleParserTest`（10 用例）、`AnimeServiceIT`（6 用例：自动建番剧/集、复用、CRUD、标签、合并、级联删除）、`ClipServiceSuggestTest` 适配新构造器。
- [x] 后端 60 → 78 个用例全通过（Testcontainers MySQL 跑通 V3 迁移）。
- [ ] 手动验收：冷启动 → 看片打标（浮层显示番剧 · 集归属）→ 番剧卡片墙出现 → 详情页时间线 / 集列表 → 手动创建 / 改名 / 合并番剧 → 状态 / 评分 / 封面生效 → 最近观看聚合正确。

## 验收总纲

全链路手动验收：冷启动 → 看片打标（浮层显示番剧 · 集归属）→ 番剧卡片墙出现 → 详情页时间线 / 集列表 → 手动创建 / 改名 / 合并番剧 → 状态 / 评分 / 封面生效 → 最近观看聚合正确。
