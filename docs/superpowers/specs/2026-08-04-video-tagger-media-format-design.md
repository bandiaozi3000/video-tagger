# Video Tagger 媒体格式细分设计（v0.7）

> 日期：2026-08-04
> 前置：/grill-me 会话逐项拍板（见「决策记录」）
> 目标：把番剧为中心的系统泛化为「媒体」：**媒体 → 媒体格式（视频/图片/文字）→ 子分类（番剧/电视剧/美剧…）**，附快速维护功能，并做检索/向量/统计增强。
> 版本：升到 **0.7.0**。

---

## 1. 现状与痛点

- UI 右上角只有「番剧」一个根入口，`anime.type` 仅 `ANIME / MOVIE` 两档。
- 整个体系（表/类/接口/前端/向量/测试）都叫 anime，术语与「媒体」定位不符。
- 图片、文字等非视频内容无法入库：schema 是「番剧→集→片段」的视频专用结构。
- 分类维度只有类型，无法表达「电视剧 / 美剧 / 纪录片」「插画 / 壁纸 / 摄影」等细分。

## 2. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 根实体改名 | **全面改名 anime→media**（表/类/接口/前端/向量全链路） |
| 2 | 非视频粒度 | **单层媒体**：图片/文字无「集/片段」，仅 VIDEO 格式有 |
| 3 | 子分类体系 | **独立维护字典**：`media_subcategory` 表，与自由标签词库并行 |
| 4 | 检索向量 | **格式筛选 + 全向量化**：搜索加格式/子分类过滤；非视频媒体也入语义检索 |
| 5 | 格式字典 | **格式也可维护**：`media_format` 表，格式带「是否有子级」标记 |
| 6 | 电影归属 | **电影 = 视频子分类**；旧 type 迁移：ANIME→番剧、MOVIE→电影 |
| 7 | 维护入口 | **下拉内联新建 + 列表弹层管理** 双入口 |
| 8 | 优化打包 | 格式 tab 导航 + 按格式统计 + 标题/URL 自动识别格式 |

## 3. 数据模型

### 3.1 字典表

```
media_format        id / code(VIDEO|IMAGE|TEXT…) / name / has_children(0|1) / sort / created_at
                    UNIQUE(code)
media_subcategory   id / format_id / name / sort / created_at
                    UNIQUE(format_id, name)
```

- `has_children`：仅 VIDEO=1，表示该格式下才有 episode/clip 子层。
- 种子数据：
  - VIDEO（has_children=1）：番剧 / 电影 / 电视剧 / 美剧 / 纪录片
  - IMAGE（has_children=0）：插画 / 壁纸 / 摄影
  - TEXT（has_children=0）：小说 / 轻小说 / 文章

### 3.2 主表（改名 + 扩展）

```
media (原 anime)
    id / title / aliases / media_format VARCHAR(16) NOT NULL DEFAULT 'VIDEO'
    subcategory VARCHAR(32) NULL / status / rating / cover_path / confirmed / created_at
    -- 删 type 列（被 subcategory 取代）

episode: anime_id → media_id（列改名；仅 VIDEO 格式有行）
media_tag (原 anime_tag): anime_id → media_id
media_collection (原 anime_collection): anime_id → media_id
clip / tag / episode_tag / clip_tag / collection：不变
embedding_tasks.entity_type：'ANIME' → 'MEDIA'（存量行 UPDATE）
```

- `status`（WANT/WATCHING/DONE/PAUSED/DROPPED）全格式共用，语义泛化为「收集/观看进度」。
- `subcategory` 可空 = 「未分类」，筛选中可选「未分类」。

### 3.3 向量层

- 保留 Milvus collection `clip_embeddings_v2`；`EntityType` 枚举 `ANIME→MEDIA`。
- 实体前缀 **保留 "A"** 并映射 `MEDIA`（注释说明），避免迁移 Milvus 内已有 `A:5` 等数据。
- 非视频媒体只需 media 级向量（复用现有 EmbeddingTaskService 机制），不产生 episode/clip。

## 4. 迁移 V8

