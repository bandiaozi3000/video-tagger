# Video Tagger 番剧同步（AniList）设计（v0.14）

> 日期：2026-08-07
> 前置：用户提出「把网页各年份番剧名称+封面同步进库」，grilling 后确定数据源 AniList
> 目标：媒体（media）增加**首播年份**与**原标题**字段；「媒体」tab 提供**按年份勾选**的批量导入入口，从 AniList 拉取指定年份的番剧（名称/日期/封面）建媒体档案，命中库中已有则跳过。
> 版本：升到 **0.14.0**。

---

## 1. 现状与痛点

- 用户有把**整年份番剧清单**收进库的需求（原贴 omofuna 列表页，想按年份批量建媒体）。
- 数据源可行性已实测：
  - **omofuna**（盗版站）：有 JS 反爬验证页 + 为播放服务，不采。
  - **Bangumi**（bgm.tv）：墙内 DNS 正常但 TCP 全超时，不可达。
  - **MyAnimeList 官方**：403 需 OAuth Key，不采。
  - **jikan.moe**（MAL 非官方代理）：偶发 504/限流，不稳。
  - **AniList**（graphql.anilist.co）：✅ 免认证、GraphQL 按 `seasonYear` 查询、每年收录数百~上千部、`startDate` 精确到天、`coverImage` 大/中/小三档、封面 CDN（s4.anilist.co）可达。**唯一稳定可选**。
- `media` 表当前**没有年份/原标题字段**（V8 泛化后列：title/aliases/media_format/subcategory/subcategory_id/note/status/rating/cover_path/confirmed/created_at），无从表达「这是哪年的番」。

## 2. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 数据源 | **AniList**（免认证、按年份查、封面 CDN 可达；无中文译名） |
| 2 | 原标题存储 | 新增 `original_title` 列存 **AniList 日文原名**；`title` 初始也填原名**占位，用户可后续编辑成中文** |
| 3 | 日期元素 | **首播年份**（`year` INT），不做精确日期（老番只有年份，精确日会大量留空） |
| 4 | 同步范围 | **前端按年份勾选**（2000~2026 多选），勾了哪年导哪年 |
| 5 | 重复处理 | **跳过不重复建**：title 或 original_title 任一命中库中已有即跳过 |
| 6 | 同步内容 | 只同步**名称 / 年份 / 封面**三样，不碰标签/剧情/评分/集（后续再说） |

## 3. 数据模型

```
media + year           INT NULL          -- 首播年份（AniList startDate.year）
media + original_title VARCHAR(512) NULL -- AniList 日文原名（原生标题）
```

- `year` 为空 = 未知首播年（老番/数据缺失），前端不显示年份即可。
- `original_title` 用于去重匹配 + 展示「原名」；`title` 为展示名/中文名，用户可改。
- 不建索引：数据量小，去重按 title/original_title 逐条比对即可。

## 4. 迁移 V11

```sql
-- V11：番剧同步（AniList）——首播年份 + 原标题
ALTER TABLE media ADD COLUMN year INT NULL AFTER title;
ALTER TABLE media ADD COLUMN original_title VARCHAR(512) NULL AFTER year;
```

## 5. 后端改造

### 5.1 实体 / 请求 / 映射

- `Media.java` 加 `Integer year`、`String originalTitle`（`@TableName` 自动映射）。
- `MediaRequest`（新建/更新）加 `@Size(max=512) String originalTitle`、`Integer year`，均可空。
- `MediaService.apply()` 映射两字段；`create`/`update` 天然落库。
- `MediaDetail` 加 `year`/`originalTitle`；`MediaSummary` 加 `year`（列表卡片展示用，不加 originalTitle 省带宽）。
- `MediaMapper` 各手写列清单（`listSummaries`/`listByLatest`/`listByCollection`/`listFiltered`/`searchByKeyword`）补 `a.year`。

### 5.2 去重查询

- `MediaMapper` 加：
  ```java
  @Select("SELECT * FROM media WHERE title = #{title} OR original_title = #{title} LIMIT 1")
  Media selectByTitleOrOriginal(@Param("title") String title);
  ```
  同步时用 native 原名查，命中即跳过。

### 5.3 AniList 同步服务（新增）

新 `service/AniListSyncService.java`：

