# Video Tagger 分类树 实施计划

> 依据 `docs/superpowers/specs/2026-08-06-video-tagger-subcategory-tree-design.md`。三问已拍板：任意层级真树 + 任意节点挂载 + 子树收敛。

## P1 迁移 + 实体/Mapper 树化

- `V10__subcategory_tree.sql`：media_subcategory 加 parent_id + 唯一键改 (parent_id,name)；media 加 subcategory_id + 名字回填。
- `MediaSubcategory` + parentId；`Media` + subcategoryId。
- `MediaFormatView.SubcategoryView` + parentId（listFormats 全树 flat）。
- `MediaMapper`：投影加 `a.subcategory_id AS subcategoryId`（4 处 SELECT）；`listFiltered` 参数 subcategory→subcategoryId + 递归 CTE 子树；新增 `countBySubcategoryId`、`subtreeIds`；`countGroupBySubcategory` 改 id 分组；删 `countBySubcategory(name)`。

## P2 MediaFormatService 树操作 + 子树计数

- `listFormats`：全树 flat + 子树媒体数（内存 DFS）。
- `addSubcategory(formatId, parentId, name)`：parentId 校验 + format_id 继承 + (parent_id,name) 唯一。
- `deleteSubcategory`：有子分类拒绝 → 有媒体拒绝 → 删。
- MediaFormatController：`POST /api/media-formats/{id}/subcategories` body 加 parentId。

## P3 media 按 id 引用 + 名字解析

- `MediaRequest` + subcategoryId；`MediaSummary`/`MediaDetail` + subcategoryId。
- `MediaService.apply`：优先 id（校验属于所选格式）+ 名字回退解析。
- `ClipService.ensureMedia`：探测名字 → 格式树下找节点（默认番剧），找不到 null；注入 MediaFormatMapper + MediaSubcategoryMapper。
- MediaController：`list` 参数 subcategory→subcategoryId。

## P4 搜索 + 统计子树收敛

- `SearchController`/`SearchService`：subcategory→subcategoryId；`matchFormatSubcategory` → 子树成员；enrich 补 subcategoryId；SearchResult + subcategoryId。
- `StatsService`：按 id 分组 + 路径 label。

## P5 前端树化

- app.js：`buildSubcategoryTree` 助手；三个下拉树化（媒体弹窗/媒体筛选/搜索，value=id）；`mediaFilter.subcategory→subcategoryId`；fm 弹层树渲染 + 每节点加子分类/删除。
- app.css：fm 子分类行缩进、级联样式。

## P6 测试 + 版本 + 文档收尾

- 适配既有测试（MediaFormatServiceTest / SearchServiceTest / MediaServiceIT 等）；补子树过滤、父节点校验、删除保护用例。
- 版本号与用户确认（建议 0.10.0）；CHANGELOG/README/worklog 更新；`mvn process-resources` 同步；`node --check`。
