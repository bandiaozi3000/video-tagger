# Video Tagger 番剧三层打标 · Phase 3 实施方案（分类 + 智能）

> **For agentic workers:** 按任务顺序实施，依赖 Phase 1 / 2。任务清单用 `- [ ]` 跟踪。

**Goal:** 收藏夹与筛选器、待确认批量审核、LLM 后台归组、「看完自动弹」待办落地，功能闭环收尾。

**对应规格：** `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`

**前置依赖：** Phase 1 / 2。

## Global Constraints

- **LLM 归组为后台任务，绝不进入打标主链路。**
- **分类仅筛选，标签才搜索**：筛选器只做过滤，不做语义检索。
- 保持不引前端框架与构建链；统计等延续原生 SVG。

## 3.1 收藏夹

- [x] `collection` / `anime_collection` API（V5 迁移）：CRUD + 挂载 / 卸载（`GET/POST /api/collections`、`GET/POST/DELETE /api/collections/{id}/anime`）。
- [x] 收藏夹整体浏览（按清单列出番剧）；番剧详情「加入收藏夹」勾选 + 新建入口。
- [x] 番剧列表收藏夹筛选下拉。

## 3.2 筛选器

- [x] 番剧列表筛选：状态 / 类型 / 待确认（`GET /api/anime?status=&type=&confirmed=`），`sort=latest` 按最近标记排序。
- [x] 前端筛选栏联动（状态 / 类型 / 收藏夹 / 待确认）。

## 3.3 待确认批量审核

- [x] `anime.confirmed` 标记联动（自动识别建档案 confirmed=0）。
- [x] 待确认筛选 + 详情页「确认档案」按钮（`POST /api/anime/{id}/confirm`）。

## 3.4 LLM 后台归组

- [x] `LlmClient`（OpenAI 兼容 chat，默认关闭，`.env` 注入 `LLM_*`）。
- [x] `GroupingService` 每 10 分钟扫描待确认番剧，粗糙预筛候选 + LLM 判定别名/不同季/不同翻译，命中自动合并（`animeService.merge`）。
- [x] 失败降级静默，绝不进入打标主链路。

## 3.5 看完自动弹（待办落地）

- [x] 扩展监听 `timeupdate`，进度 ≥95% 判定看完；**默认关**、设置页开关（`watchEndPrompt`）。
- [x] 弹「本集看完了，给整集打个标签？」轻提示，按 URL 定位集打标（`POST /api/episodes/by-url/tags`）。
- [x] 防误判：同集本会话仅弹一次。

## 3.6 工程化收尾

- [x] README 功能清单 + 架构更新；CHANGELOG 0.2.0 → 0.3.0；pom 版本 0.3.0。
- [x] 测试补齐：`CollectionServiceIT`（收藏夹 CRUD）、`GroupingServiceTest`（roughMatch 预筛）。
- [x] 后端 80 → 85 个用例全通过。

## 验收总纲

全链路手动验收：收藏夹创建 / 挂载 / 整体浏览 → 番剧列表多条件筛选正确 → 待确认番剧批量审核 / 合并 → LLM 归组后台修正别名与归属 → 看完一集自动弹集级打标（开关可控）→ 全功能文档与版本号齐整。