```sql
-- 1) 加列并回填
ALTER TABLE anime ADD COLUMN media_format VARCHAR(16) NOT NULL DEFAULT 'VIDEO' AFTER aliases,
                  ADD COLUMN subcategory  VARCHAR(32) NULL AFTER media_format;
UPDATE anime SET subcategory = IF(type='MOVIE', '电影', '番剧');
-- 2) 表改名
RENAME TABLE anime TO media, anime_tag TO media_tag, anime_collection TO media_collection;
-- 3) 关联列改名
ALTER TABLE episode          CHANGE anime_id media_id BIGINT NOT NULL;
ALTER TABLE media_tag        CHANGE anime_id media_id BIGINT NOT NULL;
ALTER TABLE media_collection CHANGE anime_id media_id BIGINT NOT NULL;
-- 4) 删旧 type 列
ALTER TABLE media DROP COLUMN type;
-- 5) 建字典表 + 种子
CREATE TABLE media_format / media_subcategory（略，见 spec 3.1）；INSERT 种子；
-- 6) 向量任务实体类型迁移
UPDATE embedding_tasks SET entity_type='MEDIA' WHERE entity_type='ANIME';
```

## 5. 后端改造

- **实体**：`Media`(原 Anime，字段 type→mediaFormat/subcategory)、`MediaFormat`、`MediaSubcategory`、`MediaTag`、`MediaCollection`。
- **Mapper**：`MediaMapper` / `MediaFormatMapper` / `MediaSubcategoryMapper` / `MediaTagMapper` / `MediaCollectionMapper`。
- **Controller**：
  - `MediaController` `/api/media`：原 anime 全部端点（CRUD / rename / merge / confirm / cover / recent / episodes），list 增 `format`、`subcategory` 过滤参数。
  - `MediaFormatController` `/api/media-formats`：列表 + 每格式子分类 CRUD；删除保护——格式/子分类被引用时拒绝删除（提示先清引用）。
- **Service**：
  - `MediaService`（原 AnimeService）：新增 format/subcategory 校验（格式必须存在、子分类必须属于所选格式）。
  - `ClipService.ensureMedia`：自动建媒体默认 `VIDEO` + 由 TitleParser 探测子分类。
  - `TitleParser` 扩展：URL 域名 → 格式（bilibili/ytb→VIDEO、pixiv/artstation→IMAGE…）；标题关键词 → 子分类（「第X集/第X话」→番剧等），命中低置信走 confirmed=0。
  - `SearchService`：维度 `mixed|media|episode|clip`；搜索参数加 `format`、`subcategory` 过滤（MySQL 关键词路 WHERE 过滤；向量路 post-filter 命中媒体的格式/子分类）。
  - `StatsService`：新增按格式、按子分类分布统计。
- **检索/向量细节**：媒体级向量 = media 实体 embedding（含图片/文字）；向量命中后 join 回 DB 按 format/subcategory 过滤（数据量小，post-filter 足够，不给 Milvus 加标量字段）。

## 6. 前端改造

- 导航 tab「番剧」→「媒体」。
- 媒体列表：顶部**格式 tab**（全部/视频/图片/文字）+ 筛选下拉（格式/子分类/状态/收藏夹/待确认），子分类下拉随格式联动。
- 新建/编辑媒体弹窗：格式 + 子分类下拉（子分类随格式加载，带「＋ 新建」内联快速添加）。
- **管理弹层**：媒体列表工具栏「管理格式」按钮 → 左侧格式列表 + 右侧该格式子分类 CRUD，每子分类显示媒体数。
- 搜索视图：加格式/子分类筛选下拉。
- 统计视图：加「按格式分布」卡片。
- 媒体详情：非 VIDEO 格式隐藏「集列表」，仅展示标签/收藏夹/封面。
- 扩展：`SaveClipResult` 字段 `animeId/animeTitle` → `mediaId/mediaTitle`，content.js 同步（CSS 类名 `anime-hint` 可保留或改）。

## 7. 兼容性

- 扩展主流程 API（`/api/clips`、`/api/episodes/**`、`/api/tags`、`/api/jump/**`）不变，改名不破坏。
- `/api/anime*` → `/api/media*`；旧数据经 V8 迁移无损。
- 向量前缀 "A" 保留，Milvus 数据无需迁移。

## 8. 优化项（本次一并做）

1. **格式 tab 导航**：媒体列表一键切视频/图片/文字。
2. **按格式统计**：统计视图分布卡片 + 管理弹层内每子分类媒体数。
3. **标题/URL 自动识别格式与子分类**：存标签/新建时按域名与标题关键词预填，减少手工（低置信仍待确认）。

## 9. 非目标（本轮不做）

- 图片/文字的「集/片段」子层（单层）。
- 搜索按格式的向量级硬过滤（post-filter 足够）。
- 格式的可配置「是否有子级」运行时切换（种子固定，代码按 has_children 渲染）。
