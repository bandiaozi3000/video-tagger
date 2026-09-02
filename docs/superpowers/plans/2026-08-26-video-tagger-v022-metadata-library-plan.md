# v0.22 番剧资料库与片段资产化实施计划

- **日期**：2026-08-26
- **版本**：v0.22.0
- **状态**：同步中心 UX 重构 G7-G13 已实现；真实 Bangumi 与 Electron 外部黄金路径待补验
- **主设计**：`docs/superpowers/specs/2026-08-26-video-tagger-v022-metadata-library-design.md`
- **最后更新**：2026-08-29（G7-G13 实现与 Web 验收）

## 1. 实施原则

1. 继续使用现有 Spring Boot + MyBatis + SQLite/MySQL 双库，不引入 Room 或 Animeko 运行时。
2. 搜索和本地浏览只读本地；外部网络只由用户明确触发的同步任务访问。
3. 先预览、后一次确认；预览不创建用户实体，确认幂等。
4. 外部资料和用户字段隔离；失败保旧；远程集变化不破坏历史 Clip。
5. v0.22 只做元信息和上下文，不做远程视频源获取。

## 2. 阶段

### G0 迁移门禁

- 核对生产 SQLite v02-v04 与测试资源一致性，迁移测试必须使用生产 classpath 资源。
- 覆盖新库、旧 user_version、已有高光表的迁移回归。
- 新增 MySQL V23、SQLite v05，更新 SQLite 基线与 MigrationTool 表/列清单。

### G1 资料模型

- 新增 `MediaEntry`、`ExternalWork`、`ExternalEpisode`、`ExternalRelation`、同步任务/候选实体及 Mapper。
- Episode 增加 `media_entry_id`、本地标题覆盖标记，允许远程集无 URL/videoFp。
- 保留历史 ID 与 `clips.episode_id`，为旧媒体建立 LEGACY 条目或保留兼容回退。
- 扩展详情 DTO、Episode 查询、MediaService merge/trash/restore/purge 和 embedding 触发。

### G2 Bangumi Provider

- 定义 `MetadataProvider`、`ProviderQuery`、规范化记录和能力描述。
- 实现 Bangumi HTTP Provider：指定作品、年份、季度、详情、集、关系、分页、超时、429/5xx 退避和坏响应处理。
- Provider 不做视频请求；AniList/omofuna 旧实现保持兼容但不作为 v0.22 主入口。

### G3 预览/确认任务

- 新增持久化任务和候选状态。
- 实现 provider capability、预览、任务查询、批量确认和当前媒体刷新 API。
- 外部 ID 优先；旧媒体标题相似只生成候选。
- 任务状态可恢复；确认重复提交不重复导入。

### G4 导入与集对齐

- 确认后事务性创建/关联 Media、MediaEntry、Episode。
- 远程新增集自动创建；改号、消失、冲突保留并标记。
- 严格保护个人标题、备注、评分、状态、标签、收藏、封面、视频字段和 Clip。
- 关系只保存，不递归导入。

### G5 媒体页 UI

- 复用 `#media-sync-modal`、年份 chips、媒体批量选择和统一确认弹层。
- 增加指定番剧、季度选择、预览候选、全选/跳过/关联/创建和一次确认导入。
- 媒体详情显示外部来源、ID、同步状态/时间/错误和外部资料；Episode 显示异常状态。
- 统一 provider label，更新 Bangumi 角标和 cache-bust；不增加首页。

### G6 验证与文档

- MockWebServer Provider 测试：分页、年份/季度、字段、坏 JSON、429、超时、失败保旧。
- 服务/API 测试：候选、确认幂等、外部 ID 冲突、Episode 对齐、用户字段隔离、任务状态码。
- SQLite/MySQL 迁移和 MigrationTool 验证；Node 语法、diff 检查。
- agent-browser 验收空库导入、已有媒体刷新、取消无写入、失败保旧、集异常和本地搜索不联网。
- 同步本 spec/plan、worklog、CHANGELOG、story、README/API 说明和必要项目记忆。

