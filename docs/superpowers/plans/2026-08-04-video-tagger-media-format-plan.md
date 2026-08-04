# Video Tagger 媒体格式细分 · 实施计划（v0.7）

> 日期：2026-08-04
> 设计：`2026-08-04-video-tagger-media-format-design.md`
> 分支：feature/v1。四阶段推进：A 数据层 → B 后端 API → C 前端/扩展 → D 测试文档。

---

## Phase A — Schema + 后端实体改名（数据层）

- [ ] V8 迁移：`anime` 加 `media_format`/`subcategory` 列并回填（type 映射）、表改名 `anime→media`、`anime_tag→media_tag`、`anime_collection→media_collection`、关联列 `anime_id→media_id`、删 `type`、建 `media_format`/`media_subcategory` 表 + 种子、`embedding_tasks` 实体类型 UPDATE。
- [ ] 实体改名：`Anime→Media`（字段 type→mediaFormat/subcategory）、`AnimeTag→MediaTag`、`AnimeCollection→MediaCollection`；新建 `MediaFormat`、`MediaSubcategory`。
- [ ] Mapper 改名：`AnimeMapper→MediaMapper`、`AnimeTagMapper→MediaTagMapper`、`AnimeCollectionMapper→MediaCollectionMapper`；新建 `MediaFormatMapper`、`MediaSubcategoryMapper`。
- [ ] `EntityType.ANIME→MEDIA`；`MilvusVectorStore`/`InMemoryVectorStore` 前缀 "A"→MEDIA 映射（保留 "A"，注释说明）。
- [ ] 波及的 service/controller 编译错误清零（先只保证编译）。

## Phase B — 后端 API + Service

- [ ] `MediaController`（原 AnimeController）：`/api/media` 全端点 + list 增 `format`/`subcategory` 过滤参数。
- [ ] `MediaService`（原 AnimeService）：format/subcategory 校验；子分类归属校验。
- [ ] `MediaFormatController` + Service：`/api/media-formats` 列表、子分类 CRUD、删除保护（被引用拒删）、每子分类媒体数。
- [ ] `ClipService.ensureMedia`：自动建媒体默认 `VIDEO` + TitleParser 探测子分类。
- [ ] `TitleParser` 扩展：URL 域名→格式、标题关键词→子分类（低置信待确认）。
- [ ] `SearchService`：维度名 media，加 `format`/`subcategory` 过滤（关键词路 WHERE + 向量路 post-filter）。
- [ ] `StatsService`：按格式/子分类分布统计。

## Phase C — 前端 + 扩展

- [ ] `index.html`：tab「番剧→媒体」、格式 tab、筛选下拉（格式/子分类/状态/收藏夹/待确认）、新建/编辑弹窗加格式+子分类、管理弹层、搜索加格式/子分类筛选、统计加格式卡片、媒体详情非视频隐藏集列表。
- [ ] `app.js`：全局 `anime→media` 改名（184 处）+ 上述新逻辑（格式联动、内联新建子分类、管理弹层渲染、格式 tab 切换、搜索过滤、统计格式分布）。
- [ ] `app.css`：新元素样式（格式 tab、管理弹层、内联新建等）。
- [ ] 扩展：`SaveClipResult` 字段 `animeId/animeTitle→mediaId/mediaTitle`，content.js/background.js 同步。

## Phase D — 测试 + 文档

- [ ] 测试改名：`AnimeServiceIT→MediaServiceIT` 等 8 文件 + 新增 `MediaFormatServiceTest`/`MediaSubcategoryTest`。
- [ ] 全量测试通过（`mvn test`，约 99+ 用例）。
- [ ] README 架构节、API 清单、CHANGELOG 加 v0.7。
- [ ] 更新项目记忆（改名/格式字典/迁移要点）。

---

## 验收标准

1. `mvn test` 全绿。
2. V8 迁移后旧数据无损：原有番剧全部为 `media_format=VIDEO`、`subcategory=番剧/电影`。
3. Web UI：媒体列表可切格式 tab、按格式/子分类筛选；新建媒体可选格式+子分类并可内联新建；管理弹层可增删改格式与子分类。
4. 搜索可加格式/子分类过滤；图片/文字媒体可被语义搜索命中（向量化）。
5. 扩展打标保存正常，浮层显示「识别到：《标题》」。
