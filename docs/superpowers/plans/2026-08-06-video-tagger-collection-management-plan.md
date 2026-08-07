# 收藏夹管理增强实施计划（v0.11）

> spec：`specs/2026-08-06-video-tagger-collection-management-design.md`
> 拍板：独立 tab / 删除只解除关联 / 重命名 / 卡片快捷收藏

## P1 后端：重命名接口

- [x] `CollectionService.rename(Long id, String name)`：空名抛 `IllegalArgumentException`；不存在抛 `NoSuchElementException`；`collectionMapper.updateById` 更新 name
- [x] `CollectionController` 加 `@PutMapping("/{id}")`，body `Map<String,String>` 取 name
- [x] `CollectionControllerTest` 补 3 例：改名成功（verify updateById + 返回）/ 空名 400 / 不存在 404

## P2 前端：收藏夹 tab 骨架（index.html / app.js / app.css）

- [x] index.html：导航加第 6 个 tab（data-view="collections"，书签图标）；新增 `#view-collections` 视图（media-toolbar「＋新建收藏夹」+ `.collection-manage-layout` 左列表右内容 + `#coll-status`）
- [x] app.css：`.collection-manage-layout`（左右分栏，左侧固定宽）、`.coll-list`/`.coll-item`（选中高亮，hover 描边）、`.coll-item-actions`（重命名/删除小按钮）、`#coll-media-grid` 复用 `.media-grid`
- [x] app.js：`views` 注册 + `showView` 接入 + `loadCollections()/renderCollList()/selectCollection()/loadCollMedia()`；`renderMediaGrid` 加 container 参数（默认 `mediaGridEl`）

## P3 前端：列表操作闭环

- [x] 重命名：`saveCollectionFromModal` 支持 mode（create/rename，标题动态）；新增 `openRenameCollection(id)`
- [x] 删除：`deleteCollection(id)` → `showConfirm` → DELETE → 刷新列表 + 筛选下拉 + 选中回退
- [x] 工具栏「＋新建收藏夹」在收藏夹视图也接线（复用 collection-modal）

## P4 前端：卡片快捷收藏

- [x] `renderMediaGrid` 卡片加「♡ 收藏夹」按钮（batch-mode 隐藏）
- [x] 弹收藏夹下拉浮层：打开时 `fetch('/api/media/'+id)` 拿 collectionIds → 渲染 checkbox；勾选/取消即时 POST/DELETE；外部点击收起
- [x] 浮层样式对齐 `.ac-list`
- [x] 收藏夹视图卡片操作 ×（删媒体）→「⇤ 移出收藏夹」（`renderMediaGrid` 加 mode 参数，collection 模式渲染 `media-remove-btn` + `removeFromCollection`，媒体本体保留；删媒体入口收敛媒体页/详情页）

## P5 验证 + 收尾

- [x] `node --check app.js`；`mvn -q compile -o` + 排除 IT 单测
- [x] `mvn process-resources` 同步 target/classes/static
- [x] CHANGELOG/README/版本 0.11.0（ver-chip）
- [x] worklog 追加
- [ ] 待用户：`docker compose build app` 重建 + Ctrl+F5 实测
