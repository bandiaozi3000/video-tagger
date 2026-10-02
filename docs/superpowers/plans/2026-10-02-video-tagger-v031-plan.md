# 标签功能重做 执行计划（v0.31）

- **日期**：2026-10-02
- **对应设计规格**：`docs/superpowers/specs/2026-10-02-video-tagger-v031-tag-rework-design.md`（**待批准**）
- **前置**：当前版本 0.30.0（已归档提交 `769ed56`）；Flyway 最新 **V43** → 本次新增 **V44**
- **执行顺序**：P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10，每阶段结束**必须**跑该阶段验证；P1 完成即可先验「删列后应用仍能启动」这条闭环
- **⚠️ 三条硬性纪律**
  1. **先改代码、再跑 V44**（规格 §3.2）：迁移在应用启动时由 Flyway 执行 → **跑之前必须先停掉 IDEA 里 8080 的旧实例**，否则旧实例读不到 `clips.tag` 列会全线报错
  2. **不要在用户的 IDEA 实例开着时跑 `mvn clean`**（会触发 devtools 重启上下文 → 卡死）；测试一律 `mvn -o test -Dtest=...`，不 clean
  3. 媒体墙筛选谓词有 **5 条 SQL + 导出**必须同改（只加一部分 → 切到最近观看就静默忽略条件）；改完 Java 白名单/参数需**重启后端**才生效

---

## P0 前置：备份与基线（先做，不可跳）

| 步骤 | 命令 / 动作 | 验收 |
|---|---|---|
| P0-1 | `mysqldump` 导出 4 张标签表 → `data/backup/tags-before-0.31.sql` | 文件存在且非空 |
| P0-2 | 导出 `clips.tag` 现存值 → `data/backup/clips-tag-before-0.31.tsv` | 27 行（当前真库） |
| P0-3 | 记录基线计数（`tag` 171 / `media_tag` 173 / `episode_tag` 37 / `clip_tag` 25） | 写入工作日志，供清空后对账 |
| P0-4 | 确认工作区干净、当前提交 = `769ed56` | `git status` 空 |

**注意**：备份监工只留 3 代滚动（约 2–3 小时被覆盖），这份是**单独存档**；**禁止**整库 dump 后随手灌回（`docs/rules.md` §14）。

---

## P1 数据模型：删字符串列 + V44

| # | 动作 | 文件 |
|---|---|---|
| P1-1 | 删 `Clip.tag` 字段 | `backend/src/main/java/com/videotagger/entity/Clip.java` |
| P1-2 | 改 4 处依赖该列的 SQL：`findSimilarByTag`（→ `clip_tag` 交集）、`fullTextSearch`（→ JOIN `tag`）、`countDistinctTags` / `countTags`（→ `clip_tag JOIN tag`）；删 `selectByTagContains` / `updateTag` | `mapper/ClipMapper.java` |
| P1-3 | 新增迁移（清 5 处 + 删列） | `db/migration/V44__tag_rework.sql` |
| P1-4 | 全库搜残留引用（`getTag()` / `setTag(` / `clip.tag` / `c.tag`）逐个处理 | `service/*.java` |

**验证**
- `mvn -o test -Dtest='*Clip*Test,*Recommend*Test,*Search*Test'` 全绿（不 clean）
- **列还在时**先启动一次应用 → 正常（代码已不引用该列 = 兼容新旧库）
- 然后跑 V44（重启后端）→ `SHOW COLUMNS FROM clips` 无 `tag`；四张标签表计数 = 0
- `docs/worklog` 与 `rules.md` 里 `clips.tag` 相关描述同步（§3.3 / §5.3）

**⚠️ 停止点**：V44 是**不可逆**操作，执行前把 P0 的两份备份路径贴给用户确认。

---

## P2 受控后端：唯一写入口 + 校验

