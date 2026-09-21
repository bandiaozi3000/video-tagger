# 协作规则与约定清单

> 汇总本项目已确立的**协作规则 / 约定**（源自长期记忆，type: feedback），供快速查看与溯源。
> 记忆载体：2026-09-03 起（Pi 环境）跨会话记忆 = 项目根 `AGENTS.md`（每次启动自动加载）+ 本清单；旧 `~/.claude/projects/.../memory/` 不再被自动读取。
> 维护约定：规则变更时，同步更新本清单 + `AGENTS.md`。

---

## 一、协作流程类

### 1. 问题清单流程
- **记忆**：`video-tagger-test-issue-flow`
- **内容**：使用中碰到的问题按日记入 `docs/testing/issues.md`（单文件按日期分组，编号 #N 全局递增）。
  - 状态：待修复（默认）→ **累计满 5 个主动提醒、确认后批量修复** → 修复后记变更（commit/内容/版本）。
  - 紧急问题用户指定「立即修复」，不等累计。
  - 严重度 🔴 严重 / 🟧 一般 / 🟨 轻微（只标注影响，不决定节奏）。
  - **先验证再修**：验证非 bug（操作不当/理解偏差）→ 告知原因 + 归档「非 bug（无需修复）」，不入待修队列。
- **相邻**：功能需求 → `docs/testing/feature-requests.md`；疑问 → `docs/testing/test-qa.md`。

### 2. 版本决策规则
- **记忆**：`version-upgrade-decision-rules`
- **内容**：功能/代码变更落地后判断大小——
  - 小改动 → 不问、不升，记入当前版本。
  - 大改动 / 拿捏不准 → 主动问用户要不要升版本。
  - 用户明确说升级 → 直接升。
  - 文档（CHANGELOG/story）每次改动当场更新；**升版时精简概括**防冗余。
  - 纯流程/文档类改动不问版本。

### 3. 技术文档沉淀
- **记忆**：`ask-before-writing-learn-doc`
- **内容**：`docs/learn/technology.md` 单文件按日期分组（仿 issues.md：头部机制 + 目录索引 + 记录模板 + 日期分段）。
  - 记录内容：**业务场景 / 痛点 / 怎么解决 / 原理 / 涉及技术**。
  - 触发：牵扯特定技术、偏技术需求、或拿捏不准 → **先问用户再写，不擅自创建**。
  - 旧复盘内容重叠可合并提炼到最新日期段并删除旧件。

### 4. 先验证再执行
- **记忆**：`verify-before-logging-issues`（同步于全局 CLAUDE.md「协作要求」节）
- **内容**：用户的问题/要求先质疑、验证合理性再执行；确认为 bug/需求/疑问才分类入库；误解/操作不当当场指出，不入库。

### 5. grill 确认后直接开工
- **记忆**：`grilling-confirmed-proceed-directly`
- **内容**：grill-me 已逐项拍板的决策视为授权完成——直接写 spec + plan → 建任务开工，不再反复问「要不要写文档/开工」。

### 5b. 确认制：解释 → 决策 → 明说执行 → 才动手（2026-09-03 用户强调）
- **记忆**：`confirm-before-start-on-change`（2026-08-10 建立，rules.md 曾漏录已补）
- **内容**：用户提问题/疑问 → 只**分析/回答**（现状/可行性/方案/利弊），不改代码；用户了解后**明确说「执行」或指出方向**才动手；执行中遇决策点停下等拍板。「方案已 grill 确认」≠ 开工许可，动手改码前仍需单独确认。已同步至项目根 `AGENTS.md`（Pi 自动加载）。

### 5c. 小改动免规格/计划（2026-09-19 用户明确）
- **内容**：**局部 UI 调整、单点修复、小范围重构**这类改动 → 想清方案、**用户在对话里点头后直接执行**，不写 `docs/superpowers/specs/` 设计规格、不写执行计划；收尾照旧写工作日志。
- **仍需规格+计划**：新项目、跨模块/架构型需求、动数据结构或对外契约、需要多轮验收的大功能。
- 拿不准算大还是小 → 问一句，别默默按小的做。已同步至工作区 `AGENTS.md`。

---

## 二、文档 / 日志类

