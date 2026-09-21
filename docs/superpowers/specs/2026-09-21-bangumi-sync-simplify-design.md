# 从 Bangumi 同步：简化为「选条件 → 勾选 → 直接同步」

- 日期：2026-09-21
- 状态：**设计规格（已按用户 2026-09-21 的拍板定稿）**
- 用户原话：「看下媒体番剧同步的功能，之前有点复杂了。现在简化功能，从Bangumi同步，支持年份，季度，月份。可多选。勾选后直接同步，本地已有则更新，不动本地数据。没有则新增本地媒体和Bangumi数据，最后显示同步条数。」
- 追加拍板（同日）：「F：无关代码删除，其他按你推荐来。后续设计，执行计划，实现直接一次执行，不必再问我。」

---

## 1. 目标

把「同步番剧资料」从**独立整页审核工作区 + 后台任务制**降级为一个**弹窗**：

> 选条件（年 / 季 / 月，均可多选）→ 一个按钮拉取 → 弹窗里出候选列表（默认勾选）→ 一个按钮同步 → 顶部显示 **新增 N / 更新 M / 跳过 K / 失败 F**。

不加数据库表、不加后台任务、不引入草稿。

---

## 2. 现状与依据（实测，非印象）

| 事实 | 依据 |
|---|---|
| 现在是独立视图 + 任务制 | `index.html` 的 `<section id="view-metadata-sync">` + `v022-metadata-workspace.js`(24.7KB) + 后端 `MetadataSyncService`(634) + `MetadataSyncWorkspaceService`(291) + `TaskExecutor`(140) + `TaskRecovery`(34) + 3 张表 + 11 个端点 |
| 老弹窗是死代码 | `#media-sync-modal` / `openMediaSyncModal()` **无任何调用点**（`#media-sync` 已改走 `openMetadataSyncWorkspace()`） |
| 写入语义已符合「不动本地数据」 | `importRecord()`：`LINK`/`UPDATE` 路径**只写** `media_entry` / `external_work` / `episode`(只补缺失) / `external_episode` / `external_relation`；`media` 字段只在 `CREATE` 时写入 |
| 稳定 ID 覆盖极低 | 本库 5521 部媒体，仅 **128** 部有 `external_work` 关联（2.3%） |
| 标题匹配够用 | 用真实 Bangumi「2024 年 1 月」130 条对 5521 部本地库实测：**标题/别名精确唯一命中 33 条（25%）**、命中多条 **0**、基名（剥掉第N季/幕/期）归一无任何增益 |
| Bangumi 查询能力 | `POST /v0/search/subjects` + `filter.air_date` 范围过滤（季度就是这么实现的）→ **月份天然可行** |
| **同一请求多段 range 会 AND 成 0 条** | 实测 `air_date:[">=2024-01-01","<2024-02-01",">=2024-04-01","<2024-05-01"]` → `total=0` → **多选必须逐段请求再合并** |
| `air_date:["=2024-01-01"]` | 实测报错 → **只能 `>=` + `<`** |
| 页大小服务端硬顶 20 | 实测传 `limit=100` 只回 20 条 |
| **`total` 硬上限 1000** | 实测 2024 全年、2020-2025 六年均 = `1000`，且 `offset=990` 仍有数据；而 2024 春 = **255**、2024 年 1 月 = **130** 都在安全区 |
| `type=2` 不区格式 | 结果混入 OVA / 剧场版 / 短片（实测样例里就有《功夫熊猫4》《高达SEED FREEDOM》） |

---

## 3. 范围

**做**：新弹窗 + 3 个新端点 + 区间计划算法 + 匹配判定 + 计数 + **删除已死的老同步工作区/任务/草稿**。

**不做（保持现状）**：
- 媒体详情里的**单条刷新 / 换绑 / 关键词搜索**（`v022-media-metadata.js` 与 `/media/{id}/metadata`、`/media/{id}`、`searchForMedia` 全部保留不动）
- `AniListSyncService` / `Omofuna*`（**不能删**：`SearchService` / `RecommendService` / `Media.source` / `V13` 数据仍在用，UI 里还显示「omofuna 同步」来源标签）
- 不加任何数据库表

---

## 4. 筛选语义（写死，不留歧义）

**输入**：`years[]`（至少 1 个，默认当前年）、`seasons[]`（`WINTER|SPRING|SUMMER|FALL`，可空）、`months[]`（1–12，可空）。

**规则**：

1. **年**是限定符；**季/月**是可选的细分。
2. **选了细分 → 只查细分**（年作限定）：`年 × 季` 展开成三个月、`年 × 月` 展开成一个月，两者**取并集**。
3. **没选细分 → 查整年**（12 个月）。
4. 把得到的月份集合**同季内相邻合并**成区间（跨季度边界不合并）。
5. **超过 3 个月的区间按自然季度切开**（这是绕开 `total=1000` 上限的关键：按年会撞顶，按季不会）。

**例**：

