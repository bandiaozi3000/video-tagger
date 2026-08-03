# Video Tagger 番剧三层打标 · Phase 2 实施方案（检索升级）

> **For agentic workers:** 按任务顺序实施，依赖 Phase 1 的三层 schema。任务清单用 `- [ ]` 跟踪。

**Goal:** 三层搜索（维度可选 / 混合）+ 三层向量化，Milvus 结构升级；番剧档案正式成为检索对象。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`

**前置依赖：** Phase 1（schema 三层化）。开工前确认 Milvus collection 组织（规格 §12：组合主键 vs 三 collection）。

## Global Constraints

- 搜索 API 向后兼容：`GET /api/search` 无 `dim` 时默认片段维度（Phase 1 行为不变）。
- 三层向量化共享 Milvus；现有 clip 向量需迁移，迁移过程不阻塞搜索（降级为关键词可用）。
- 打标主链路仍不碰 LLM。

## 2.1 Milvus 结构改造

- [ ] `MilvusVectorStore` 支持实体类型：组合主键 `(entity_type, entity_id)`（如 `A:1` / `E:2` / `C:3`）+ `entity_type` 标量字段（按层过滤），写入 / 查询按类型路由（§12 已定，单 collection 方案）。
- [ ] 现有 clip 向量迁移脚本 / 启动迁移，旧 collection 退役。
- [ ] 冷启动重连 / 降级逻辑沿用（v0.2 Phase 0 成果）。

## 2.2 向量化服务

- [ ] 三层嵌入文本构建：番剧 = `title + aliases + 标签`；集 = `title + 标签`；片段 = `tag + note`。
- [ ] `EmbeddingTaskService` 扩展支持三层实体（PENDING / DONE / FAILED 语义不变）；番剧 / 集标签变更时触发重嵌入。

## 2.3 搜索 API

- [ ] `GET /api/search?q=&dim=anime|episode|clip|mixed`。
- [ ] 各维度内部：关键词（FULLTEXT 或标签 LIKE）+ 向量 ANN + RRF；`mixed` 时跨层融合排序。
- [ ] 搜索结果带 `entityType` 与跳转目标：番剧 → 详情页；集 → 该集时间线；片段 → 原视频跳回（沿用 jump 队列）。

## 2.4 搜索 UI

- [ ] 维度切换控件（番剧 / 集 / 片段 / 混合）。
- [ ] 三类结果卡片形态 + 混合**分栏展示**（番剧 / 集 / 片段各一栏，§12 已定初版形态）。
- [ ] 标签词库补全联动（搜索输入联想）。

## 2.5 测试与验收

- [ ] 测试：三层召回、跨层 RRF、`dim` 参数、向量迁移、降级。
- [ ] 手动验收：搜「热血」命中番剧；搜「神回」命中集；搜「高燃」命中片段；混合模式展示正确；点击各结果跳转正确。

## 验收总纲

全链路手动验收：三层搜索各维度命中正确 → 混合模式融合排序合理 → 番剧 / 集 / 片段三种结果卡片展示与跳转正确 → 旧 clip 向量迁移无丢失 → 语义搜索降级路径仍可用。