## 3. 关键文件

```text
backend/src/main/java/com/videotagger/entity/{MediaEntry,ExternalWork,ExternalEpisode,ExternalRelation,MetadataSyncTask,MetadataSyncCandidate}.java
backend/src/main/java/com/videotagger/mapper/*Metadata*.java
backend/src/main/java/com/videotagger/metadata/**/*.java
backend/src/main/java/com/videotagger/controller/MetadataSyncController.java
backend/src/main/resources/db/migration/V23__metadata_library.sql
backend/src/main/resources/db/migration-sqlite/v05.sql
backend/src/main/resources/db/sqlite-schema.sql
backend/src/main/resources/static/{index.html,app.js,app.css}
```

## 4. 明确不做

- Animeko Ani API、播放器、Torrent、WebView、AGPL 源码复制。
- Ikaros/Animeko/其他远程视频源发现、下载、播放、裁剪和时间码校准。
- 新首页、普通搜索联网、自动后台刷新、关系作品递归导入、逐部确认。
- 外部资料覆盖用户资料或基于标题自动绑定旧数据。

## 5. 发布门禁

未通过双库迁移、预览零业务写入、确认幂等、用户字段隔离、失败保旧和浏览器黄金路径前，不标记 v0.22 完成，也不自动升级桌面版产品版本号。

## 6. 同步中心 UX 重构实施计划（G7-G13）

### G7 查询正确性与接口基线

目标：先保证“查全”和“预览零写入”，避免在错误数据源上构建新 UI。

- 修正 Bangumi `/v0/search/subjects` 分页：`limit/offset` 放 URL，筛选放 JSON body。
- 解析响应 `total`，使用实际返回数量推进 offset；无 `total` 时仅空页结束。
- 增加 external ID 去重、最大页数、最大结果数和重复页保护。
- 区分批量预览上限 1000 与单媒体搜索上限 20；移除 `search()` 被单页上限错误截断的隐含行为。
- 明确 `preview` 只返回候选，不写正式 `ExternalWork/Media/MediaEntry/Episode`。
- 为 10/20 条上游单页、total、多页、重复页、空页和异常页补 MockWebServer 测试。

关键文件：

```text
backend/src/main/java/com/videotagger/metadata/BangumiMetadataProvider.java
backend/src/main/java/com/videotagger/metadata/MetadataSyncService.java
backend/src/test/java/com/videotagger/metadata/BangumiMetadataProviderTest.java
backend/src/test/java/com/videotagger/metadata/MetadataSyncServiceTest.java
```

完成门禁：年度/季度 mock 返回超过 20 条时能够拉取完整结果；预览数据库写入为零。

### G8 草稿与后台任务数据模型

目标：重新引入可恢复任务模型。现有 `V24/v06` 已删除旧任务表，不复用已删除结构。

- 新增 MySQL 下一版本迁移和 SQLite 下一版本迁移。
- 新增 `metadata_sync_draft`，只允许一个活动草稿。
- 新增 `metadata_sync_task` 和 `metadata_sync_task_item`。
- 任务项冻结 provider/externalId/action/mediaId/candidateSnapshot。
- 增加状态、阶段、计数、错误、尝试次数、保留截止时间和待人工审核标记。
- 更新 SQLite 基线、`SqliteSchemaMigrator`、MigrationTool 表/列清单。
- 增加成功 30 天、失败/待处理永久保留的清理服务。

建议迁移：

```text
backend/src/main/resources/db/migration/V25__metadata_sync_workspace.sql
backend/src/main/resources/db/migration-sqlite/v07.sql
backend/src/test/resources/db/migration-sqlite/v07.sql
```

完成门禁：新库和 v06 旧库均能迁移；应用重启后草稿与运行/完成任务可恢复。

