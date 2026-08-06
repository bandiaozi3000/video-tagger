# Video Tagger 标签池（补全上下文化 + 管理页）实施计划

> 日期：2026-08-06
> 设计：`docs/superpowers/specs/2026-08-06-video-tagger-tag-pool-design.md`
> 前置：grill-me 两轮拍板（先A后B 分两期；第一期范围见 spec §3）。
> 版本：本期建议 0.9.0（版本号以用户拍板为准）。

## P1 后端（先做，可独立验证）

| 步骤 | 改动 | 验证 |
|---|---|---|
| P1.1 | `TagMapper` 新增聚合查询：① 全局词条 + 三级 LEFT JOIN 计数（mediaCount/episodeCount/clipCount）② 媒体范围标签（media_tag + episode_tag JOIN episode + clip_tag JOIN clip 按所属媒体收敛）③ 按媒体引用次数分组统计 | 编译 |
| P1.2 | `ClipService.suggestTags` 增强：加 `mediaId` 参数；有 → 媒体已用标签优先 + 全局高频兜底；无 → 从词库三级聚合（取代仅 clips.tag 拆词）。排序：前缀命中>开头>包含，同级次数降序 | 单测 |
| P1.3 | `TagController`：`GET /api/tags` 加 `mediaId` 参数透传 | 单测 |
| P1.4 | 新增 `TagAdminService` + 接口：`GET /api/tags/manage?q=&mediaId=`、`PUT /api/tags/{id}`（改名）、`POST /api/tags/merge`（合并）、`DELETE /api/tags/{id}`（孤儿） | 单测 |
| P1.5 | 改名/合并核心：同一事务内 `tag.name` 更新 + `clips.tag` REPLACE 同步 + 三级关联迁移 + `EmbeddingTaskService.enqueue` 引用实体（同名新词拒绝 → 400 引导合并） | 单测 |
| P1.6 | `POST /api/clips` 保存响应补 `mediaId` 字段（扩展浮层识别媒体用） | 单测 |

## P2 前端（依赖 P1 接口）

| 步骤 | 改动 | 验证 |
|---|---|---|
| P2.1 | `index.html` 导航加第 5 个 tab「标签」+ `#view-tags`（通用池列表 + 搜索框 + 媒体维度下拉 + 改名/合并/删按钮） | 浏览器目测 |
| P2.2 | `app.js`：`loadTags` 渲染词条列表（三档次数 + 最近使用 + 引用媒体）；改名/合并/删走 modal + confirm-modal；合并需选目标标签（搜索） | 浏览器目测 |
| P2.3 | `app.js`：各打标入口补全带 mediaId（片段 edit-modal / 集 episode-tag-modal / 媒体详情加标签；经 currentClip/currentEpisode/currentMedia 解析 mediaId） | 浏览器目测 |
| P2.4 | `app.css`：标签管理页表格/徽标/搜索框/弹窗样式 | 浏览器目测 |

## P3 扩展

| 步骤 | 改动 | 验证 |
|---|---|---|
| P3.1 | `content.js`：保存响应读 `mediaId` 记住；浮层补全 `/api/tags` 带 `mediaId`（无则全局） | 实机打标目测 |

## P4 收尾

| 步骤 | 改动 | 验证 |
|---|---|---|
| P4.1 | 新增单测：suggestTags（全局/媒体优先/排序）、manage 计数、改名（clips.tag 同步+重嵌+撞名 400）、合并（引用迁移+删源+重嵌）、删孤儿（有引用 409） | `mvn test`（排除 IT） |
| P4.2 | pom 版本升至 0.9.0（用户拍板后）；CHANGELOG 追加；README 功能/接口更新 | diff 复核 |
| P4.3 | 静态资源同步 target；worklog 记录当日；spec 决策收尾 | 起服务目测 |

> 验收提示：`docker compose build app` 重建镜像（compose up 不重建）；浏览器 Ctrl+F5 绕过 app.js 缓存。
> 第二期 B（scope 真隔离）未排期，等第一期数据信号，见 spec §8。
