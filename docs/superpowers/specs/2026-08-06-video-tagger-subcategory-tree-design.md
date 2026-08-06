# Video Tagger 分类树设计（子分类任意层级细分）

> 日期：2026-08-06
> 前置：三问拍板（见「决策记录」）
> 目标：让子分类支持**任意层级细分**（番剧 → 国漫/日漫 → …），媒体可挂树任意节点，筛选/搜索按父分类**子树收敛**。
> 版本：待定（标签池 0.9.0 之后独立版本，见 §8）。

---

## 1. 现状与问题

### 1.1 现状（读码确认）

- **两层结构**：`media_format`（格式：VIDEO/IMAGE/TEXT）→ `media_subcategory`（每格式一个扁平子分类列表，`format_id` 直接归属，`(format_id, name)` 唯一）。
- **媒体按名字引用**：`media.subcategory VARCHAR(32)` 存子分类**名字符串**。搜索（`SearchService.matchFormatSubcategory` 名字比对）、媒体筛选（`MediaMapper.listFiltered` `subcategory = ?` 名字精确）、统计（`countGroupBySubcategory` 按名字分组）、删除保护（`countBySubcategory(name)`）全部按名字。
- **无父子概念**：`media_subcategory` 无 parent_id，无法细分。

### 1.2 结构性问题

子分类一旦支持树，同一名字可能出现在不同分支（如「剧场版」既挂番剧下也挂电影下），`(format_id, name)` 唯一失效；媒体行上的**名字字符串随之歧义**——必须改按 **id 引用**。

## 2. 决策记录（三问已拍板）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 树深度 | **任意层级真树**：`media_subcategory` 加 `parent_id` 邻接表，想分几层都行 |
| 2 | 媒体归属 | **任意节点**：媒体可挂叶子也可挂中间分类（不想细分直接归父类） |
| 3 | 筛选语义 | **子树收敛**：按父分类筛选/搜索时，其下所有子孙节点的媒体都算 |
| 4 | 引用方式 | `media` 加 `subcategory_id` 按 id 引用；**保留 `subcategory` 名字快照列**供展示（不暴露改名，快照不会过期） |
| 5 | 唯一键 | `(parent_id, name)`（parent_id=0 表示根）；`format_id` 保留在每节点（= 根所属格式，插入时继承校验） |
| 6 | 统计 | 按媒体**直接归属节点**分组（不双计），label 显示完整路径（番剧 > 国漫） |
| 7 | 不做 | 子分类改名、节点移动、父分类下批量迁移媒体（本期不做） |

## 3. Schema（V10）

```sql
-- 子分类树：加 parent_id（0=根），唯一键改 (parent_id, name)
ALTER TABLE media_subcategory ADD COLUMN parent_id BIGINT NOT NULL DEFAULT 0 AFTER format_id;
ALTER TABLE media_subcategory DROP INDEX uk_media_subcategory;
ALTER TABLE media_subcategory ADD UNIQUE KEY uk_media_subcategory (parent_id, name);

-- media 按 id 引用子分类节点（可挂任意层级）；保留名字快照
ALTER TABLE media ADD COLUMN subcategory_id BIGINT NULL AFTER subcategory;
-- 回填：现数据名字全库唯一（无跨分支歧义），按根节点名字匹配
UPDATE media m JOIN media_subcategory s ON m.subcategory = s.name AND s.parent_id = 0
    SET m.subcategory_id = s.id;
```

## 4. 后端改动

### 4.1 实体 / 视图
- `MediaSubcategory` 加 `parentId`。
- `Media` 加 `subcategoryId`（MyBatis-Plus `subcategory_id → subcategoryId` 自动映射）。
- `MediaFormatView.SubcategoryView` 加 `parentId`（listFormats 返回**全树 flat**，前端按 parentId 组树）。
- `MediaSummary` / `MediaDetail` / `SearchResult` 加 `subcategoryId`；`MediaRequest` 加 `subcategoryId`。

### 4.2 MediaFormatService（树操作 + 子树计数）
- `listFormats`：每格式返回全部节点（flat，带 parentId），`mediaCount` = **子树媒体数**（内存 DFS 收敛：先 count 全量 `media.subcategory_id`，再每节点累加子孙）。
- `addSubcategory(formatId, parentId, name)`：
  - parentId null/0 → 根：`format_id=formatId, parent_id=0`。
  - parentId 给定 → 校验父节点存在且 `format_id == formatId`（属于所选格式），`format_id` 继承父节点、`parent_id=parentId`。
  - 唯一性按 `(parent_id, name)`。
