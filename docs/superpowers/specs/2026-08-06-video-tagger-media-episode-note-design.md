# Video Tagger 媒体/集层备注 + 搜索全字段高亮设计（v0.8）

> 日期：2026-08-06
> 前置：/grill-me 会话逐项拍板（见「决策记录」）
> 目标：给媒体（media）与集（episode）两级增加**备注**字段并接入检索/向量，让「打标签时的补充说明」能被搜到；搜索结果对命中词做**全字段高亮**，提升检索可读性。
> 版本：升到 **0.8.0**。

---

## 1. 现状与痛点

- 片段级（clips.note）备注已全链路存在：扩展打标弹层输入 → `POST /api/clips` → 关键词检索 + 向量 embedding 均带上 → Web UI 搜索卡片/编辑弹层/片段详情展示。
- **媒体 / 集两级没有备注字段**：
  - `media` 表无 note 列，媒体搜索 SQL 只匹配 title/aliases/作品标签，媒体向量文本不含备注。
  - `episode` 表无 note 列，集搜索 SQL 只匹配 title/集标签，集向量文本不含备注。
  - 集后端**没有更新端点**（只有 GET/DELETE/cover/tags），想改集信息无从下手。
- 搜索结果**不显示命中来源**：媒体/集搜索卡片只显示「匹配分」，备注（即便后续命中）无处展示；片段卡片备注与标签混排，命中词无高亮，用户看不出「为什么命中」。

## 2. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 缺口定位 | **媒体/集层备注**（片段备注已有，不重做） |
| 2 | 搜索形态 | **命中备注要高亮**，且扩展到**全字段高亮**（标题/别名/备注/标签所有可见文本命中词均高亮） |
| 3 | 编辑入口 | **Web UI 编辑**：媒体备注放「新建/编辑媒体」弹层 + 媒体详情页展示；集备注放集详情页头部内联编辑；扩展打标弹层不动 |
| 4 | 素材收集呈现 | **搜索按媒体聚合**（搜话题 → 结果按所属媒体分组，媒体→集→片段结构化浏览） |
| 5 | 时间维度 | **打标时间范围筛选**（搜索加 from/to 参数，按实体 created_at 后置过滤） |
| 6 | 结果角标 | **卡片角标**：格式/子分类/站点小标签（站点由 URL 前端解析 hostname，格式/子分类后端补到结果） |
| 7 | 新字段维度 | **本期不加**使用状态/来源/人物/时长等新字段 |
| 8 | 检索质量优化 | **分两期**：v0.8 只做备注+呈现增强；上下文增强/同义词扩展/MySQL BM25/评测集 归 **v0.9** 单独排期 |

## 3. 数据模型

```
media    + note VARCHAR(2000) NULL   -- 作品备注（观感/待办/为什么收藏等）
episode  + note VARCHAR(2000) NULL   -- 集备注（该集看点/重点等）
```

- 与 `clips.note`（VARCHAR 2000）保持一致的长度与可空语义。
- 旧数据无需回填（NULL 即无备注），前端按空串处理。
- 不建索引：数据量小，`LIKE '%q%'` 全表扫即可（与现 title/aliases 检索同策略）。

## 4. 迁移 V9

```sql
ALTER TABLE media    ADD COLUMN note VARCHAR(2000) NULL AFTER subcategory;
ALTER TABLE episode  ADD COLUMN note VARCHAR(2000) NULL AFTER title;
```

## 5. 后端改造

### 5.1 实体 / 请求

- `Media.java`、`Episode.java` 加 `note` 字段（`@TableName` 自动映射）。
- `MediaRequest`（新建/更新共用）加 `@Size(max=2000) String note`，可空。
- `MediaService.create / update` 落库 note；note 变更时 `embeddingTaskService.enqueue(MEDIA, id)` 触发重嵌。

### 5.2 集更新端点（新增）

- `EpisodeController` 新增 `PUT /api/episodes/{id}`，body 用新 `EpisodeUpdateRequest`（`@Size(max=2000) String note`，可空）。
- `EpisodeService.update(id, req)`：更新 note，变更时 `enqueue(EPISODE, id)`。
- 前端集详情页内联编辑走此端点。

### 5.3 关键词检索

- `MediaMapper.searchByKeyword`：WHERE 增加 `OR a.note LIKE CONCAT('%', #{q}, '%')`。
- `EpisodeMapper.searchByKeyword`：WHERE 增加 `OR e.note LIKE CONCAT('%', #{q}, '%')`。

### 5.4 向量文本

`EmbeddingTaskService.buildText`：

- MEDIA 分支：`join(title, aliases, note, tags)`（note 可空）。
- EPISODE 分支：`join(title, note, tags)`。
- note 变更路径（media update / episode update）需 `enqueue`，否则新备注只进关键词、不进向量。

### 5.5 搜索结果携带 note + 媒体元信息（聚合/角标用）