- **GraphQL 按年拉取**：`POST https://graphql.anilist.co`，query 带 `$year/$page/$perPage`，字段取
  `id, title{romaji native english}, startDate{year}, coverImage{large}, format`；
  按 `seasonYear = year, type: ANIME, isAdult: false` 过滤，`perPage=50` 循环翻页到 `hasNextPage=false`。
- **限流**：每页请求间隔 ~200ms（AniList 限流宽松，但避免千部连续请求被 429）。
- **逐条入库**：
  - 去重：`selectByTitleOrOriginal(native)` 命中 → `skipped++`。
  - 新建：`title = native`（占位，后续编辑中文）、`originalTitle = native`、`year = startDate.year`、
    `mediaFormat=VIDEO`、`status=WANT`、`confirmed=1`、`createdAt=now`，insert。
  - 封面：insert 拿到 id 后 `coverService.downloadAsync(id, coverImage.large)`（复用现有 @Async coverExecutor，失败静默降级无封面）。
  - `added++`。
- **返回**：`record SyncResult(int added, int skipped)`。
- **HttpClient**：`java.net.http`（与 CoverService 同风格），User-Agent 自定义 `video-tagger-sync/0.14`；响应 JSON 用 Jackson `ObjectMapper` 解析（项目已带）。

### 5.4 同步端点（新增）

`MediaController` 加：

```java
@PostMapping("/sync-anilist")
public SyncResult syncAnilist(@RequestBody Map<String, List<Integer>> body) {
    List<Integer> years = body.getOrDefault("years", List.of());
    if (years.isEmpty()) throw new IllegalArgumentException("请至少勾选一个年份");
    return aniListSyncService.sync(years);
}
```

- 校验年份范围（2000~2026），非法值抛 400。
- 同步是同步阻塞（几十~几百部，每部一次 DB + 封面异步），HTTP 默认无超时，前端 loading 提示即可。

## 6. 前端改造

### 6.1 入口与弹窗

- `index.html` 媒体 toolbar 加按钮：`<button id="media-sync" class="btn-mini">⇄ 同步番剧</button>`（放「管理格式」旁）。
- 新增弹窗 `#media-sync-modal`（贴合现有 modal 风格）：
  - 标题「同步番剧（AniList）」
  - **年份多选网格**：2000~2026 每个年份一个可点 chip（checkbox 样式），默认不选；顶部「全选/清空」。
  - 提示文案：数据源 AniList，只同步名称/年份/封面，命中已有跳过。
  - `modal-actions`：取消 / 「开始同步」。
- 状态行 `#media-sync-status`：同步中 →「正在拉取 200X~20XX 年…（第 N 部）」；完成 →「新增 X 部，跳过 Y 部」。

### 6.2 交互逻辑（app.js）

- 打开弹窗时生成年份 chips（2000~2026，含当前年 2026）。
- 「开始同步」：收集勾选年份 → `POST /api/media/sync-anilist {years}` → 完成后 toast + 刷新媒体列表（`loadMedia()`）→ 弹窗内展示结果。
- 同步中禁用按钮防重复提交；失败显示「同步失败：后端未响应」。

### 6.3 年份展示

- 媒体卡片 meta 加年份（有则显示 `2004 · 番剧` 形式）：`renderMediaGrid` 的 `meta` 数组插入 `a.year`。
- 媒体详情 head 展示年份（`loadMediaDetail` 渲染时带上）。
- `app.css`：年份 chip 网格、同步按钮样式，贴合现有色板（深色霓虹）。

## 7. 兼容性

- 仅新增列/字段/端点，现有 API 不破坏；旧数据 year/original_title 为 NULL，前端按无处理。
- `searchByKeyword` 列清单补 year 后，SELECT 列序与实体映射兼容（MyBatis-Plus 按列名）。
- 封面下载复用 `coverExecutor`（core 1/max 2），千部级会排队慢下但不阻塞同步主链路，失败降级无封面。

## 8. 非目标 / 推迟项

**后续再说**：
- AniList 的**集/集数/简介/评分**同步（本期只名称/年份/封面）。
- **中文译名自动匹配**（AniList 无中文，待评估 bangumi 可达性或其他源）。
- 媒体**按年份筛选/统计维度**（本期只存储+展示）。
- 同步进度**轮询/异步任务**（本期同步阻塞 + loading 即可；量大再升级）。

**本轮明确不做**：
- 精确首播日期（release_date）列。
- 全量自动同步（无人工确认）——按年份勾选是有意的可控性。
- 同步记录/审计（谁导的、哪天导的）。