- `deleteSubcategory(subId)`：先拒绝「仍有子分类」（提示先删子分类），再拒绝「该分类下存在媒体」（`countBySubcategoryId`）；两个都通过才删。
- 移除 `countBySubcategory(name)`（改 id）。

### 4.3 MediaMapper / MediaService / ClipService（id 引用 + 子树过滤）
- 投影 `a.subcategory_id AS subcategoryId`（listSummaries / listByLatest / listByCollection / listFiltered）。
- `listFiltered`：`subcategory` 名字参数 → `subcategoryId` Long，过滤改递归 CTE：
  ```sql
  AND a.subcategory_id IN (
      WITH RECURSIVE cte AS (
          SELECT id FROM media_subcategory WHERE id = #{subcategoryId}
          UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id
      ) SELECT id FROM cte)
  ```
- 新增 `countBySubcategoryId(id)`、`subtreeIds(rootId)`（递归 CTE 返回 List<Long>）；`countGroupBySubcategory` 改按 `subcategory_id` 分组。
- `MediaService.apply`：**优先 `req.subcategoryId`**（校验节点存在且属于所选格式，落 `subcategory_id` + 名字快照）；回退 `req.subcategory` 名字 → 该格式树下解析同名节点。
- `ClipService.ensureMedia`：TitleParser 探测子分类名字 → 该格式树下找同名节点（默认「番剧」）；**找不到置 null**（顺带修复 IMAGE 格式误标「番剧」的既有 bug）。

### 4.4 搜索 + 统计（子树收敛）
- `SearchController` / `SearchService`：`subcategory` 参数 → `subcategoryId` Long；`matchFormatSubcategory` 改子树成员判断（enrich 已补 `subcategoryId`，`subtreeIds(rootId)` 取一次子树集合查成员）。format 字符串过滤保留（仅 format 时）。
- `StatsService`：`countGroupBySubcategory` 按 id 分组 → 解析节点路径 label（番剧 > 国漫）。

## 5. 前端改动

- `formatsCache` 子分类带 `parentId`；新增 `buildSubcategoryTree(f)` 组树助手（depth 缩进、子树收敛计数展示）。
- **三个下拉树化**（value=节点 id，label 缩进 `─`×depth + 名字）：
  - 媒体弹窗 `fillMediaSubcategorySelect`（selected=subcategoryId）；
  - 媒体筛选 `fillSubcategoryFilter`（`mediaFilter.subcategory → subcategoryId`，loadMedia 发 `subcategoryId`）；
  - 搜索 `fillSearchSubcategory`（runSearch 发 `subcategoryId`）。
- **fm 管理弹层树渲染**：`renderFmSubs` 按 parentId 组树缩进；每节点行加「＋子分类」按钮（行内输入添加子节点）+「×删除」；保留格式级根添加输入。
- `addMediaSubcategoryInline`（媒体弹窗内联添加）仍加格式根节点，适配新签名。
- 媒体卡片/详情展示名字快照不变（`subcategory` 字段仍在）。

## 6. 风险与注意

1. **名字快照与 id 双写**：不暴露改名，快照不会过期；未来若加改名需同步 media.subcategory。
2. **递归 CTE**：数据量小（个人库），性能可接受。
3. **回填依赖现数据名字唯一**：V10 前检查 `media_subcategory` 无跨格式同名（现种子数据无）。
4. **参数类型变化**：搜索/媒体筛选 `subcategory`(String) → `subcategoryId`(Long)，前端需同步，否则筛选失效。
5. **子树计数语义**：fm 弹层每节点显示子树媒体数（与筛选语义一致），媒体直接归属节点在统计里不双计。

## 7. 测试计划

- 后端单测（Mockito / 排除 IT）：
  - `addSubcategory` 带 parentId：父节点校验（跨格式拒绝）、`(parent_id,name)` 唯一、format_id 继承。
  - `deleteSubcategory`：有子分类拒绝、有媒体拒绝、空叶删除成功。
  - `listFiltered` 子树过滤：选父分类返回其子孙节点媒体（SQL 级，进 IT 或 mapper 测试）。
  - `MediaService.apply`：subcategoryId 优先、名字回退、跨格式节点拒绝。
  - `SearchService` 子树过滤：选「番剧」收敛其下细分媒体的结果。
- 前端：`mvn process-resources` 同步；起服务目测（fm 弹层树、三个下拉缩进、子树筛选）。

## 8. 版本

标签池已占 0.9.0（未提交）。本功能建议独立版本 **0.10.0**（检索质量优化顺延 0.11.0）；或用户选择先提交 0.9.0 再开本功能。**版本号由用户收尾时拍板。**
