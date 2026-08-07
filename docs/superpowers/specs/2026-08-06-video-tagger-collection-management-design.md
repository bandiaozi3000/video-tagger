# 收藏夹管理增强设计（v0.11）

## 需求缘起

用户：「收藏夹目前只有新增，没有删除，此外收藏夹目前只有搜索功能。是否能优化，请基于目前主流的收藏夹场景考虑」。

## 现状盘点（读码确认）

**后端**（CollectionController / CollectionService）已完整：
- `GET /api/collections` → `CollectionSummary(id, name, mediaCount)`（媒体数已带，前端未用）
- `POST /api/collections`（新增）、`DELETE /api/collections/{id}`（级联清理关联，**媒体保留**）
- `GET /api/collections/{id}/media`（内容，支持 status/confirmed）
- `POST /api/collections/{id}/media`（收藏）、`DELETE /api/collections/{id}/media/{mediaId}`（取消）
- **缺：重命名接口**（无 `PUT`）

**前端**（app.js / index.html）：
- 工具栏「＋新建收藏夹」→ collection-modal 创建（`createCollectionFromToolbar`/`saveCollectionFromModal`）
- 筛选下拉 `filter-collection`（`fillFilterCollections`）
- 媒体详情页 `renderDetailCollections`：checkbox 勾选/取消收藏 + 内联新建
- **缺**：删除入口（后端接口有了前端没接）、重命名、独立管理视图、卡片快捷收藏

## grilling 拍板（2026-08-06）

1. **管理入口**：独立「收藏夹」tab（第 6 个导航，风格对齐「标签」tab）
2. **删除语义**：只解除关联，媒体保留（主流，B站/YouTube 同款）
3. **重命名**：要（后端补 `PUT /api/collections/{id}`）
4. **卡片快捷收藏**：要（媒体卡片 hover 弹出收藏夹下拉，勾选即收藏/取消）

## 设计

### 后端（改动小）

**重命名** `PUT /api/collections/{id}`，body `{"name": "..."}`：
- `CollectionService.rename(id, name)`：name 空/空白 → `IllegalArgumentException`（400，复用全局处理器）；不存在 → `NoSuchElementException`（404）
- 复用 `requireCollection`；只更新名字，不动关联
- CollectionControllerTest 补：正常改名 / 空名 400 / 不存在 404 三例

### 前端

#### 1. 导航 + 视图（index.html / app.js）
- 导航加第 6 个 tab `data-view="collections"`，图标用书签（★ 或折叠标签），文案「收藏夹」
- 新增 `<section id="view-collections" class="view" hidden>`：顶部 media-toolbar（右：「＋新建收藏夹」btn-primary）；下方左右分栏 `.collection-manage-layout`：
  - 左 `.coll-list`：收藏夹列表（每项：名称 + 媒体数 + ✎重命名 / 🗑删除按钮，选中高亮）
  - 右 `.coll-content`：`#coll-content-head`（当前收藏夹名 + 媒体数）+ `<section id="coll-media-grid" class="media-grid">`（复用媒体卡片）
  - 底部 `.status` `#coll-status`
- app.js：
  - `views` 注册 `collections: getElementById('view-collections')`
  - `showView` 里 `if (name === 'collections') loadCollections()`
  - `loadCollections()`：拉 `/api/collections` → `renderCollList`；保持选中 id（默认第一个/上次）；拉内容
  - `selectCollection(id)`：切换选中 + `loadCollMedia(id)`

#### 2. 列表操作闭环
- **重命名**：列表项「✎」→ 复用 `collection-modal`，标题动态改「重命名收藏夹」，`saveCollectionFromModal` 区分 mode（新增 POST / 改名 PUT）；保存后刷新列表 + 筛选下拉 + 若正在展示该夹则刷新内容
- **删除**：列表项「🗑」→ `showConfirm`（"删除收藏夹「X」？其内媒体将保留，仅解除关联"）→ `DELETE /api/collections/{id}` → 刷新列表 + 筛选下拉；若删除的是当前选中夹，回退选第一个
- **新增**：工具栏「＋新建收藏夹」→ collection-modal（复用现有）

#### 3. 内容浏览
- `loadCollMedia(id)`：`GET /api/collections/{id}/media` → `renderMediaGrid(list, collMediaGridEl)`（renderMediaGrid 参数化容器）
- 空收藏夹提示占位文案
- 媒体卡片点击进详情（复用现有 `openMediaDetail`）

#### 4. 卡片快捷收藏（renderMediaGrid 增强）
- 每个媒体卡片封面右上角加「♡ 收藏夹」按钮（hover 浮现，样式对齐 `.media-del-btn`）
- 点击 → 弹收藏夹下拉浮层（绝对定位在按钮下，样式对齐补全下拉 `.ac-list`）：
  - 打开时 `fetch('/api/media/' + a.id)` 拿 `collectionIds`（MediaDetail 已有）→ 渲染全部收藏夹 checkbox，勾选态即时映射
  - 勾选 → `POST /api/collections/{id}/media`；取消 → `DELETE /api/collections/{id}/media/{mediaId}`（复用详情页同款请求）
  - 点外部/再点按钮收起
- 收藏夹下拉与批量删除模式互斥（batch-mode 下隐藏收藏按钮，避免叠按钮）

## 边界与交互闭环

- 删除收藏夹后：筛选下拉、收藏夹列表、详情页勾选区（下次渲染时自然消失）同步刷新
- 重命名后：筛选下拉与详情页勾选区的名字随之更新（刷新即生效）
- 卡片快捷收藏的状态以 `GET /api/media/{id}` 的 collectionIds 为准（每次打开实时拉取，避免脏缓存）
- 空名重命名/重复名：只校验非空（与新增一致），重名不做拦截（收藏夹本就允许重名）

## 版本建议

0.10.0 → **0.11.0**（新功能）。检索质量优化（上下文增强/同义词/BM25/评测集）继续顺延。
