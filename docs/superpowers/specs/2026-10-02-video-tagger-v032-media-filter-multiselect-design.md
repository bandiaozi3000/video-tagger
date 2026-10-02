# 媒体页筛选维度全部多选 设计规格（v0.32）

- **日期**：2026-10-02
- **关联版本**：**v0.32**（v0.31 标签重做已实现完、待实机验收，尚未归档）
- **Flyway**：**无**（纯查询/前端改动，零迁移）
- **状态**：**待用户审阅**（本文件批准前不写执行计划、不改代码）
- **关联执行计划**：待写（规格批准后）
- **前置文档**：
  - `docs/superpowers/specs/2026-10-02-video-tagger-v031-tag-rework-design.md`（媒体墙「标签」维度的多选 + 且/或开关由它引入，本规格把它推广到其余维度）

---

## 1. 目标

媒体页筛选浮层的 6 个维度**全部支持多选**；同维度内「全部匹配（且）/ 任一匹配（或）」的语义**只在语义上成立时才提供开关**，不成立的维度不摆空按钮。

用户 2026-10-02 原话：**「筛选都能多选，且都和标签一样，可勾选全部或任一匹配」→「按你的建议来，支持且和或的就有，不支持就别弄」**。

---

## 2. 已确认决策

| # | 决策 | 结论 |
|---|---|---|
| D1 | 维度基数分类 | **多值**（给且/或开关）：题材 `genres`、标签 `tagIds`（开关已有）、收藏夹 `collectionId`；**单值**（只多选，只「任一匹配」，不摆开关）：年份 `year`、季度 `season`、状态 `status` |
| D2 | 单值维度为什么不给「且」 | `media.year` / `media.status` 是**单值列**，选 2 个值再取交 = 空集；季度实测抽 200 部媒体**每部只有 1 条外部条目**（探针 `.tmp/genre-probe3.js`），取交同样恒空。摆上按钮 = 保证让用户踩空列表 |
| D3 | 收藏夹维度 | **不再切换请求路径**，统一走 `/api/media?...&collectionId=a,b`，与 `/api/collections/{id}/media` 同条件同列同排序（已核 `ORDER BY a.id` + 列清单一致）。收藏夹视图（`collFilter`）本身不动 |
| D4 | 参数契约 | **参数名一律不改**（`status`/`year`/`season`/`collectionId`），只把**类型从标量改成 List** —— 单值请求语义不变，编辑器等既有调用方零改动 |
| D5 | 本次范围 | 只改**媒体页筛选浮层**这 6 个维度。**不做**：NOT / 排除语义、跨维度 OR、筛选条件持久化（URL / localStorage）、Remotion 编辑器候选筛选的多选、收藏夹视图 `collFilter` 的多选、格式 / 子分类 / 待确认维度复活 |

---

## 3. 现状（代码位置）

| 位置 | 现状 |
|---|---|
| `app.js:2201` `MEDIA_DIMS` | 6 个维度：题材 / 年份 / 季度 / 状态 / 收藏夹 / 标签 |
| `app.js:2268` `dimIsMulti()` | **只 `genres` 返回 true**，其余走单选分支 |
| `app.js:2313` `dimValues()` | 单选维度在列表顶部塞一条 `全部（不限）` 当清空入口 |
| `app.js:2324` `dimLabel()` | 只有 `tagIds` 会输出「 或 / 且 」，其余维度选一个值 |
| `app.js:2427-2447` | 「全部匹配 / 任一匹配」分段按钮**硬编码只给 `tagIds`** |
| `app.js:2524-2557` `buildMediaUrls()` | 单值维度直接 `p.set(key, value)`；`2543` 起 `collectionId` 存在时**切到 `/api/collections/{id}/media`** |
| `MediaMapper.java:30` `GENRE_FILTER` | 只有 OR（`JSON_OVERLAPS`），用 service 手拼的 `genresJson` 字符串 |
| `MediaMapper.java:35` `SEASON_FILTER` | `ews.season = #{season}`（标量） |
| `MediaMapper.java:53` `TAG_FILTER` | 已有 `ANY`（union）/ `AND`（逐值 foreach）两分支，**本规格的模板** |
| 受影响 SQL | `listFiltered`、`listByLatest`、`countFiltered`、`countLatest`、`listExportRows`（媒体页 5 条）+ `listByCollection`（只因 `GENRE_FILTER` 片段改动） |
| 既有调用方 | `MediaController` 4 个端点、`CollectionController./{id}/media`、Remotion `backend/remotion/editor/api.ts:218 filterParams()`（只发单值） |

