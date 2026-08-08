# Video Tagger 媒体来源字段设计（v0.15 内补充）

> 日期：2026-08-08
> 前置：用户提出「媒体表新增来源字段，目前分 手动/同步 两类，后续可能有些场景需要」。
> 目标：media 表新增 `source` 列，细分到数据源（MANUAL / ANILIST / OMOFUNA），历史数据启发式回填，前端列表角标 + 详情展示；为后续按来源筛选/统计/治理打底。
> 版本：并入 **v0.15.0**（v0.15 尚未 git 提交，同一轮交付）。

## 1. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 来源粒度 | **细分数据源**：存储值 `MANUAL` / `ANILIST` / `OMOFUNA`（merge 治理重复时一眼识别来源；将来加新源直接加值，不用迁移）。UI 展示仍归「手动/同步」两类观感 + 细分名 |
| 2 | 历史回填 | **启发式回填**：`original_title` 非空 → `ANILIST`（AniList 必填日文原名）；`cover_url` 含 `cfhls.top` → `OMOFUNA`（omofuna 封面域名）；其余 → `MANUAL` |
| 3 | 前端展示 | **列表角标 + 详情 meta**：同步来源（AniList/omofuna）在卡片封面角标显示，手动不显示（默认态避免全屏角标）；详情 meta 完整显示来源（含手动） |
| 4 | source 归属 | **系统决定，不由用户手选**：手动新建（MediaService.create）默认 `MANUAL`；AniList/omofuna 同步 upsert 时分别标 `ANILIST`/`OMOFUNA` |

## 2. 迁移 V13

```sql
-- V13：媒体来源（手动/AniList/omofuna 细分）
ALTER TABLE media ADD COLUMN source VARCHAR(32) NULL AFTER cover_url;
-- 启发式回填：AniList 同步必填 original_title；omofuna 封面域名 cfhls.top；其余手动
UPDATE media SET source = 'ANILIST' WHERE original_title IS NOT NULL AND original_title != '';
UPDATE media SET source = 'OMOFUNA' WHERE source IS NULL AND cover_url LIKE '%cfhls.top%';
UPDATE media SET source = 'MANUAL' WHERE source IS NULL;
```

- 回填顺序保证 ANILIST 优先（AniList 记录即使封面被 omofuna 补下过，original_title 仍非空）。
- 边界：手动建但手填了 original_title 的记录会被标 ANILIST（少数，可接受）。

## 3. 后端改造

- `Media` 实体加 `private String source`（`@TableName` 自动映射）。
- `MediaSummary` record 加 `String source`；`MediaDetail` record 加 `String source`。
- `MediaMapper` 手写列清单补 `a.source`：`listSummaries` / `listByLatest` / `listByCollection` / `listFiltered` / `searchByKeyword`（`searchByKeyword` 返回 `Media`，SELECT 补 `a.source`）。
- `MediaService.create`：`a.setSource("MANUAL")`；组装 `MediaDetail` 时补 `detail.source`。
- `AniListSyncService.upsert` 新增分支：`a.setSource("ANILIST")`。
- `OmofunaSyncService.upsert` 新增分支：`a.setSource("OMOFUNA")`。
- `MediaRequest` **不暴露** source（来源由系统决定，用户不能手选）。

## 4. 前端改造

- `app.js` 加来源标签映射：
  ```js
  function mediaSourceLabel(s) {
      if (s === 'ANILIST') return 'AniList 同步';
      if (s === 'OMOFUNA') return 'omofuna 同步';
      return '手动';
  }
  ```
- **列表卡片角标**：`renderMediaGrid` 封面区 `fmtBadge` 后追加来源角标（仅同步来源显示）：
  ```js
  const srcBadge = (a.source === 'ANILIST' || a.source === 'OMOFUNA')
      ? `<span class="media-source-badge">${esc(a.source === 'ANILIST' ? 'AniList' : 'omofuna')}</span>` : '';
  ```
  样式 `.media-source-badge`（小号圆角、蓝/紫系区分手动默认态，贴合深色霓虹）。
- **详情 meta**：`renderMediaDetail` 的 `meta` 数组开头加 `mediaSourceLabel(d.source)`。
- 新建媒体弹窗/请求不动（source 默认 MANUAL）。

## 5. 测试

- `AniListSyncServiceTest`：新增媒体断言补 `assertEquals("ANILIST", inserted.getSource())`。
- `OmofunaSyncServiceTest`：新增媒体断言补 `assertEquals("OMOFUNA", m.getSource())`。
- `MediaServiceTest`（如有）：create 断言 `source == "MANUAL"`。
- 迁移验证：起 MySQL 跑 Flyway，SQL 抽查回填三分正确。

## 6. 验证方案

1. 起 mysql + 后端（Flyway 自动执行 V13）→ `SELECT source, COUNT(*) FROM media GROUP BY source` 验证回填三分。
2. 前端媒体页：同步来源卡片角标显示、手动卡片无角标；详情 meta 显示来源。
3. 新建媒体 → 详情 source=手动；跑一次 omofuna 同步 → 新导入 source=omofuna。
4. 单测 `mvn -o -Dtest='AniListSyncServiceTest,OmofunaSyncServiceTest'` 全过。

## 7. 非目标

- 不做来源筛选/统计（后续需要再加，字段已就绪）。
- 不做 source 的编辑（系统决定）。