- `SearchResult` record 新增 4 个可空字段：`mediaTitle`、`mediaFormat`、`subcategory`、`createdAt`。
  - `toMediaResult`：note 传 `a.getNote()`，mediaFormat/subcategory 传媒体自身，createdAt 传 `a.getCreatedAt()`。
  - `toEpisodeResult`：note 传 `ep.getNote()`，mediaFormat/subcategory 解析父媒体，createdAt 传 `ep.getCreatedAt()`。
  - `toClipResult`：note 已有；**mediaId 由 episode 解析补上**（片段结果当前 mediaId=null），mediaTitle/mediaFormat/subcategory 解析父媒体，createdAt 传 `c.getCreatedAt()`。
- **enrich 辅助**：各 search 路径结果组装后统一跑一次「补媒体信息」：CLIP 结果先经 episodeId 批量查 episode 得 mediaId，再批量查 media 得 title/format/subcategory，重建结果。数据量小，批查即可（与 `filterByFormat` 同模式）。

## 6. 前端改造

### 6.1 媒体备注（新建/编辑弹层 + 详情展示）

- `index.html` 媒体弹层加：`<label>备注<textarea id="media-note"></textarea></label>`。
- `app.js`：打开编辑弹层时回填 `media-note`；新建/保存时带上 `note`；媒体详情页 head 下方展示备注（有则显示）。
- `app.css`：textarea 统一样式 + 详情备注样式。

### 6.2 集备注（详情页内联编辑）

- `index.html` 集详情视图头部区加备注容器 `#episode-detail-note`。
- `app.js`：`renderEpisodeDetailHead` 渲染备注（空则显示「添加备注」占位）；点编辑 → 出 textarea + 保存按钮 → `PUT /api/episodes/{id}` 保存 → 刷新展示。
- 备注变更后该集向量异步重嵌（后端 enqueue）。

### 6.3 搜索全字段高亮

- `app.js` 新增 `hl(text, q)`：先 escape，再对每个 `q` 的非空分词做 `indexOf` 命中包裹 `<mark class="hl">`（大小写不敏感），返回 HTML。
- 应用于搜索卡片：
  - 片段卡片：`.card-title`（title）、`.card-tag`（tag · note）改用 `hl()`。
  - 媒体卡片：`.card-title` 用 `hl()`；`.card-tag` 由「媒体 · 匹配分」改为显示 note（有则展示且高亮，无则保留匹配分兜底）。
  - 集卡片：同上。
- 查询词来源：渲染时传入当前搜索关键词（`currentQuery`），无关键词时 `hl` 原样返回。
- `app.css`：`mark.hl { background: rgba(255,77,141,.28); color:#fff; border-radius:3px; padding:0 2px; }`。

### 6.4 搜索按媒体聚合

- 搜索视图加「按媒体聚合」开关（默认开）。开启时结果按 `mediaId` 分组：
  - 每个媒体一个 section：头部 = 封面 + 媒体标题 + 格式/子分类角标 + 命中片段数，点击进媒体详情。
  - 下方该媒体命中的片段卡片（时间线排列）；无 mediaId 的孤儿结果归「未归组」。
- 数据来源：搜索响应每条的 `mediaId/mediaTitle/mediaFormat/subcategory`（见 5.5 enrich），前端纯客户端分组，无额外请求。
- 混合模式（mixed）下聚合开关同样生效（媒体/集/片段统一按所属媒体收拢）。

### 6.5 时间范围筛选

- `GET /api/search` 增可选参数 `from`/`to`（epoch 毫秒），结果按实体 `createdAt` 后置过滤（与 format 后置过滤同层），过滤后再 `limit`。
- 前端搜索工具栏加「时间」下拉：不限 / 近 7 天 / 近 30 天 / 近 90 天 / 自定义（两个 date 输入）。
- 命中结果卡片显示打标时间（`createdAt` → 本地日期短格式）。

### 6.6 结果角标

- 搜索卡片（片段/媒体/集）加小角标：
  - 格式角标（沿用媒体卡片 `fmt-VIDEO/IMAGE/TEXT` 配色）+ 子分类文字（有则显）。
  - 站点角标：由 `r.url` 前端解析 hostname（`bilibili.com`→B站 / `youtube.com`→YouTube / `pixiv.net`→Pixiv…），URL 缺失的媒体/集不显示。
- `app.css`：`.result-badge` 小胶囊样式。

## 7. 兼容性

- 仅新增列/字段/端点，不破坏现有 API；`PUT /api/episodes/{id}` 为新增，无冲突。
- 旧数据 note 为 NULL，前端按空处理；搜索 `note IS NULL` 不匹配 LIKE 不报错。
- 向量旧数据不回嵌；仅当用户编辑备注时该实体重嵌。存量媒体/集的备注为空，不影响。

## 8. 非目标 / 推迟项

**推迟到 v0.9（检索质量）**：上下文增强（父层信息进向量文本）、同义词/查询扩展、MySQL ngram FULLTEXT→BM25、评测集；rerank 视 v0.9 情况再排。
**后续再说**：素材使用状态 / 来源频道 / 人物角色 / 片段时长等新查询字段。
**本轮明确不做**：
- 扩展打标弹层加媒体/集备注输入（Web UI 编辑入口已拍板）。
- 备注编辑历史 / 版本记录。
- 备注命中单独筛选维度（只做全字段高亮，不做「只看备注命中」开关）。
- 富文本 / Markdown 渲染备注（纯文本）。