---

## 4. 后端设计

### 4.1 参数与类型

| 参数 | 改前 | 改后 | 谁在用 |
|---|---|---|---|
| `status` | `String` | `List<String>` | 媒体页、编辑器（单值）、收藏夹视图保持标量（`listByCollection` 不动） |
| `year` | `Integer` | `List<Integer>` | 同上 |
| `season` | `String` | `List<String>` | 媒体页 |
| `collectionId` | `Long` | `List<Long>` | 媒体页、编辑器（单值） |
| `genres` | `List<String>`（service 拼成 `genresJson`） | `List<String>` **直接用**，删掉手拼 | 媒体页、收藏夹视图 |
| **新增** `genreMode` | — | `AND` / `OR`，**缺省 `OR`**（= 现状） | 媒体页 |
| **新增** `collectionMode` | — | `AND` / `OR`，**缺省 `OR`** | 媒体页 |
| `tagMode` | 已有，缺省 `AND` | 不变 | 媒体页、编辑器 |

**空值语义**：`null` 或**空 list** = 不筛（`<if test='year != null and !year.isEmpty()'>`）。前端只在非空时发参数，避免 `?year=` 触发 `List<Integer>` 转换 400。

### 4.2 SQL 片段（改 `MediaMapper`）

```java
// 单值维度：只多选 OR，一个 IN 搞定
STATUS_FILTER     = "<if test='status != null and !status.isEmpty()'> AND a.status IN <foreach ...>#{s}</foreach></if>"
YEAR_FILTER       = "<if test='year != null and !year.isEmpty()'> AND a.year IN <foreach ...>#{y}</foreach></if>"
SEASON_FILTER     = "<if test='season != null and !season.isEmpty()'> AND a.id IN (SELECT ews.media_id FROM external_work ews WHERE ews.season IN <foreach .../>)</if>"

// 多值维度：ANY = 现状语义；AND = 逐值各自成立（模板照抄 TAG_FILTER）
COLLECTION_FILTER = ANY: a.id IN (SELECT media_id FROM media_collection WHERE collection_id IN (...))
                    AND: foreach cid → AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{cid})

GENRE_FILTER      = ANY: EXISTS (… JSON_OVERLAPS(ew.genres_json, JSON_ARRAY(<foreach>#{g}</foreach>)))
                    AND: foreach g → AND EXISTS (… JSON_CONTAINS(ew.genres_json, JSON_QUOTE(#{g})))
```

- **删** `MediaService.genresJson()`（手拼 `["奇幻","战斗"]` + 转义，3 行）及其注释：改用 `JSON_ARRAY(...)` 后不再需要手拼，也顺手去掉一处手写转义面。`CollectionService.media` 跟着把 `genresJson` 参数换成 `genres`。
- ⚠️ **实现前必须先在真库验证两段 JSON 函数**：`JSON_OVERLAPS(genres_json, JSON_ARRAY('奇幻'))` 与 `JSON_CONTAINS(genres_json, JSON_QUOTE('奇幻'))`（MySQL 8.0.17+）。若 `JSON_QUOTE` 形态不可用，`AND` 分支退回 `CAST(#{g} AS JSON)` 或复用现有 `genresJson` 路径 —— **这是本规格唯一的未验证点**。
- **5 条媒体页 SQL 必须同批改**（`listFiltered` / `listByLatest` / `countFiltered` / `countLatest` / `listExportRows`）：漏一条 = 「最近观看」或「清单导出」静默忽略新条件（2026-09-25 踩过，`MediaMapper.java:38-43` 有警告注释）。
- `listByCollection` 只跟着换 `GENRE_FILTER` 的入参（`genresJson` → `genres`），`status`/`year`/`season` 保持标量 → 收藏夹视图行为不变。

### 4.3 控制器

`MediaController` 的 `GET /api/media`、`/api/media/recent`、`/api/media/count`、`/api/media/list-export`：4 处参数类型照 4.1 改 + 各加 `genreMode` / `collectionMode`。**不带 `@RequestParam(defaultValue=...)`**，缺省 `null` 由 SQL 片段当 OR 处理。

---

## 5. 前端设计（`app.js`）

