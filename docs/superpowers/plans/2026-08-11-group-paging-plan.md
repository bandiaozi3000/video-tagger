# 收藏夹 / 推荐页分组：组打包分页 实施计划

- 日期：2026-08-11
- 版本：不升版（纯前端性能修复）
- spec：`docs/superpowers/specs/2026-08-11-group-paging.md`

## 实施步骤

### Step 1：核心渲染器（app.js 新增，替代 renderGroupedLazy）
1. 全局状态：`collGroupPage/collGroupPerPage(=500)/collGroupPages/collGroupNav/collGroupTotalPages`；推荐页同款 `recommendGroup*`。
2. `buildGroupedPages(list, perPage)`：按 year 分组（未知年份兜底排最后）→ 组打包进页；巨型组（>perPage）切片（chunk 标记 + chunkIndex/chunkTotal/total）；产出 `yearToFirstPage`。
3. `renderGroupedPage(container, pageGroups, opts)`：nav（全部年 + 当前页高亮 + IO 滚动高亮）+ 各组 section（组头 `group-head` + itemRenderer）。
4. `gotoGroupYear(year, page, render)` 通用跳转：页内 scrollIntoView / 跨页切页后滚动。
5. 分组分页条：复用现有 `.media-pagination`（total 显示总媒体数；info 显示 `分组第 X/N 页`）。

### Step 2：收藏夹接线
1. `loadCollMedia` 分组分支：拉全量 → `renderCollGrouped(list)`；`collPaginationEl.hidden = false`；空态处理。
2. `renderCollGrouped` → 打包 + `renderCollGroupPage()`；新增 `renderCollGroupPagination()`。
3. 分页条事件分支（collPagePrev/Next）：`collGrouped` 时 `collGroupPage±1 → renderCollGroupPage()`。
4. index.html：`#coll-group-size` 档位 select（200/300/500/1000/不限）放分组 label 后；`collGroupedEl` change 同步显隐（平铺 `#coll-page-size` 反向隐藏）；档位 change → 重打包渲染。

### Step 3：推荐页接线（同套）
1. `loadRecommend` 分组分支同收藏夹；`renderRecommendGrouped` → 打包分页 + `renderRecommendGroupPage()`；渲染后 `currentRecommendList = all`。
2. `recommendPagePrev/Next` 事件分支；`#recommend-group-size` 档位。
3. `toggleDisplayView` 分组重渲染改走 `renderRecommendGroupPage()`。

### Step 4：样式 + 收尾
1. app.css：`.group-size-sel` 小 select 样式（贴合 group-toggle 毛玻璃风格）。
2. cache-bust `?v=` bump；复制静态到 `target/classes/static`。
3. `node --check`。

### Step 5：验证
1. 浏览器 E2E（8800）：每页 ≤上限 / 巨型组切片 / 组不跨页 / 导航跨页 / 折叠 / 双视图 / 档位切换 / 推荐页同套。
2. 截图 `docs/testing/`。
3. worklog 2026-08-11 追加；记忆 `video-tagger-collection-grouping` + `project-map` 更新（性能方案变更）。
4. 提交（用户确认后）。