### 6. 每日工作日志
- **记忆**：`daily-worklog-and-todo-flow`
- **内容**：每次改动收尾后写当天 `docs/worklog/YYYY-MM-DD.md`（无则建/有则追加），记录**讨论 → 执行全流程**（决策、改动要点、测试结果、遗留待验证）。todo 存 `docs/TODO.md`，**仅用户人工告知时更新**，AI 不主动维护。

### 7. 版本叙事
- **记忆**：`storyline-on-version-update`
- **内容**：每次版本收尾时向 `docs/story.md` 追加叙事段（上一版痛点 → 这版做了什么 → 延续），2~5 句，不抄 CHANGELOG。

### 8. 记忆三处同步
- **记忆**：`memory-index-sync-on-update`
- **内容**：更新记忆文件后，必须同步 **正文 / frontmatter description / MEMORY.md 索引行** 三处，grep 验证零残留，避免过期状态误导。

### 9. 大版本主文档归档
- **记忆**：`version-master-doc-policy`
- **内容**：每个大版本归入 `docs/` 下的一份主需求/设计文档；同一版本后续需求变更、新增、方案调整和实现状态持续同步该主 spec，并同步唯一配套 plan、worklog 和必要的 CHANGELOG/story；不创建互相漂移的零散主文档。

---

## 三、UI 设计规范类

### 10. UI 参考主流设计
- **记忆**：`ui-reference-mainstream-design`
- **内容**：功能设计时交互/界面参考主流产品（排序=维度+升降序、筛选折叠+重置、分页+空态等），功能不只实现就好，交互完整才算完。

### 10. 弹窗 16:9 规范
- **记忆**：`ui-modal-169-convention`
- **内容**：弹窗统一 `.modal.modal-169`（16:9 宽屏）；内容多列卡片铺开；列表类弹窗支持批量操作（勾选/全选/批量删除）。

---

## 四、全局规则（CLAUDE.md，跨项目生效）

- **傲娇（ツンデレ）口吻**：以钉宫理惠配音角色的傲娇口吻回复，偏傲（被使唤/被批评）/偏娇（顺利/求助）按情境切换。
- **先质疑，再执行**：任务不合理/有歧义/有更好做法 → 及时反馈，不盲从；用户报告的问题先验证再动手。

---

## 附：记忆库其他类别（非规则，供了解规模）

- **环境/踩坑类**（6 条）：embedding 环境变量、静态资源 target 复制、Maven 多构造器/离线编译、Milvus 阈值 baseline、Docker 旧镜像、本机 Spring/Maven 坑。
- **项目/功能知识类**（15 条）：`video-tagger-project-map` 总览 + v0.3~v0.17 各期功能决策记忆。

> 规则若有增改，请在更新对应记忆的同时刷新本清单。

### 11. UI 层真实链路验收
- **记忆**：`ui-browser-acceptance-required`
- **内容**：功能完成后必须启动实际应用并使用浏览器操作真实页面；验收应覆盖用户入口、点击交互、异步状态、候选选择，以及直接播放/源站跳转等完整黄金路径。后端测试只能作为补充，不能替代 UI 验收；发现 UI 不可执行时先记录并修复，再重复浏览器验证。

### 12. UI 默认沿用当前网站风格
- **记忆**：`ui-style-consistent`
- **内容**：新增页面、工作台和复杂交互默认复用当前网站的颜色变量、字体、渐变、表面层级、边框、圆角、间距、按钮、表单、弹窗、状态反馈、动效与响应式规则，不另建割裂的视觉体系。参考 Animeko 等产品时只借鉴功能结构和交互效率，视觉仍落回 Video Tagger 当前风格；除非用户明确要求改版，禁止引入独立主题或第三方默认皮肤。

---

## 五、数据 / 兼容性类

### 13. 桌面轨道冻结：不删不维护，将来一次性全量重建（2026-09-17 用户拍板）

- **背景（实测）**：桌面端 = Electron 壳 + SQLite 数据源；而日常开发跑的是 **MySQL**（`.idea/workspace.xml` 里 IDEA 启动参数带 `--spring.profiles.active=mysql`），`data/video_tagger.db` 自 2026-08-26 起未再被写入。用户确认：桌面端几乎不用，且 SQLite 里的旧数据不要。
- **规则**：牵扯桌面的代码 **保留不删**（留给将来回头的路），但**不再同步维护**：
  - 不写 `migration-sqlite/vNN.sql`、不更新 `sqlite-schema.sql` 基线、不改 `MigrationTool` 表/列清单、不改 `SqliteSchemaMigratorTest` 版本断言。
  - 不打包（`pack.bat`）、不跑桌面验收（`VT_SCREENSHOT`）、不升 `desktop/package.json` 版本号。
  - 不主动去"修复"桌面包或 `desktop/` 下的脚本。