1. **状态**：`mediaFilter` 里 `status`/`year`/`season`/`collectionId` 由字符串改**数组**；扁平 `tagMode` 改成一个 map：
   `mediaFilter.mode = { genres: 'OR', tagIds: 'AND', collectionId: 'OR' }`（默认值 = 现状语义）。同步改两处重置点（`app.js:6179`、`app.js:7193`）。
2. **维度基数声明**：新增 `DIM_VALUE_CARDINALITY = { genres: 'multi', tagIds: 'multi', collectionId: 'multi', year: 'single', season: 'single', status: 'single' }`。**只有 `multi` 渲染「全部匹配 / 任一匹配」开关**（D2）。
3. **`dimIsMulti()` 退役**：全部维度走数组 toggle（`setDim`）；`dimValues()` 不再塞 `全部（不限）`（单值维度已无该入口，清空靠 chips 的 `×`，题材维度现状即如此）。
4. **`dimLabel()`**：多选维度按 `mediaFilter.mode[key]` 输出连接词 —— `' 或 '` / `' 且 '`；单值维度恒用 `' 或 '`。单值维度的显示值加单位（`2020 年`）。
5. **浮层（`renderFilterPop`）**：head 文案改为 `${label}（可多选）`；`tagIds` 的那段 `.fp-mode` 分段按钮**泛化成按 `DIM_VALUE_CARDINALITY` 渲染**，按钮点击写 `mediaFilter.mode[key]`。
6. **`buildMediaUrls()`**：
   - 数组维度非空时 `p.set(key, arr.join(','))`；`mode` 只在非空且该维度为 `multi` 时发（`genreMode` / `collectionMode` / `tagMode`）。
   - **删掉 `collectionId` 的路径切换分支（`2543-2547`）**：统一 `/api/media`；计数继续走 `/api/media/count`（同条件，本来就如此）。
7. **`recent` 分支与 `count` 参数**沿用同一份 `addCommon()`，无需单独改 —— 这正是 4.2 里 5 条 SQL 必须同批改的原因。

---

## 6. 验收

| # | 项 | 证据形态 |
|---|---|---|
| A1 | **零回归对拍**：同一组**单值**参数分别打 `/api/media`、`/api/media/recent`、`/api/media/list-export`、`/api/media/count`，改前 / 改后 id 集合与计数**完全一致** | 改前先跑一遍存基线（脚本 + 输出对比） |
| A2 | 每个维度的「多选 OR = 各单值结果并集」 | 后端 IT（新 `MediaFilterMultiIT`，照 `TagFilterIT` 写法） |
| A3 | 多值维度 `AND ⊆ OR`，且 `AND` = 各条件结果的交集 | 同上，用真库有代表性的样本（题材取「奇幻 + 战斗」等） |
| A4 | 单值维度**不出现**且/或开关 | 前端静态核对（`node --check` + 读码）；实机点选需另行安排 |
| A5 | `collectionId` 多选与 `/api/collections/{id}/media` 单夹结果一致 | curl 对拍 |
| A6 | Remotion 编辑器候选筛选 + 清单导出不受影响 | `npx tsc --noEmit` + `vitest` + 一次真实候选请求 |
| A7 | 后端全量测试 | `mvn -o test` 0 failed |

---

## 7. 风险与遗留

1. **v0.31 未收尾**：标签重做已实现完、**待实机验收**；其剩余工作若仍动 `renderFilterPop` / `MEDIA_DIMS`，需先确认再做本规格（避免同区冲突）。本规格**不含** V44 迁移，可独立上线。
2. **JSON 函数形态未验证**（§4.2 ⚠️）：`JSON_CONTAINS + JSON_QUOTE` 只在文档意义上成立，**未在真库跑过**。实现第一步就是验证它；不可用则退回现有手拼路径，其余设计不变。
3. **单值维度不给「且」是「少给一个功能」**：理由见 D2，属**有意不做**；若日后 `season` 真出现多条目媒体（同一部番挂两条季），再单独给它开开关。
4. **多选后的列表长度**：`year` / `status` 多选会让列表变长，`limit` 默认 50 的分页不受影响；不清空条件下「全选 + 任一匹配」≈ 不筛，属预期。
5. **未验证**：全部 UI 行为（开关渲染、chips 连接词、收藏夹路径改动）本轮只做读码与静态检查，**实机点选留到验收环节**，不预先宣称通过。
