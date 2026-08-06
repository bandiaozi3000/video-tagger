# Video Tagger 标签池设计（通用池 + 补全上下文化 + 管理页）

> 日期：2026-08-06
> 前置：/grill-me 会话两轮拍板（见「决策记录」）
> 目标：让打标补全**按媒体上下文推荐**（治"补全列表脏"），提供**标签池管理入口**（改名/合并/删孤儿，治"标签混乱、无法按媒体梳理"），并顺带解决 v0.9 待办「高然/高燃」标签分裂。
> 版本：建议 **0.9.0**（独立功能版本；若与 v0.9 检索质量冲突，版本号由用户定）。

---

## 1. 现状与痛点

### 1.1 现有标签链路（读码确认）

- **词库**：`tag` 表全局唯一（`INSERT IGNORE`），同名标签跨媒体/集/片段共享词条。
- **三级关联**：`media_tag` / `episode_tag` / `clip_tag` 关联表。媒体/集/片段各自有 `addTag` 逻辑（`MediaService`、`EpisodeService`、`ClipService.linkClipTags`），统一 `tagMapper.insertIgnore` 建词条 + 关联表 insertIgnore。
- **片段标签双写**：`clips.tag` 冗余字符串列（BM25 全文检索用，`ClipMapper` 全文 MATCH 它）+ `clip_tag` 关联表。⚠️ **改名/合并必须同步 `clips.tag` 列，否则检索错乱。**
- **补全**：`ClipService.suggestTags(prefix, limit)` → `clipMapper.countTags(500)` **只统计 `clips.tag` 列按空白拆词聚合**，prefix LIKE 过滤 + count 降序。**媒体/集层标签完全不进补全**；无任何媒体上下文。
- **统计**：stats 页「最常用标签」同样来自 `clips.tag` 拆词。
- **无管理接口**：`TagController` 只有 `GET /api/tags?prefix=&limit=`，无查看/改名/合并/删除能力。

### 1.2 痛点

1. **补全列表脏**：给某媒体打标时，全局无差别推荐，别的媒体的怪标签、媒体/集层标签缺失，都不对味。
2. **标签混乱**：`高然`/`高燃` 这种同义词分裂无处理能力；孤儿词（无引用的词条）堆积。
3. **无法按媒体梳理**：看不到"某媒体用了哪些标签"、"某标签哪些媒体在用"。

## 2. 决策记录（grilling 已拍板）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 落地路线 | **先A后B 分两期**。第一期轻量（补全上下文化 + 管理页）；第二期（真私有隔离 scope）**由数据触发**再上 |
| 2 | 第一期限范围 | 补全上下文化 + 标签管理页；**不引入私有标签 scope**（grilling 验证"默认私有→通用池萎缩"，用户撤回真隔离需求） |
| 3 | 痛点排序 | 补全列表脏 + 标签统一管理 + 按媒体维度管理（不再要求"标签私有隔离"） |
| 4 | 管理页入口 | **独立 tab「标签」**（导航变 5 个：搜索/媒体/时间线/统计/标签） |
| 5 | 扩展侧 | **本期带**：后端保存响应补 `mediaId` + 浮层记住最近媒体、补全带媒体上下文 |
| 6 | "首次/后续"提示 | **不做分支逻辑**——补全按媒体上下文数据驱动自然实现（首次该媒体无已用标签→只剩通用；后续该媒体已用标签排前=用户说的"特有"） |
| 7 | 合并功能 | 顺带解决 v0.9「高然/高燃」标签规范化待办 |
| 8 | 第二期 B 开关 | 跑一段时间后，若管理页/日常打标仍暴露"个别媒体专有词污染全局"→ 再上 scope 真隔离。本期**不预埋任何 scope 代码** |

## 3. 第一期范围

### 3.1 补全上下文化

- `GET /api/tags?prefix=&limit=&mediaId=`（mediaId 可选）：
  - **无 mediaId**（全局，搜索框等场景）：从 `tag` 词库按**三级引用总次数**聚合排序 + prefix 过滤（**取代**现在只统计 `clips.tag` 拆词的逻辑，媒体/集层标签由此纳入全局补全）。
  - **有 mediaId**：该媒体范围已用标签（`media_tag` + 该媒体下所有 `episode_tag` + 该媒体下所有 `clip_tag` 涉及的词条）优先，按该媒体内引用次数降序；**再追加**全局高频兜底（排后面）。
- 排序：前缀精确命中 > 前缀开头 > 其它包含；同级按次数降序。
- 触发端：
  - Web：片段编辑（edit-modal `#edit-tag`）、集打标（episode-tag-modal `#episode-tag-input`）、媒体详情加标签——补全请求带当前 `mediaId`。
  - 扩展：`POST /api/clips` 保存响应补 `mediaId`；浮层内记住最近保存的 mediaId，`/api/tags` 补全带上（同一页面连续打标生效；新页面首次打标前无媒体上下文 → 全局兜底）。

### 3.2 标签管理页（新 tab「标签」）

