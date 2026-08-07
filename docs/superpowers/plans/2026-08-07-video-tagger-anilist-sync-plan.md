# Video Tagger 番剧同步（AniList）实施计划（v0.14）

> 对应设计：`specs/2026-08-07-video-tagger-anilist-sync-design.md`
> 目标：media 加 `year` + `original_title` 列；「媒体」tab 按年份勾选从 AniList 批量建媒体（名称/年份/封面），命中已有跳过。

## 任务拆分

### 1. 迁移 V11
- 新建 `backend/src/main/resources/db/migration/V11__media_anilist_sync.sql`：
  ```sql
  ALTER TABLE media ADD COLUMN year INT NULL AFTER title;
  ALTER TABLE media ADD COLUMN original_title VARCHAR(512) NULL AFTER year;
  ```

### 2. 实体 / 请求 / 详情
- `Media.java`：加 `Integer year`、`String originalTitle`。
- `MediaRequest.java`：加 `@Size(max=512) String originalTitle`、`Integer year`。
- `MediaService.apply()`：映射 `originalTitle`、`year`（null 安全）。
- `MediaDetail`：加 `year`、`originalTitle`（构造调用处同步改）。
- `MediaSummary`：加 `Integer year`（列表卡片展示）。

### 3. Mapper 列清单 + 去重查询
- `MediaMapper` 手写列清单补 `a.year`：
  - `listSummaries`、`listByLatest`、`listByCollection`、`listFiltered`（4 处 SELECT 列）
  - `searchByKeyword`（SELECT DISTINCT 列）
- 新增：
  ```java
  @Select("SELECT * FROM media WHERE title = #{title} OR original_title = #{title} LIMIT 1")
  Media selectByTitleOrOriginal(@Param("title") String title);
  ```

### 4. AniList 同步服务（新）
- 新建 `service/AniListSyncService.java`：
  - `sync(List<Integer> years)` → `SyncResult(int added, int skipped)`
  - GraphQL POST graphql.anilist.co，`seasonYear` 循环分页（perPage=50），`hasNextPage` 控制
  - 解析：`title.native` / `startDate.year` / `coverImage.large` / `format`
  - 每页间隔 ~200ms；失败年份跳过不中断整体
  - 逐条：`selectByTitleOrOriginal(native)` 命中 skipped；否则建 media（title=native, originalTitle=native, year, VIDEO/WANT/confirmed=1）→ insert → `coverService.downloadAsync(id, large)`
  - 依赖：`MediaMapper`、`CoverService`、`ObjectMapper`
  - `record SyncResult(int added, int skipped)` 定义为嵌套 record 或独立文件（供 Controller 返回）
- 注入 `MediaController`，新增 `POST /api/media/sync-anilist`，body `{"years":[...]}`，年份范围校验。

### 5. 前端
- `index.html`：
  - toolbar 加 `<button id="media-sync" class="btn-mini">⇄ 同步番剧</button>`
  - 新弹窗 `#media-sync-modal`（年份 chip 网格 + 全选/清空 + 状态行 + 取消/开始同步）
- `app.js`：
  - 打开弹窗生成 2000~2026 年份 chips
  - 开始同步 → POST /api/media/sync-anilist → toast + loadMedia() 刷新 + 弹窗内展示结果
  - `renderMediaGrid` meta 加 `a.year`（有则显示）
  - 媒体详情 head 展示年份
- `app.css`：年份 chip 网格 + 同步按钮样式，贴合深色霓虹风格

### 6. 测试
- 新增 `AniListSyncServiceTest`（MockWebServer 返回样例 GraphQL JSON）：
  - 按年拉取 → 入库（title/originalTitle/year 落对）
  - 命中已有标题 → skipped
  - 封面 URL 传递（downloadAsync 调用或 mock coverService）
- `MediaServiceIT` 若存在则补 year/originalTitle 断言（可选）

### 7. 验证
- `mvn -q compile -o` 编译通过
- `mvn -q test -o -Dtest='AniListSyncServiceTest' -DfailIfNoTests=false` 单测通过
- 前端静态资源复制到 `target/classes/static/`（memory: backend-static-target-gotcha）
- 起后端实测：POST sync-anilist 导 2004 年一部→ 验证建媒体 + 封面落盘

### 8. 文档 + 提交
- CHANGELOG v0.14.0、docs/worklog/2026-08-07.md、docs/story.md 追加（storyline-on-version-update memory）
- 提交（仅用户要求时）
