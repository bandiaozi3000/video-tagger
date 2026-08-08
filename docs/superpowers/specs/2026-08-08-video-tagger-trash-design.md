# Video Tagger 回收站功能设计（v0.15 内补充）

> 日期：2026-08-08
> 前置：用户要求新增回收站，支持搜索 / 彻底删除 / 撤回。
> 目标：媒体删除改「移入回收站」（软删除），回收站独立视图支持按标题搜索、单条撤回、单条/批量彻底删除；集/片段删除保持现状。
> 版本：并入 **v0.15.0**。

## 1. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 回收粒度 | **媒体层软删除**：media 加 `deleted_at` 标记，删媒体进回收站，**集/片段/标签/封面/向量保留**（不物理删）——撤回原样恢复；彻底删除才级联物理清 |
| 2 | 删除入口 | **媒体改回收**：媒体列表/详情/批量删除按钮 → 「移入回收站」（可撤回）；**集/片段删除保持现状**直接删；回收站里才有彻底删除 |
| 3 | 交互 | **独立视图**：媒体 tab 内「回收站」子 tab/按钮切换——标题搜索框 + 列表（含删除时间）+ 单条撤回/彻底删除 + 清空 |

## 2. 数据模型

```sql
-- V14：媒体回收站（软删除标记，null=正常）
ALTER TABLE media ADD COLUMN deleted_at BIGINT NULL AFTER created_at;
```

- `Media` 实体加 `Long deletedAt`。
- **所有「正常媒体」查询排除已删**：`AND (a.deleted_at IS NULL)`——listSummaries / listByLatest / countFiltered / countLatest / listFiltered / listByCollection / countMedia / searchByKeyword / listDistinctYears / listMissingCovers / selectByTitle / selectByTitlePrefix / selectByTitleOrOriginal（同步去重）/ countByFormat / countBySubcategoryId / countDirectByFormat / countGroupByFormat / countGroupBySubcategory。
- MyBatis-Plus `selectById/selectBatchIds` 不过滤（搜索结果组装用，召回已排除；详情无需对回收站隐藏）。

## 3. 后端接口

### 3.1 `MediaService`

- `delete(id)` / `deleteBatch(ids)` → 改 **`trash(id)` / `trashBatch(ids)`**：`mediaMapper.updateById` 设 `deletedAt=now`，不级联（集/片段/标签保留）。
- 新增 **`restore(id)`**：`deletedAt=null`（撤回原样恢复）。
- 新增 **`purge(id)` / `purgeBatch(ids)`**：**彻底删除**，复用现有级联逻辑（删集/片段/标签/封面/向量 + embedding 任务）。
- 新增 **`listTrash(q, limit, offset)` / `countTrash(q)`**：查 `deleted_at IS NOT NULL`，q 按标题 LIKE 过滤，返回 `List<Media>`（含 deletedAt）。

### 3.2 `MediaController`

- `DELETE /api/media?ids=`、`DELETE /api/media/{id}` → **移入回收站**（语义变更，前端按钮改「移入回收站」）。
- `GET /api/media/trash?q=&limit=&offset=` → 回收站列表（含删除时间）。
- `GET /api/media/trash/count` → 回收站数量（可带 q）。
- `POST /api/media/{id}/restore` → 撤回。
- `DELETE /api/media/purge?ids=` → 彻底删除（单/批量）。
- `DELETE /api/media/trash` → 清空回收站（全部彻底删除）。
- **注意路由**：`/trash`、`/trash/count`、`/purge` 为字面路径，需在 `/{id}` 前声明或显式优先（Spring 字面优先于 `{id}` 模板，OK）。

## 4. 前端

### 4.1 回收站视图（媒体 tab 内）

- 媒体 tab 加「🗑 回收站」按钮（媒体筛选区旁）→ 切到回收站视图：
  - 搜索框（按标题搜已删媒体）
  - 列表（标题 / 删除时间 / 封面 / 原分类），单条「撤回」「彻底删除」
  - 顶部「清空回收站」按钮（确认弹层）
  - 返回媒体按钮
- app.js：`openTrashView()` 加载回收站列表 → 搜索 `GET /api/media/trash?q=` → 撤回 `POST /{id}/restore` → 彻底删 `DELETE /purge?ids=` → 清空 `DELETE /api/media/trash`。

### 4.2 删除按钮改造

- 媒体卡片删除 × / 详情删除 / 批量删除：确认文案改「移入回收站」，调接口不变（`DELETE /api/media`，后端语义已软删）。toast 提示「已移入回收站，可随时撤回」。

### 4.3 样式

- 回收站视图贴合现有列表风格；删除时间用 `.text-dim` 小字；操作按钮复用 `.btn-mini`。

## 5. 测试

- `MediaServiceTest`（如有）：trash 置 deletedAt 不级联 / restore 清空 / purge 级联删 / listTrash 只含已删 + q 过滤。
- 现有 delete 语义变更：检查 `MediaServiceTest`/controller 测试是否有断言物理删的，改为软删断言。
- 起后端实测：删媒体 → 出现在回收站、正常列表消失 → 搜索回收站命中 → 撤回恢复 → 再删 → 彻底删除后消失。

## 6. 验证方案

1. 单测 + 编译。
2. 起后端：删某媒体 → `GET /api/media/trash` 含它、`GET /api/media` 不含 → `POST /restore` 恢复 → `DELETE /purge` 彻底删。
3. 前端：回收站视图打开/搜索/撤回/彻底删除/清空；删除按钮文案「移入回收站」。

## 7. 非目标

- 集/片段层回收站（保持直接删）。
- 回收站自动清理定时任务（后续按需加）。
- 软删期间集/片段在时间线/统计的可见性（用户拍板保留，撤回即恢复；彻底删才清）。