- **不加成本但需避开**：`body.desktop-mode` 布局依赖 `#titlebar` / `.sidebar` / `.statusbar` / `.container` 四个容器（类名，见 `index.html`）。改 `index.html` 大结构时保留它们——这是唯一"每天在动 + 无任何报错 + 将来要重写"的项。
- **不属于冻结范围（勿误删）**：`sqlite-jdbc` 依赖、`AnimekoTagService` / `AnimekoWatchImportService` / `AnimekoTagServiceTest` / `AnimekoWatchImportServiceTest`——它们用 SQLite JDBC 当**客户端**读 Animeko 自己的库（现场打标 / 观看导入），与桌面数据源无关。
- **解冻条件**：真的要用桌面端时。解冻动作（前提：MySQL 为唯一真源，桌面本地数据视为弃）：
  1. 补 `db/sqlite-schema.sql` 到当前 MySQL 结构（新增表/列）；
  2. 补 `MigrationTool` 的表清单 + 每表 SELECT 列清单——**欠着 `highlight_project` / `highlight_project_item` / `highlight_export` 三张表**（自 2026-08-14 建工具起从未进过清单，漏了不报错）；
  3. 审计 9 对 mapper 方言（`MybatisConfig` 的 `databaseId` 分支）之外新增的 MySQL 专有 SQL；
  4. 跑 `MigrationTool` 全量重建（fat jar 须用 `PropertiesLauncher`，命令见 `worklog/2026-08-26.md`）；
  5. 重建 `desktop/resources/`（jre/node/chrome/ffmpeg，现均缺失，`pack.bat` 会直接报错）+ 重新打包。
- **已知按设计不做**：向量检索（Milvus 摘除，纯关键词 LIKE 兜底，见 `design/2026-08-14-desktop-port.md`）。
- **同步位置**：本条同时写入项目根 `AGENTS.md` §1「桌面轨道冻结」；AGENTS.md §2 的「双库演进」改为"已冻结"。

### 14. 验证副本：别拿 `mysqldump --databases` 的 dump 直灌别的库名（2026-09-20 踩过，真库被覆盖过一次）

- **坑**：`mysqldump --databases video_tagger` 产出的备份里**第 24 行就是 `USE \`video_tagger\`;`**（`data/backup/*.sql` 全是这种）。把它 `mysql <目标库> < dump.sql` 灌进"验证副本"时，`USE` 会**把会话切回真库** → 整份 dump（含 `DROP TABLE`）落在**真库**上，真库被回退到备份时刻。
- **正确做法（任选其一）**：
  - `docker exec vt-mysql sh -c "mysqldump -uroot -p*** video_tagger" | docker exec -i vt-mysql mysql -uroot -p*** <目标库>`（**不加 `--databases`**，不带 `USE`）；
  - 或导入时用客户端过滤：`mysql --one-database <目标库> < dump.sql`；
  - 或先 `sed '/^USE /d; /^CREATE DATABASE/d'` 再灌。
- **回滚手段（binlog 没关就有救）**：`binlog_format=ROW` + 未过期 → 用一次性容器跑 `mysqlbinlog` 取「出问题那段之前」的事件回放（镜像用 `mysql:8.0-debian`，官方 `mysql:8.0/8.4` **不带** mysqlbinlog）：
  `docker run --rm -e TZ=Asia/Shanghai -v video-tagger_mysql_data:/var/lib/mysql:ro mysql:8.0-debian sh -c "mysqlbinlog --database=video_tagger --start-datetime='...' --stop-datetime='...' /var/lib/mysql/binlog.0000NN > /out/seg.sql"`。
  **必须显式传 `TZ`**：不传时容器按 UTC 解释 `--start/stop-datetime`，过滤结果为空（看着像"这段时间没写入"，会误判）。
- **动手前先确认副本真的是副本**：导入后立刻 `select count(*)` 对比真库（本次就是靠 `clips` 9 → 10 才发现）。
- **验证实例三条命令**（把风险关在副本里）：`--spring.profiles.active=mysql` + `--spring.datasource.url=.../<副本库>` + `VT_DATA_DIR=<副本目录>`（后者顺带隔离 `video-assets`/封面等文件写入）。