### G9 同步工作台 API 与任务执行器

目标：把批量同步从前台单次事务改为可追踪后台任务。

- 实现草稿 GET/PUT/DELETE。
- 实现任务创建、列表、详情和完成任务删除。
- 任务创建校验每项动作；冲突或缺少目标的候选拒绝提交。
- 后台执行器逐项处理，单项失败不终止全部任务。
- 已有稳定 external ID 自动更新；CREATE/LINK 保持幂等。
- 自动处理全部只创建无匹配项、更新稳定关联项；标题疑似/冲突标记待人工审核。
- 失败项详情包含阶段、错误、原动作、目标媒体和上次尝试时间。
- 单项重试必须接收用户再次确认后的动作，不提供盲目重试全部。
- 增加任务保留清理和运行中任务删除保护。

建议 API：

```text
GET/PUT/DELETE /api/metadata-sync/draft
POST          /api/metadata-sync/tasks
GET           /api/metadata-sync/tasks
GET           /api/metadata-sync/tasks/{taskId}
DELETE        /api/metadata-sync/tasks/{taskId}
POST          /api/metadata-sync/tasks/{taskId}/items/{itemId}/retry
```

完成门禁：任务关闭页面后继续；重启后状态可查；重复提交/重试不重复创建或关联。

### G10 全屏批量同步工作台

目标：替换 `#media-sync-modal`，建立独立 SPA 视图。

- 新增 `view-metadata-sync`，包含“新建同步 / 任务记录”页签。
- 范围区支持年份、季度、关键词，明确显示当前查询语义。
- 查询后一次保存全部候选快照，不因前端翻页重复访问 Bangumi。
- 候选前端分页 20/50/100，默认 20并记住偏好。
- 实现状态、类型、题材、月份、关键词和已选择组合筛选。
- 默认保持 Bangumi 返回顺序；提供日期、标题、匹配状态、动作排序。
- 紧凑候选卡使用独立 checkbox；所有候选默认不选。
- 全选只作用当前筛选结果当前页。
- 实现右侧详情抽屉和动作修改。
- 实现冲突禁止选择及人工指定目标。
- 实现固定选择汇总和可展开已选清单，支持定位回分页。
- 离开工作台自动保存唯一草稿；恢复与覆盖草稿需要明确入口。

关键文件：

```text
backend/src/main/resources/static/index.html
backend/src/main/resources/static/app.js
backend/src/main/resources/static/app.css
backend/src/main/resources/static/v022-metadata.css
```

完成门禁：100+ 候选分页/筛选/排序无丢选；恢复草稿后状态一致；键盘可操作。

### G11 确认页、自动处理与任务记录

目标：完成从审核到后台任务的闭环。

- 确认页显示创建/更新/关联/跳过/冲突汇总。
- 每组可展开作品清单并返回定位修改。
- 明确展示用户字段保护说明。
- 提交后停留结果页，提供返回媒体库和查看任务。
- “批量自动处理全部结果”放入二级菜单，带风险汇总和二次确认。
- 自动模式跳过标题疑似、多重匹配和冲突。
- 任务记录页展示阶段、进度、结果计数、失败和待人工审核项。
- 失败项先打开详情、修改动作，再确认重试。
- 成功任务支持删除；运行中任务禁止删除。

完成门禁：自动模式零标题误关联；关闭工作台后任务继续；失败项可人工修复并转成功。

### G12 媒体详情内嵌匹配与多条目

**状态：已完成（2026-08-29）。** Web 已验证打开详情不联网、显式搜索、独立单选/正文展开、多条目展示和当前媒体内关联。

目标：把“完善本媒体”从批量工作台中完全拆出。