**通用池视图**：
- 全词条列表：名称 + **三档引用次数**（媒体/集/片段）+ 最近使用时间 + 搜索过滤（前缀/包含）。
- 操作（确认交互复用现有 `confirm-modal` / `modal` 体系）：
  - **改名**：弹窗输入新名 → 更新 `tag.name` + **同步所有 `clips.tag` 列内该词** + 收集引用实体入队重嵌；若新名与既有词条重复 → 提示走「合并」。
  - **合并**（高然→高燃）：选择源标签 + 目标标签 → 源词所有引用（三级关联表 + `clips.tag` 字符串 REPLACE）改挂目标 → 删源词条 → 收集涉及实体入队重嵌。
  - **删孤儿**：仅无任何引用（三级关联计数全 0）的词条可删；被引用时禁用并提示。

**按媒体维度视图**：
- 媒体下拉（或从媒体页进入）→ 显示该媒体的标签：媒体级、集级、片段级分组 + 各层引用数。

## 4. 数据模型

**本期零表结构变更**（无 Flyway）。全部标签即"通用池"，现有数据即默认词库。

`clips.tag` 冗余列同步是本期的**一致性核心**（见 §6 风险）。

## 5. 后端接口

| 接口 | 说明 |
|---|---|
| `GET /api/tags?prefix=&limit=&mediaId=` | 补全（增强）：有 mediaId → 媒体已用标签优先 + 全局兜底；无 → 全局三级聚合 |
| `GET /api/tags/manage?q=&mediaId=` | 管理列表：词条 + mediaCount/episodeCount/clipCount + 媒体维度（带 mediaId 时） |
| `PUT /api/tags/{id}` body `{name}` | 改名：更新词条 + 同步 `clips.tag` + 重嵌引用实体；新名冲突 → 400 提示走合并 |
| `POST /api/tags/merge` body `{fromId, toId}` | 合并：源→目标迁移全部引用 + 同步 `clips.tag` + 删源词条 + 重嵌 |
| `DELETE /api/tags/{id}` | 删孤儿：仅三级引用全 0 可删；否则 409 |

实现要点：
- 新增 `TagMapper` 聚合查询（三级 LEFT JOIN 计数；媒体范围标签：`media_tag`/`episode_tag JOIN episode`/`clip_tag JOIN clip` 按所属媒体收敛）。
- 改名/合并重嵌：经 `EmbeddingTaskService.enqueue` 入队所有引用实体（三级各自的 EntityType+id）。
- `clips.tag` 同步：`UPDATE clips SET tag = REPLACE(tag, ?, ?) WHERE tag LIKE '%word%'`（合并）；改名同构。
- 媒体 merge（现有 `MediaService.merge`）沿用：目标媒体标签池自然合并，本期不动其逻辑。

## 6. 风险与注意

1. **`clips.tag` 双写一致性（最高危）**：改名/合并漏同步 → BM25 检索仍命中旧词。必须同一事务内完成 `tag` 表 + 关联表 + `clips.tag` REPLACE。
2. **重嵌成本**：改名/合并触发引用实体重嵌（向量文本含标签文本）。数据量小可接受；重嵌是异步任务，界面提示"标签已更新，语义检索稍后生效"。
3. **补全语义变化**：全局补全从"clips.tag 拆词"改为"词库三级聚合"，排序/结果会变（媒体/集标签进入补全 = 预期改善）。测试要覆盖。
4. **同名词条**：`INSERT IGNORE` 保证全局 name 唯一；改名若撞已有词条必须拒绝并引导合并（否则唯一性破功）。
5. **前端入口上下文**：Web 各打标入口需知道当前 mediaId（集打标经 currentEpisode→mediaId；片段编辑经 currentClip→episode→media；媒体详情直接用 currentMedia.id）。

## 7. 测试计划

- **后端单测**（新增，Mockito / 排除 IT）：
  - `suggestTags`：无 mediaId 全局聚合；有 mediaId 媒体标签优先 + 全局兜底；prefix 排序。
  - `manage`：三级计数正确；mediaId 维度过滤。
  - 改名：`tag.name` 更新 + `clips.tag` REPLACE 生效 + 重嵌入队；撞名返回 400。
  - 合并：引用迁移（三级关联表 + clips.tag）+ 源词删除 + 重嵌入队。
  - 删孤儿：有引用 409；无引用删除成功。
- **前端**：静态资源 `mvn process-resources` 同步 target；起服务目测新 tab 与补全（`docker compose build app`）。
- **扩展**：保存响应带 mediaId；浮层补全带媒体上下文。

## 8. 第二期 B（真隔离，未排期）

触发信号：第一期落地后，若管理页/日常打标仍暴露"个别媒体专有词确实需要隔离出全局补全"。
改造点（届时单独 spec）：`tag` 表加 `scope TINYINT(0=通用/1=私有)` + `media_id BIGINT DEFAULT 0`，唯一索引 `(name, scope, media_id)`（⚠️ 不能含 NULL，见 grilling 坑①）；打标新词默认私有 + 一键转正；检索 scope 过滤（私有标签"跟着媒体走"）。