| 选择 | 区间计划 |
|---|---|
| 2024 年（无细分） | 2024 冬 / 2024 春 / 2024 夏 / 2024 秋（4 段） |
| 2024 + 春 | 2024 春（1 段） |
| 2024 + 春 + 夏 | 2024 春、2024 夏（2 段） |
| 2024 + 1月 + 4月 | 2024-01、2024-04（2 段） |
| 2023 + 2024 + 秋 | 2023 秋、2024 秋（2 段） |
| 2024 + 春 + 1月 | **2024-01、2024 春（2 段）** ⚠️ 勘误：初稿写成“1–3 月”是错的（春 = 4–6 月，与 1 月不相邻）|
| 2024 + 4月 + 5月 | 合并成 2024 年 4–5 月（1 段，同季内相邻）|
| 2024 + 3月 + 4月 | 2024-03、2024 春（2 段：相邻但跨季度，为保证每段 ≤ 3 月且季度对齐）|

**截断提示**：某段 `total >= 1000` → 该段标 `truncated`，UI 提示「该段超过 Bangumi 1000 条上限，建议改选月份」。

---

## 5. 后端接口（新增 3 个，全部挂在 `/api/metadata-sync`）

### 5.1 `POST /discover/plan`

```jsonc
// 请求
{ "years": [2024, 2025], "seasons": ["SPRING"], "months": [1] }
// 响应
{ "ranges": [ { "index": 0, "from": "2024-04-01", "to": "2024-07-01", "label": "2025 春（4–6月）" } ] }
```

### 5.2 `POST /discover/fetch`

```jsonc
// 请求
{ "from": "2024-04-01", "to": "2024-07-01" }
// 响应
{
  "total": 255, "truncated": false,
  "candidates": [ /* MetadataCandidate + matchType/targetMediaId/localMatches/matchReason */ ]
}
```

服务端把该区间的**所有分页**取完（每页 20，上限 1000）并按 `subjectId` 去重；**一次请求只查一段**，让前端能显示逐段进度。

### 5.3 `POST /commit`

```jsonc
// 请求
{ "items": [ { "externalId": "12345", "action": "CREATE|UPDATE|LINK", "mediaId": 6917 } ] }
// 响应
{
  "total": 12, "added": 3, "updated": 8, "skipped": 0, "failed": 1,
  "items": [ { "externalId": "12345", "status": "ADDED", "mediaId": 6001, "title": "…", "error": null } ]
}
```

- 每项复用现有 `syncOne(externalId, action, mediaId)`（**每项独立事务**，失败不影响其它项）。
- `externalId` 是**唯一可信来源**：详情与集资料在服务端重新拉取，不信任前端字段。

---

## 6. 匹配规则与计数语义

| `matchType`（复用现有判定） | 含义 | 新流程动作 | 计数 |
|---|---|---|---|
| `EXTERNAL_ID` | `external_work` 已关联本地 | `UPDATE` | **更新** |
| `TITLE` | 标题/别名**唯一**精确命中 | `LINK`（关联到该媒体并刷新） | **更新** |
| `CONFLICT` | 命中**多个**本地媒体 | `SKIP`（列表标红说明，不阻断其它） | **跳过** |
| `NONE` | 本地没有 | `CREATE` | **新增** |

> 不用模糊匹配：实测「剥掉第N季/幕/期后比基名」零增益，且误关联代价远大于漏关联。

---

## 7. 写入语义（「不动本地数据」的字段级定义）

| 对象 | 新增（`CREATE`） | 更新（`UPDATE` / `LINK`） |
|---|---|---|
| `media` | 建行：`title`=中文名、`year`、`season`（标题解析）、`aliases`、`media_format=VIDEO`、`status=WANT`、`confirmed=1` | **完全不动**（标题/年份/备注/评分/状态/标签/分类/本地封面一律不写） |
| `media_entry` | 建/补 | 补（写入 `title`/`title_cn`）⚠️ 条目层没有 `titleOverride` 保护，属于已知边界 |
| `external_work` | 全量写（原名/罗马字/英文名/别名/简介/封面URL/题材/格式/年/季/开播/结束/集数/关联/`raw_json`+hash） | **全量刷新**（这就是「更新」的实际内容） |
| `episode` | 按集号建 | **只补缺失**；不删、不改已有（本地标题走 `title_override` 保护） |
| `external_episode` | 建 | 刷新；消失的标 `MISSING`（**不删**） |
| `external_relation` | 建 | 刷新 |
| `media.cover_path` | 不写（展示走 `external_work.cover_url` 回退链） | **不删**（注意：换绑路径会删，同步路径不会） |

---

## 8. 交互设计（弹窗）

```
┌ 从 Bangumi 同步 ───────────────────────────────────────┐
│ 年份  [2000]…[2023][2024*][2025][2026]   全选 / 清空    │
│ 季度  [冬][春*][夏][秋]     月份  [1..12] 多选           │
│ 计划  2024 春（4–6月） → 正在获取 2/4 段…  已得 381 条   │
│ 提示  某段超过 1000 条会标红提示改选月份                  │
│                                   [ 拉取候选 ]           │
├────────────────────────────────────────────────────────┤
│ ☑ 全选   ☑ 只选 TV（默认开）   已选 18 / 255             │
│ ☑ [封面] 中文名（原名） 2024 · TV · 12集 · 更新 #6917    │
│ ☐ …                                                    │
├────────────────────────────────────────────────────────┤
│ 结果：新增 3 · 更新 12 · 跳过 2 · 失败 1                 │
│                          [ 同步选中 ] [ 直接同步全部 ]   │
└────────────────────────────────────────────────────────┘
```