- 已关联主条目：点击“同步资料”直接刷新，失败保旧。
- 未关联：外部资料区展开内嵌搜索面板，预填标题但不自动联网。
- 单媒体搜索最多 20 条、不分页、不默认选择。
- 候选使用单选列表；点击正文在列表下方展开详情。
- 只允许关联当前媒体，不提供创建新媒体或直接输入外部 ID。
- 关联成功后原地切换为外部资料卡。
- 外部资料区提供“添加其他条目”，每次添加一个 `MediaEntry/ExternalWork`。
- 调整详情 API，使多个外部条目可分主次展示，不再只取第一个 `ExternalWork`。

建议 API：

```text
POST /api/media/{mediaId}/metadata-refresh
POST /api/media/{mediaId}/metadata-search
POST /api/media/{mediaId}/metadata-link
POST /api/media/{mediaId}/metadata-entries
```

完成门禁：打开详情不联网；搜索需显式点击；只能关联当前媒体；多条目展示与刷新正确。

### G13 更换关联、旧集治理与最终验收

**状态：实现完成，外部验收部分待补（2026-08-29）。** Web 已验证旧集默认保留、Clip 项锁定、受保护集高等级确认；真实 Bangumi 成功响应与 Electron 壳因当前网络/依赖环境待补验。

目标：安全处理错误绑定并完成 v0.22 发布门禁。

- 实现更换关联预览：当前条目、新候选、旧关联 Episode 清单。
- 旧集默认全部保留。
- 每集展示 Clip、本地视频、用户标题/备注、标签、封面保护状态。
- 受保护集删除需要额外确认；任何删除不得级联破坏 Clip。
- 更换后旧外部缓存保留但解除主关联；新条目成为主关联。
- 完成 MySQL/SQLite 迁移、MigrationTool、任务恢复和清理测试。
- 浏览器验收批量查询、100+ 分页、跨页选择、筛选、草稿恢复、任务后台运行、失败重试。
- Web/Electron 验收单媒体搜索、直接刷新、添加条目、更换关联和受保护集。
- 更新 README/API、CHANGELOG、story、worklog 和必要项目记忆。

完成门禁：设计 spec 第 26 节全部通过后，才能标记 v0.22 同步中心完成。

## 7. 推荐实施顺序

```text
G7 查询正确性
→ G8 数据迁移
→ G9 后台任务 API
→ G10 全屏审核工作台
→ G11 确认与任务记录
→ G12 单媒体匹配
→ G13 更换关联与总验收
```

不能先只做视觉稿：分页、草稿、跨页选择和后台任务依赖明确的数据状态模型。也不能先删除旧弹窗；在 G10 黄金路径通过前保留旧入口作为开发回退，但发布前必须移除或隐藏。

## 8. 测试矩阵

### Provider

- 上游单页 10 条、20 条、100 条；
- `total` 大于单页、多页结束、空页结束；
- 重复页/重复 ID 防护；
- 429、5xx、超时、坏 JSON；
- 年度/季度/关键词范围。

### 草稿与任务

- 唯一草稿覆盖确认；
- 候选快照和选择状态恢复；
- 任务重启恢复；
- 单项失败不阻断；
- 幂等 CREATE/LINK/UPDATE；
- 成功 30 天清理与遗留永久保留；
- 运行中任务禁止删除。

### 前端工作台

- 20/50/100 分页；
- 组合筛选和排序；
- 当前页全选；
- 跨页选择与定位；
- 冲突禁选和动作修正；
- 详情抽屉；
- 确认页返回修改；
- 草稿离开/恢复；
- 窄屏布局和键盘操作。

### 单媒体

- 已关联直接刷新；
- 未关联显式搜索；
- 不默认选择；
- 只关联当前媒体；
- 多条目添加；
- 更换关联；
- 受保护集删除确认；
- Clip 和用户字段保护。

## 9. 本轮明确不实施的内容

本轮只完成设计与计划，不在同一提交中直接重构同步中心代码。后续实施必须按 G7 起步，先完成分页正确性和回归测试，再进入数据迁移与工作台 UI。
