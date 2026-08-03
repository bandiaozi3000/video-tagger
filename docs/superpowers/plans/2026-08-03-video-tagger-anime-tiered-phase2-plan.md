# Video Tagger 番剧三层打标 · Phase 2 实施方案（检索升级）

> **For agentic workers:** 按任务顺序实施，依赖 Phase 1 的三层 schema。任务清单用 `- [ ]` 跟踪。

**Goal:** 三层搜索（维度可选 / 混合）+ 三层向量化，Milvus 结构升级；番剧档案正式成为检索对象。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`

**前置依赖：** Phase 1（schema 三层化）。Milvus collection 组织已定：单 collection + 组合主键（§12）。

## Global Constraints

- 搜索 API 向后兼容：`GET /api/search` 无 `dim` 时默认 mixed（前端分栏展示）。
- 三层向量化共享 Milvus；无历史数据，直接按新 schema 建 collection。
- 打标主链路仍不碰 LLM。

## 2.1 Milvus 结构改造

- [x] `MilvusVectorStore` 组合主键 `(entity_type, entity_id)`（如 `A:1` / `E:2` / `C:3`）+ `entity_type` 标量字段（按层过滤），写入 / 查询按类型路由（§12 已定，单 collection 方案）。
- [x] `EntityType` 枚举（ANIME / EPISODE / CLIP）；`VectorStore` 接口带类型方法；`InMemoryVectorStore` 同步。
- [x] 冷启动重连 / 降级逻辑沿用（v0.2 Phase 0 成果）。

## 2.2 向量化服务

- [x] 三层嵌入文本构建：番剧 = `title + aliases + 标签`；集 = `title + 标签`；片段 = `tag + note`。
- [x] `embedding_tasks` V4 迁移通用化（`(entity_type, entity_id)` 唯一）；`EmbeddingTaskService` 支持三层（enqueue / process / deleteFor / sweep）。
- [x] 标签变更触发重嵌入：番剧 / 集标签增删、改名、合并、片段编辑均触发对应层重嵌入。

## 2.3 搜索 API

- [x] `GET /api/search?q=&dim=anime|episode|clip|mixed`。
- [x] 各维度内部：关键词（FULLTEXT / LIKE）+ 向量 ANN + RRF；`mixed` 跨层 RRF（`RankKey = type+id`，避免三层 id 冲突）。
- [x] 搜索结果带 `entityType` 与跳转目标：番剧 → 详情页（animeId）；集 → 时间线（videoFp）；片段 → 原视频跳回（沿用 jump 队列）。
- [x] `semanticEnabled` 表示本次查询向量是否生成成功（embed 失败自动降级关键词）。

## 2.4 搜索 UI

- [x] 维度切换控件（混合 / 番剧 / 集 / 片段）。
- [x] 三类结果卡片形态 + 混合**分栏展示**（番剧 / 集 / 片段各一栏，§12 已定初版形态）。
- [x] 标签词库补全联动保留（`/api/tags`）。

## 2.5 测试与验收

- [x] 测试：三层召回、`dim` 参数、跨层 RRF（type+id）、向量类型路由、降级；`SearchServiceTest` / `InMemoryVectorStoreTest` / `EmbeddingTaskServiceTest` 适配新接口。
- [x] 后端 78 → 80 个用例全通过。
- [ ] 手动验收：搜「热血」命中番剧；搜「神回」命中集；搜「高燃」命中片段；混合模式分栏展示正确；点击各结果跳转正确。

## 验收总纲

全链路手动验收：三层搜索各维度命中正确 → 混合模式融合排序合理 → 番剧 / 集 / 片段三种结果卡片展示与跳转正确 → 语义搜索降级路径仍可用。