| # | 动作 | 文件 |
|---|---|---|
| P2-1 | **新增** `TagLinkService`：`link(type, id, tagIds)` / `unlink(...)` —— 受控校验（id 不存在 → 400）+ 三张关联表写入 + 重嵌入队 | `service/TagLinkService.java` |
| P2-2 | 五个写入口改收 `tagIds`，删除「打标即建词条」逻辑 | `ClipService` / `EpisodeService`（含 `addTagByUrl`）/ `MediaService`（`ensureTag` 删）/ `ReviewClipService` / `AnimekoTagService` |
| P2-3 | 删 `TagSyncService` 全类；删 `TagController.syncAll` + `/api/tags/sync-all` 端点；删 `TagAdminService.rewriteClipTags` | `service/TagSyncService.java`（删除）、`controller/TagController.java`、`service/TagAdminService.java` |
| P2-4 | 前端删「⇄ 同步历史标签」按钮与调用 | `static/index.html`、`static/app.js` |
| P2-5 | `VideoSourceRemapService.confirm` **补抄** `clip_tag` 关联（现存漏抄） | `service/VideoSourceRemapService.java` |

**验证**
- `POST /api/media/{id}/tags` 传名字 → **400**；传合法 `tagIds` → 关联表出现行**且词表不新增**
- 打标后 `episode_tag` / `media_tag` **不再被写入**（同步已删）
- `TagSyncService*Test` 拆除或改写（服务已删）

---

## P3 媒体视角读取：查询期三级并集

| # | 动作 | 文件 |
|---|---|---|
| P3-1 | 新增常量 `MediaMapper.TAG_UNION`（§4 的并集子查询），加进 **5 条 SQL** + `listExportRows`；参数 `tagId` → `tagIds` + `tagMode` | `mapper/MediaMapper.java` |
| P3-2 | `listTagCounts` 改三级并集 + `COUNT(DISTINCT media_id)`（筛选面板选项字典） | 同上 |
| P3-3 | 推荐渲染 / 高光卡的标签来源改走同一并集语义（原 `countByMedia` 的三级并集语义保留，数据源不变，只去掉对同步产物的依赖） | `service/RecommendService.java`、`service/HighlightCardRenderer.java` |
| P3-4 | 统计口径合一：`totalTags` 数词表、`topTags` 数 `clip_tag` | `service/StatsService.java` |

**验证**（规格 §12 的 7–9、14）
- 给某媒体的**一个片段**打标签「回归探针」→ 媒体墙筛它 **命中该媒体**；面板选项里**列得出**且计数 ≥ 1
- 同一标签在**媒体详情标签池看不见**（实体视角各算各的，见 P5）
- 切到「最近观看」tab 条件仍生效；`tagMode=AND`（A 在片段、B 在集）仍命中
- 统计页「标签数」= 标签管理页总数

---

## P4 多标签筛选 UI

| # | 动作 | 文件 |
|---|---|---|
| P4-1 | 媒体墙「标签」维度改多选 + `tagMode`（`全部匹配 / 任一匹配` 分段控件，默认全部）；chip 文案写模式（`且 / 或`） | `static/app.js`（`MEDIA_DIMS` / `dimIsMulti` / `renderFilterChips` / `addCommon`） |
| P4-2 | 推荐编辑器候选库同套语义（`Filter.tagIds` + `tagMode`），维度面板取值来自同一份选项字典 | `backend/remotion/editor/panes.tsx`、`editor/api.ts`、`editor/state.ts` |
| P4-3 | 媒体卡显示前 2 个标签 chip（正反馈） | `static/app.js`（`renderMediaGrid` / `renderMediaRow`） |

**验证**
- OR 结果 ⊇ AND 结果；面板点选不关；chips 可单个 × 掉
- 老草稿/老筛选参数（无 `tagIds`）解析不报错（走默认）

---

## P5 `TagPicker` + 五个打标入口 + 实体视角

