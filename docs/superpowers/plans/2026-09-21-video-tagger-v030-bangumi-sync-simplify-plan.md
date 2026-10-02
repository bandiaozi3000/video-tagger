# 执行计划：从 Bangumi 同步简化为「选条件 → 勾选 → 直接同步」

- 日期：2026-09-21
- 设计规格：`docs/superpowers/specs/2026-09-21-video-tagger-v030-bangumi-sync-simplify-design.md`
- 用户授权：设计 + 计划 + 实现**一次执行**（2026-09-21），F 项按「无关代码删除」

## 阶段零：删除边界核实（已完成，结论写进规格 §9）

- [x] 确认「老弹窗」无调用点 → 可删
- [x] 确认 AniList / Omofuna **不能删**（`SearchService` / `RecommendService` / `Media.source` / V13 数据仍用）→ 保留

## 阶段一：后端 —— 区间计划（纯函数 + 单测）

1. 新增 `metadata/SyncRangePlanner.java`（纯静态）：
   - 入参 `years` / `seasons` / `months` → 出参 `List<SyncRange>`
   - 规则：选细分只查细分（年作限定，季→3 月、月→1 月，并集）；无细分 → 整年；相邻月合并；**超过 3 个月的区间按自然季度切开**
   - 标签：`2024 春（4–6月）` / `2024 年 1–3 月` / `2024 年 7 月`
2. 新增 `metadata/SyncRange.java`（record：`index/from/to/label/quarter`）
3. 新增 `metadata/SyncActionDecider.java`（纯函数）：`matchType` → `CREATE|UPDATE|LINK|SKIP` + 计数归类
4. 单测 `SyncRangePlannerTest`（≥8 条）、`SyncActionDeciderTest`（4 种 + 兜底）

**验证**：`mvn -o test -Dtest='SyncRangePlannerTest,SyncActionDeciderTest'`

## 阶段二：后端 —— 三个新端点

5. `MetadataSyncRequest` 增加 `years` / `seasons` / `months` / `from` / `to` 字段（保留旧字段，避免破坏 `/preview`、`/sync`）
6. `MetadataSyncService` 新增：
   - `plan(SyncPlanRequest)` → `List<SyncRange>`
   - `discoverRange(from, to)` → 逐页取完（每页 20、上限 1000、按 `subjectId` 去重）+ `truncated` 标记，内部复用 `provider` 的 air_date 查询能力
   - `commit(List<CommitItem>)` → 每项调 `syncOne(...)`，逐项 try/catch，返回明细与计数
7. `MetadataSyncController` 新增 `/discover/plan`、`/discover/fetch`、`/commit`；同时**删除** `/draft`、`/tasks*` 端点
8. 记录对象：`SyncPlanRequest` / `SyncRangeFetchRequest` / `SyncRangeFetchResult` / `SyncCommitRequest` / `SyncCommitResult` / `SyncCommitItem`

**验证**：`mvn -o -q compile` + 单测

## 阶段三：后端 —— 删除工作区/任务/草稿 + 迁移

9. 删除文件：`MetadataSyncWorkspaceService`、`MetadataSyncTaskExecutor`、`MetadataSyncTaskRecovery`、`MetadataSyncTask*` 实体与 Mapper、`MetadataSyncDraft*`、相关 record、对应测试
10. 新迁移 `V38__drop_metadata_sync_task_tables.sql`：`DROP TABLE metadata_sync_task_item, metadata_sync_task, metadata_sync_draft`
11. 清理目录残留：`rm -f target/classes/db/migration/V35*…`（避免旧 class 里的迁移残留）

**验证**：`mvn -o test`（全绿，含 IT）＋确认无编译残留引用

## 阶段四：前端 —— 删死代码

12. `index.html`：删 `#media-sync-modal` 整块、删 `<section id="view-metadata-sync">` 整块、删 `v022-metadata-workspace.js` 引用
13. 删文件 `v022-metadata-workspace.js`；`v022-metadata.css` 里删该视图规则（保留媒体详情用到的部分）
14. `app.js`：删老弹窗与工作区相关的函数与常量、删 `metadata-sync` 视图路由/导航入口、删仅它们使用的 `.sync-*` 相关引用；`#media-sync` 改为打开新弹窗
15. `app.css`：删仅老弹窗使用的 `.sync-*` 规则

**验证**：`node --check app.js`；`grep` 确认无 `view-metadata-sync` / `openMediaSyncModal` / `openMetadataSyncWorkspace` 残留引用

## 阶段五：前端 —— 新弹窗

16. `index.html` 新增 `#bgm-sync-modal`：年份 chips、季度 chips、月份 chips、计划/进度行、列表容器（全选 + 只选 TV + 已选计数）、结果行、三个按钮（取消 / 同步选中 / 直接同步全部）
17. `app.js` 新增：
    - `openBgmSyncModal()`：构建年（2000..今年）/季/月 chips（多选）、恢复上次选择（localStorage）
    - `planBgmSyncRanges()` → `POST /discover/plan`
    - `fetchBgmSyncCandidates()`：逐段 `POST /discover/fetch`，合并去重、显示「第 x/y 段」进度
    - `renderBgmSyncList()`：卡片行（封面/中文名/原名/年份/格式/集数/匹配标记）+ 默认勾选（只选 TV 开）
    - `commitBgmSync(onlySelected)`：按 12 部一批 `POST /commit`，进度 + 汇总「新增/更新/跳过/失败」
    - 「直接同步全部」＝拉取完成后免勾选直接同步
18. `app.css` 增加新弹窗样式（沿用现有 modal / chip 语言）

**验证**：`node --check app.js`；真实浏览器点一遍

## 阶段六：端到端验证

19. 隔离实例（端口 18099，`VT_DATA_DIR=<副本>`）起后端 → 实调 `/discover/plan`（多种组合断言区间）与 `/discover/fetch`（2024 春 ≈ 255 条；**只读不写库**）
20. `mvn -o test` 全绿 + `node --check` + 版本戳 bump + `cp` 到 `target/classes/static/`

## 阶段七：文档

21. 工作日志 `docs/worklog/2026-09-21.md` 追加本节（含实测数据、删除清单、未验证项）
22. `docs/rules.md` 若涉及"同步流程"的旧描述则同步更新
23. 给用户的收尾说明：重启后端（**V38 删表 + 新端点**）+ Ctrl+F5；未验证项单列

---

## 风险与回退

- **删表不可逆**：V38 直接 `DROP`。三张表只服务于已废弃的任务制，且删除决定由用户拍板；如需回退，从 `V35` 迁移重建结构（数据无法恢复，但表内只有历史任务记录）。
- **`media_entry` 覆盖**：属既有行为，本次不引入回归（规格 §7 已标注为已知边界）。
- **前端删代码**：`app.js` 体量大，删除按「函数级 + grep 残留校验」推进，每步 `node --check`。