- 「只选 TV」默认开（因为 `type=2` 混 OVA/剧场版）：勾选变化时重算默认勾选集合。
- 「直接同步全部」= 免勾选，拉取完立刻按同一套匹配规则同步。
- 同步分批：前端**每批 12 部**串行 `POST /commit`，显示「已处理 12 / 30」。
- 结果行显示单条状态与失败原因，失败的可在列表里重新勾选再同步一次（**没有逐项重试表**）。

前端用项目既有的 `confirmAsync`/`showConfirm` 风格弹窗与 toast，不引原生弹窗。

---

## 9. 删除清单（用户拍板 F：无关代码删除）

| 类别 | 删除对象 |
|---|---|
| 死弹窗 | `index.html` 的 `#media-sync-modal` 整块；`app.js` 的 `openMediaSyncModal` / `syncQueryBody` / `setSyncMode` / `setSyncYears` / `updateMetadataSyncMode` / `startMediaSync` / `syncAllMetadata` / `renderMetadataSyncCandidates` / `confirmMetadataSync` 及其元素常量；`app.css` 里仅它们使用的 `.sync-*` 规则 |
| 旧工作区 | `index.html` 的 `<section id="view-metadata-sync">`；`v022-metadata-workspace.js`（整文件）；`v022-metadata.css` 里该视图的规则；`app.js` 中对 `metadata-sync` 视图的路由/导航引用 |
| 任务与草稿 | `MetadataSyncWorkspaceService`、`MetadataSyncTaskExecutor`、`MetadataSyncTaskRecovery`、`MetadataSyncTask` / `MetadataSyncTaskItem` / `MetadataSyncDraft` 实体、三个 Mapper、`MetadataSyncDraftRequest` / `MetadataSyncDraftView` / `MetadataSyncTaskCreateRequest` / `MetadataSyncTaskDetail` / `MetadataSyncTaskItemRetryRequest`，以及 `MetadataSyncController` 里的 `/draft` 与 `/tasks` 全部端点 |
| 表 | `metadata_sync_task` / `metadata_sync_task_item` / `metadata_sync_draft`（新迁移 **V38** 里 `DROP TABLE`） |
| 测试 | 上述对象的单测/IT（`MetadataSyncWorkspaceServiceTest`、`MetadataSyncTaskExecutorTest` 等） |
| 保留 | `MetadataSyncService`（preview/sync/metadata/refreshMedia/searchForMedia）、`BangumiMetadataProvider`、`MetadataSyncRequest` / `MetadataSyncResult` / `MetadataCandidate` / `ProviderQuery` / `MetadataProvider`、`v022-media-metadata.js`、AniList/Omofuna 全部代码 |

---

## 10. 边界与风险

1. **1000 上限**：按季拆后仍可能撞顶（极热门季度）→ 显式 `truncated` 提示，不静默丢。
2. **标题误关联**：只在唯一命中时自动关联；结果行**显示「更新到 #id 标题」**便于人工核对。
3. **`media_entry` 会被覆盖**：条目层无 `titleOverride`；若用户曾手工改过条目名，同步会覆盖（已知边界，写进本次文档）。
4. **`CONFLICT` 一律跳过**：不会误合并，但需要人工去媒体详情里换绑（既有能力保留）。
5. **封面是远程 URL**：展示依赖既有封面回退链与代理。
6. **大批量写入**：一次 200 部新增 ≈ 200 媒体 + 数千集 → 分批 + 进度；失败项留在列表里可重试。
7. **Bangumi 需要代理**：`application.yml` 的 `http-proxy` 配置（本机 `127.0.0.1:7890`）。

---

## 11. 验证计划

| 层 | 内容 |
|---|---|
| 单测（Java，纯函数） | 区间计划：整年→4 段、单季→1 段、春+夏→2 段、1月+4月→2 段、多年×月、季与月并集、超 3 月按季切开；匹配→动作映射（4 种） |
| IT（Testcontainers） | `commit` 新增一家：`media`+`media_entry`+`external_work`+`episode` 齐；更新一家：**逐字段断言 `media` 未变**、`external_work` 已刷新、缺失集被补；`CONFLICT` 跳过计数 |
| 真接口 | 隔离实例（18099）实调 `/discover/plan` 与 `/discover/fetch`，断言 2024 春 ≈ 255 条、去重正确、**不写库** |
| 回归 | `mvn -o test` 全绿；`node --check` 校验 `app.js`；死代码删除后前端无 404 引用 |
| 人工 | 重启后端 + Ctrl+F5 点一遍（含「直接同步全部」） |
