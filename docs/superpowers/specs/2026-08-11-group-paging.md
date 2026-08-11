# 收藏夹 / 推荐页分组：组打包分页（Group Paging）

> 日期：2026-08-11 ｜ 范围：app.js / index.html / app.css（纯前端，后端零改动）

## 需求背景（grill 确认）

用户反馈：**收藏夹分组视图没有分页**（v0.18.1 决策「分组全量一页」），收藏夹超过 1000 部时页面渲染特别卡。推荐页分组同款隐患（数据源更大，且记忆里记载的 `MAX_RECOMMEND_GROUP=800` 保护代码已在代码中丢失）。

根因（读码核实）：分组视图 `loadAllCollMedia/loadAllRecommend` 循环 200/页拉全量 → `renderGroupedLazy` 懒加载首批 60 但滚动到底**最终全量渲染 DOM** → 千张卡片重排/绘制卡死。

### grill 确认的决策
用户提出的方案（组打包分页）经评审采纳，**替代**先前选择的虚拟滚动窗口化（实现复杂度与维护成本高，组打包分页以纯数据切片达到同等 DOM 受控效果）：

1. **每页媒体总数 ≤ 上限**（上限可配），**组不跨页切碎**，放不下的整组进下一页。
2. **巨型组（单组 > 上限）组内切片**：组头显示 `2025年 · 共1500部 · 第1/5页`，块间连续成页，任何情况每页 ≤ 上限。
3. **年份导航 × 分页联动**：导航显示**全部**年份组，点某年若不在当前页 → 自动切到含该组的页再滚动；页内则直接滚动。
4. **档位 select**：上限 200 / 300 / **500（默认）** / 1000 / 不限。放分组开关旁，改档即重打包重渲染。
5. **收藏夹 + 推荐页共用同一套逻辑**。
6. 保留：折叠、卡片/列表双视图、sticky 年份导航高亮。

### 不做
- 后端分组分页接口（拉全量 → 前端切页已够：本地 MySQL，1000+ 部 ≈ 6 次 200/页请求秒级；上万级再议）。
- 虚拟滚动窗口化（已弃）。

## 实现方案（纯前端）

### app.js 新增（通用，收藏夹/推荐页共用）
- `buildGroupedPages(list, perPage)`：按首播年份分组 → 按序打包进页（组不跨页；`perPage` 为 Infinity 时「不限」= 全量一页）。返回 `pages` 数组，每页 = 组数组 `[{year, items, chunk, chunkIndex, chunkTotal, total}]`；巨型组块标记 `chunk`。同时产出 `yearToFirstPage` 映射（year → 该年首次所在页 index，供导航跨页）。
- `renderGroupedPage(container, pageGroups, opts)`：渲染 sticky 年份导航（全部年，当前页所在年高亮）+ 当前页各组（组头 + `itemRenderer`），替代 `renderGroupedLazy`。`opts: { idPrefix, nav, currentPage, onNavYear, itemRenderer }`。
- `renderGroupedNav(chips, currentPageYears)`：复用 `.coll-group-nav/.group-nav-chip` 样式；`IntersectionObserver` 页内滚动高亮保留。
- 分组分页条：复用现有 `.media-pagination` DOM（`coll-total` / `recommend-total` 显示总媒体数；`coll-page-info` / `recommend-page-info` 显示 `分组第 X/N 页`）。**平铺每页条数 select 在分组模式下隐藏**，由新的档位 select 接管。

### 收藏夹接线
- 状态：`collGroupPage / collGroupPerPage(=500) / collGroupPages / collGroupNav / collGroupTotalPages`。
- `loadCollMedia` 分组分支：拉全量 → `renderCollGrouped(list)`（打包 + 渲染当前页 + 分页条），`collPaginationEl.hidden = false`。
- `renderCollGrouped(list)` → `renderCollGroupPage()`；`gotoCollGroupYear(year)` 跨页/页内跳转。
- 分页条事件（5393-5395）分支：`collGrouped` 时走 `collGroupPage±1 → renderCollGroupPage()`，否则走现有平铺。
- 档位：`#coll-group-size` select → `collGroupPerPage` 更新 + 重打包渲染；`collGroupedEl` change 同步显隐档位 select（`coll-page-size` 反向隐藏）。

### 推荐页接线（同套）
- 状态：`recommendGroupPage / recommendGroupPerPage(=500) / recommendGroupPages / recommendGroupNav / recommendGroupTotalPages`。
- `loadRecommend` 分组分支同收藏夹；`renderRecommendGrouped` 改为打包分页；分组渲染后保持 `currentRecommendList = all`。
- `recommendPagePrev/Next` 事件（5415-5417）分支；`#recommend-group-size` 档位。
- `toggleDisplayView`（5643）分组重渲染改走 `renderRecommendGroupPage()`。

### index.html
- 收藏夹工具条「分组」label 后加 `<select id="coll-group-size">`（档位 200/300/500/1000/不限）。
- 推荐工具条「分组」label 后加 `<select id="recommend-group-size">`（同档位）。

### app.css
- `.group-size-sel` 样式（贴合 `.group-toggle` 风格：小 select，毛玻璃）。

### 收尾
- cache-bust `?v=` bump；静态复制 `target/classes/static`。

## 验证
- `node --check app.js`。
- 浏览器 E2E（8800）：① 收藏夹 1000+ → 分组每页 ≤500、页码正确、巨型组组头 `第1/M页`；② 组不跨页（当前页放不下的组整体进下一页）；③ 导航点未加载年跨页跳转 + 页内滚动；④ 折叠 / 卡片列表切换在分页下正常；⑤ 档位切换重打包；⑥ 推荐页同套生效。