| # | 动作 | 文件 |
|---|---|---|
| P5-1 | **新增** `TagPicker`（§5.1 契约：搜索/键盘/chip/「＋新建并打上」/引用数） | `static/app.js` + `static/styles.css` |
| P5-2 | 入口 1/2/3 替换：片段弹窗、集打标弹窗、媒体/集详情标签池 | `static/app.js` |
| P5-3 | 详情页标签池改**实体视角**（媒体池只显示 `media_tag`，集池只显示 `episode_tag`，片段详情读 `clip_tag`） | `TagAdminService.list(mediaId)` / `episodeStats` + `static/app.js` |
| P5-4 | 补全接口统一：`GET /api/tags?prefix=&limit=&mediaId=` 供 `TagPicker` 用；前端全量词表缓存复用 `ensureTagPool()` | `controller/TagController.java`、`static/app.js` |

**验证**：不存在的名字 → 出现「＋新建词条『xxx』并打上」→ 点后词表 +1 **且**该媒体已挂（规格 §12-6）；媒体池不再显示只挂片段/集的标签。

---

## P6 批量打标（媒体页勾选模式）

| # | 动作 | 文件 |
|---|---|---|
| P6-1 | **新增** `POST /api/media/tags/batch {mediaIds, tagIds, action}`（一次事务、幂等） | `controller/MediaController.java` + `TagLinkService` |
| P6-2 | 批量工具条加 `[🏷 标签(n)]`（含 `添加 / 移除` 切换） | `static/index.html`、`static/app.js`（`updateMediaBatchConfirm` / `mediaSelected`） |

**验证**（规格 §12-10/11）：勾 3 部 → 添加 → 3 部全挂且词表只有 1 条；重复执行不报错；移除 → 3 部全摘。
**范围**：只处理已勾选媒体（可跨页累积）；**不做**「按筛选条件全库应用」。

---

## P7 标签管理页（词表运维台）

| # | 动作 | 文件 |
|---|---|---|
| P7-1 | **新增** `GET /api/tags/usage?tagId=`（媒体/集/片段三组使用位置） | `mapper/TagMapper.java` + `TagAdminService` + `TagController` |
| P7-2 | 引用数可点 → 列出使用位置并可跳转（媒体 → 媒体页筛该标签） | `static/app.js` |
| P7-3 | 合并：影响面预览（源 N / 目标 M → N+M）+ 二次确认；目标选择器换 `TagPicker` | `static/app.js` |
| P7-4 | 保留：新增（批量输入 + 去重预览）、改名、删孤儿、批量删 | 不变 |

**验证**：反查数量与真库计数一致；合并后源词条引用归零且目标引用 = N+M；改名后详情/筛选/渲染**无需回写**即生效（字符串列已删）。

---

## P8 片段侧（标签真正被用起来）

| # | 动作 | 文件 |
|---|---|---|
| P8-1 | `/api/clips/media/{id}` 返回体带 `tagIds` / `tagNames` | `controller/ClipController.java` + `ClipBrief`（`editor/api.ts`） |
| P8-2 | `ClipPicker` 每行显示标签 chip + 顶部标签筛选（多选，语义同 P4）+「只看已选/未选」 | `backend/remotion/editor/panes.tsx` |
| P8-3 | 媒体详情页片段列表显示标签（复用同一渲染） | `static/app.js` |
| P8-4 | 相似片段召回改 `clip_tag` 交集（修掉子串误伤） | `ClipMapper.findSimilarByTag` + `SearchService.similar` |

**验证**（规格 §12-12/13）：筛选结果数 = 该媒体下带该标签的片段数；带「恋爱」的片段找相似**不再**命中只有「恋爱番」的片段。

---

## P9 扩展改造（受控不可绕过的前提）

| # | 动作 | 文件 |
|---|---|---|
| P9-1 | 9 个快捷位改「选词条」（存 `tagId`），不再存自由文本 | `extension/options.js`、`extension/options.html` |
| P9-2 | 浮层打标换简化 `TagPicker`（拉词表 + 前缀搜）；提交改 `tagIds` | `extension/content.js` |
| P9-3 | 兼容老 `prefs.quickTags`（字符串）→ 首开时提示重设，不静默丢 | `extension/content.js` |

**验证**：快捷位打标后词表**不新增**词条；老配置不崩。

---

## P10 验收与收尾

