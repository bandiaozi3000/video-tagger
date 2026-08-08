# Video Tagger 同步分类筛选设计（v0.15 内补充）

> 日期：2026-08-08
> 前置：用户反馈「同步的有点太多了，能否添加分类，比如 TV、剧场版等等」。
> 目标：同步弹层新增**分类 chips 多选**（AniList 按 format、omofuna 按类目），默认全选不过滤，勾选后只导入所选分类，控制导入量。
> 版本：并入 **v0.15.0**。

## 1. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 分类范围 | **AniList + omofuna 都加**：弹层按来源切换分类选项 |
| 2 | 选择形式 | **多选 chips**（可同时要 TV+剧场版），默认全选=不过滤 |
| 3 | AniList 分类 | **format 7 类**：TV / TV_SHORT（短片）/ MOVIE（剧场版）/ OVA / ONA（网络动画）/ SPECIAL（特别篇）/ MUSIC（音乐） |
| 4 | omofuna 分类 | **类目 3 类**：日漫(1) / 动画(5) / 剧场(24)（omofuna 数据源无 format 字段，类目即其粗粒度分类；剧场=剧场版） |
| 5 | 过滤位置 | AniList 用 **GraphQL `format_in`**（减少拉取量）；omofuna 用 **node 脚本 `--types`**（只抓所选类目页） |

## 2. 后端改动

### 2.1 AniList（`AniListSyncService` + `MediaController`）

- `AniListSyncService.sync(List<Integer> years)` → `sync(List<Integer> years, List<String> formats)`：
  - GraphQL query 加 `$formats: [MediaFormat]` 变量 + `media(... format_in: $formats ...)`；formats 空 → 传 `null`（不过滤）。
  - `fetchPage` 透传 formats 拼变量。
- `MediaController.syncAnilist`：body 从 `{"years":[...]}` 扩展解析 `formats`（`List<String>`，可空），透传。**向后兼容**：不传 formats 行为不变（不过滤）。

### 2.2 omofuna（`omofuna.js` + `OmofunaSyncTaskService` + `MediaController`）

- `omofuna.js` 加 `--types` 参数（逗号分隔分类 id，默认全部 3 类）：
  ```js
  const typesArg = arg('--types');
  const catIds = typesArg ? typesArg.split(',').map(Number) : CATEGORIES.map(c => c.id);
  const cats = CATEGORIES.filter(c => catIds.includes(c.id));
  // 主循环 for (const cat of cats)
  ```
- `OmofunaSyncTaskService.create(years)` → `create(years, types)`；`execute(taskId, years, types)` → ProcessBuilder 加 `--types`；`OmofunaTask` record 加 `types`（存任务供展示/恢复）。
- `MediaController.syncOmofuna`：body 解析 `types`（`List<Integer>`，可空→全部）。

## 3. 前端改动

### 3.1 弹层分类区（index.html + app.js + app.css）

- 弹层「数据源」下方加：
  ```html
  <div class="sync-source-label">分类</div>
  <div id="sync-category-grid" class="sync-year-grid"></div>
  ```
- **分类 chips 按来源切换**（app.js）：
  - AniList：`[{code:'TV',name:'TV'},{code:'TV_SHORT',name:'TV 短片'},{code:'MOVIE',name:'剧场版'},{code:'OVA',name:'OVA'},{code:'ONA',name:'ONA'},{code:'SPECIAL',name:'特别篇'},{code:'MUSIC',name:'音乐'}]`
  - omofuna：`[{id:1,name:'日漫'},{id:5,name:'动画'},{id:24,name:'剧场'}]`
  - 默认全选（`on`）；来源切换时重渲染。
- `startMediaSync` 收集分类：
  - AniList → `body.formats = 选中 chips 的 code 数组`（全选时可不带=不过滤）
  - omofuna → `body.types = 选中 chips 的 id 数组`
- `updateSyncSourceHint` 提示文案可顺带补分类说明（可选）。

### 3.2 样式

- 复用 `.sync-year-chip` 样式（分类 chips 同款），无需新样式。

## 4. 测试

- `AniListSyncServiceTest`：`sync(years, List.of("TV","MOVIE"))` → MockWebServer 断言 GraphQL body 含 `"formats":["TV","MOVIE"]`；空 formats → 不传/传 null。
- `OmofunaSyncService`（导入逻辑）不受 types 影响（types 在抓取阶段过滤）。
- `OmofunaSyncTaskServiceTest`（可选）：create/execute 透传 types。
- `MediaControllerTest`（如有）：sync-anilist formats / sync-omofuna types 透传。
- **omofuna.js**：CLI 试跑 `--types 24`（只剧场）确认只抓剧场页。

## 5. 验证方案

1. 单测 + 编译。
2. CLI：`node omofuna.js --years 2026 --types 24 --out x.json` → items 全剧场分类。
3. 后端：`POST /api/media/sync-anilist {"years":[2026],"formats":["TV"]}` → 只导 format=TV；`POST /api/media/sync-omofuna {"years":[2026],"types":[24]}` → node 只抓剧场。
4. 前端：弹层分类 chips 按来源切换（AniList 7 个 format / omofuna 3 个类目）、多选、默认全选；开始同步请求带 formats/types。

## 6. 非目标

- 不做 omofuna 的 format 细分（数据源无 format 字段，类目即其分类）。
- 不做分类的保存记忆（每次打开默认全选）。