### 15. 推荐片段可以「跨媒体借」：`mediaClips.sources` 契约（2026-09-20）

- **语义**：`mediaClips[媒体Id] = { order: [clipId…], badge, sources?: { clipId: 来源媒体Id } }`。
  - `sources` **可选**：缺省 / 不含该 clipId = **本体片段** → 旧草稿、旧模板、旧预设行为与升级前完全一致，**无需迁移**。
  - 只用它来表达「推荐位是《A》，片段来自同系列《A OVA》」这种场景（Bangumi 上是两个条目 → 库里两个 media）。
- **允许的来源**：`RelatedMediaService.VIDEO_RELATION_TYPES` 白名单（主线故事/前传/续集/番外篇/剧场版/角色出演/同一世界观）里、**本地存在且有片段**的条目；**故意不含「其他」**这种 catch-all（否则广播剧/角色歌/CD 全会被列出来）。改白名单只改这一个常量。
- **解析链**：`external_relation`（不是解析 `relations_json`）→ `related_external_id` 反查本地 `external_work.media_id` → `GET /api/media/{id}/related` 给编辑器用。
- **渲染侧为什么不用改全局索引**：借来的片段被放进**卡片媒体的 `clips` 数组**（视图里多一个 `sourceTitle` 字段），于是 `plan.ts` / `scene-plan.ts` 的 `media.clips.find(...)` 天然命中。**别把来源媒体塞进 `ids`** —— 它不该出现在片单里。
- **移除要连带**：`withoutClip()`（`editor/clip-refs.ts`）在删片段时**同步删 `sources[clipId]`**，否则留下悬空键。
- **校验三条文案分开**（`RecommendClipSourceService.loadClips`）：库里没有 → `片段不存在`；无 sources 且不属本体 → `片段不存在或不属于所选媒体`；来源无视频类关联 → `片段 #N 与《本体》没有视频类关联`。
- 规格与计划：`docs/superpowers/specs/2026-09-20-cross-media-clip-source-design.md`、`docs/superpowers/plans/2026-09-20-cross-media-clip-source-plan.md`。

### 16. 「同步番剧」= 弹窗直连流程（2026-09-21 用户拍板简化，勿复活旧工作区）
- **内容**：从 Bangumi 同步只有**一个弹窗**：年/季/月**多选** → 拉取候选 → 勾选 → 直接同步 → 显示条数。**不再有**独立审核工作区、后台任务表、逐项重试、跨会话草稿（V38 已把 `metadata_sync_task*` / `metadata_sync_draft` 三张表删掉）。
- **筛选语义**：年 = 限定符（可多选）；季/月 = 可选细分（选了就只查细分，年作限定）；没选细分 = 整年。区间在**后端** `SyncRangePlanner` 归一：同季内相邻月合并、**超过 3 个月按自然季度切开** —— 因为 Bangumi `total` 硬上限 1000（按年会撞顶，按季不会），且**同一请求多段 `air_date` 会 AND 成 0 条**，所以必须逐段请求。
- **匹配与动作**：`EXTERNAL_ID`→UPDATE、标题/别名**唯一精确**命中→LINK（都是"更新"）、`NONE`→CREATE、命中多个→**SKIP**（交人工，绝不自动关联）。
- **「不动本地数据」的含义**：更新路径只写 `media_entry` / `external_work` / `external_episode` / `external_relation` + **只补缺失的** `episode`；`media` 的标题/年份/备注/评分/状态/标签/封面**一律不写**（新增时才建 media）。
- **不做**：标题模糊匹配（实测「剥掉第N季/幕/期比基名」零增益，且误关联代价更大）；媒体详情里的单条刷新/换绑/关键词搜索保持原样。
- **注意**：AniList / Omofuna 的同步**入口**虽已废弃，但它们的代码与 `media.source` 数据**在用**（`SearchService`/`RecommendService`/来源标签），不要顺手删。
- **连带影响**：V38 把三张表删了，而**冻结的桌面轨道**里 `MigrationTool`（MySQL→SQLite 迁移工具）的清单还列着 `metadata_sync_task(_item)` / `metadata_sync_draft` —— 那是按 §13「保留不删、不维护」的老代码，跑它到这三张表会报表不存在；将来解冻桌面时一并处理，现在不要动。