按规格 **§12 的 17 条**逐条跑，另加：

| # | 动作 |
|---|---|
| P10-1 | 后端 `mvn -o test`（不 clean）；编辑器 `npm test` + `npx tsc --noEmit` + `npm run build:editor` |
| P10-2 | 真库只读探针：四表计数、面板选项数、统计页口径一致 |
| P10-3 | 写当天工作日志 `docs/worklog/2026-10-02.md`（报错原文 / 探针 / 根因 / 前后对比 / 证据） |
| P10-4 | 文档：标签体系说明写进**本规格**（**不写 `docs/rules.md`** —— 按 2026-10-02 用户新纪律，rules.md/AGENTS.md 只在用户明确要求时新增条目），需要时同步 `AGENTS.md` |
| P10-5 | `CHANGELOG.md` 准备 0.31.0 条目（**待用户确认发布后再写**） |

---

## 回滚与暂停点

| 阶段 | 可回滚性 | 说明 |
|---|---|---|
| P0–P1 代码改动 | 可（`git revert`） | 列未删则完全可逆 |
| **V44 执行后** | **不可逆**（除非用 P0 备份还原 4 张表；`clips.tag` 的 27 行也有 TSV） | 执行前必须用户确认 |
| P2–P9 | 可（每阶段独立提交） | 建议**每阶段一次提交**，便于单点回退 |

**暂停点（等用户确认）**：
1. 本计划批准
2. P0 备份完成 + V44 执行前
3. 每阶段验收结果汇报

---

## 待用户批准

本计划**未批准前不动任何代码**。批准方式：回「执行」/「按计划做」，或指出要调整的阶段。

---

## P11 单页 hash 路由（批次第三部分；用户 2026-10-02 批准执行）

> 规格见同批次主规格 `specs/2026-10-02-video-tagger-v031-design.md` 第三部分。

- [x] **P11.1 路由核心**：`hashOf(route)` / `parseHash(hash)`（纯函数）+ `navigate(route, {replace})`（**唯一写 URL 入口**）+ `lastAppliedHash` 去重，杜绝双写环路
- [x] **P11.2 `applyHash`**：路由 → 复用现成「不入栈」渲染函数（`showView` / `loadMediaDetail` / `loadEpisodeDetail` / `renderClipDetail` / `loadHighlightProject` / `loadTimeline`）
- [x] **P11.3 删内存视图栈**：`viewHistory` / `pushView` / 手写 `goBack` → `history.back()`；`syncBackButtons()` 改判 `history.length > 1`，详情返回文案取 `history.state.from`
- [x] **P11.4 跳转点全部改 `navigate`**：侧栏 tab、`openMediaDetail` / `openClipDetail` / `openEpisodeDetail` / `openHighlightProject` / `openTimeline`、标签页两处（去媒体页筛选 / 在标签页查看）、统计页热门标签 chip、改名/合并/删除后的「回媒体页」
- [x] **P11.5 滚动恢复**：栈里的 `scrollY` → `scrollMemory: Map<view, scrollY>`（离开时记、`applyHash` 落回时用）
- [x] **P11.6 启动**：`startRouting()`（监听 `hashchange` + 应用初始路由）；空/非法 hash 回落 `search`（桌面模式 `media`）并 `replaceState` 成规范 hash
- [x] **P11.7 文档 title 随视图变**（规格 Q2 顺手做）
- [x] **P11.8 验收**：主规格 §6 九条，探针脚本（含 F5 回原页、浏览器后退 = 页内返回、非法 hash 回落、`parseHash`/`hashOf` 往返表）
- [x] **P11.9 收尾**：工作日志 + 主规格状态更新（第三部分 → 已实现）

- [x] **P12 媒体页分组**（第四部分；后端+前端已实现、IT 27 绿；题材/季度/收藏夹待重启实测）：后端补 season/genresJson/collectionIds 三列 → 泛化收藏夹分组三件套 → 媒体页 `分组 ▾` + 全量拉 + 六个维度分组 → 探针验收（4.6 八条）→ 日志/规格状态
