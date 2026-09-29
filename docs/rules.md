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

### 16. 「同步番剧」= 弹窗直连流程（2026-09-21 用户拍板简化；2026-09-24 加地区/标题查/单项同步）
- **内容**：从 Bangumi 同步只有**一个弹窗**：年/季/月**多选**（+ 分类 chips + 地区下拉）→ 拉取候选 → 勾选 → 直接同步 → 显示条数。**不再有**独立审核工作区、后台任务表、逐项重试、跨会话草稿（V38 已把 `metadata_sync_task*` / `metadata_sync_draft` 三张表删掉）。
- **筛选语义**：年 = 限定符（可多选）；季/月 = 可选细分（选了就只查细分，年作限定）；没选细分 = 整年。区间在**后端** `SyncRangePlanner` 归一：同季内相邻月合并、**超过 3 个月按自然季度切开** —— 因为 Bangumi `total` 硬上限 1000（按年会撞顶，按季不会），且**同一请求多段 `air_date` 会 AND 成 0 条**，所以必须逐段请求。
- **地区筛选（2026-09-24）**：Bangumi **没有** region/area 字段，动画的地区只存在两个标签数组里；官方 filter 支持 `meta_tags`（**公共标签**，人工维护）与 `tag`（用户标签，噪声大）。取 `meta_tags`，白名单写死 `日本 / 中国 / 美国 / 欧美`（`BangumiMetadataProvider.REGIONS`，实测本库 317 条分布 285/24/8/3），非法值直接 422。
  - **只做单选，不做多选**：`meta_tags` 是**且**关系，选「日本+中国」= 同时属于两国 = 0 条；要并集得两次请求再合并。
  - **实测（2026-09-24，真接口）**：2024-04 全量 111 条 → 日本 74 → 中国 17（`小兵传奇`/`反派初始化`/`虚无边境` 全是 WEB，命中正确）。
  - **已知漏网**：`meta_tags` 不带地区的条目会被 AND 掉（111 − 74 − 17 = 20 条），不是 bug，是标签体系的固有覆盖率问题。
  - infobox 里的「地区」键**不是**动画字段（317 条里只有 1 条非动画条目有），别拿它做筛选。
- **分类筛选（2026-09-25）**：Bangumi 网页上的「分类」（TV / WEB / OVA / 剧场版 / 动态漫画 / 其他）**也是** `meta_tags`，同样推给服务端过滤，白名单 `BangumiMetadataProvider.CATEGORIES`。与地区是**同一个** `meta_tags` 数组（**且**关系）—— 于是「日本的 TV」就是一个请求，不是前端筛选。
  - **`其他` 必须排除**：那是 Bangumi 站点自己的兜底项，**不是公共标签**，带它查任何区间恒为 0 条。
  - **未知标签是静默 0 条，不报 422**（实测 `meta_tags:["假标签XYZ"]` → `total=0`）→ 所以白名单是**必须**的：否则打错一个字的效果是「拉了 0 条候选」而不是报错。
  - **实测（2026-09-25，真接口，2025-04-01~07-01）**：全量 276 → `TV` 83 → `剧场版` 36 → `WEB` 82 → `OVA` 1 → `日本` 117 → `日本+TV` **67**（= 83 ∩ 117，AND 语义正确）。
  - **已知不一致（`meta_tags` ≠ `platform`）**：分类筛出的结果里会混入少量 `format` 不符的条目（`TV` 83 条里 2 条 platform=WEB；`剧场版` 36 条里 1 条 WEB）—— 公共标签是人工标的，条目字段是官方填的，两者本来就会出入。**不是 bug**；行里显示的是 `format`，所以看得见。副作用：默认勾选规则照旧只勾 `format=TV`，于是「分类=TV」时那 2 条 WEB 默认不勾（可「全选」补上）。
- **标题查询（2026-09-24）**：弹窗内直接用关键词打 Bangumi 搜索（复用 `/api/metadata-sync/preview` + `mode=WORK`），**不受年/季/月/分类/地区限制**；命中列表默认只勾第一条，行尾有「同步」按钮可单独入库。
- **单项同步（2026-09-24）**：每行「同步」按钮 = `commit([item], append=true)` 只提交该条（累加行尾 ✓，不抹掉上一条的结果）。**后端零新增接口** —— `/api/metadata-sync/commit` 本来就逐项独立事务。冲突项（`SKIP`）不渲染按钮（§16 匹配规则照旧：命中多个绝不自动关联）。
- **关闭交互（2026-09-25 用户拍板；同日二次修正）**：**「停」和「关」是两件事，不要混** ——
  - 底部左侧**一个按钮，文案随状态变**：空闲=「关闭」/ 拉取中=「停止拉取」/ 同步中=「停止同步」（按过变「停止中…」且禁用）。
  - 忙碌时点它 = `stopCurrent()`：**只停操作，面板不关**（“停到哪了”恰恰是要看的时候）。拉取用 `AbortController` 直接掐；同步**永不 abort**，只置 `cancelRequested`，在每批开头 `break`。
  - 空闲时点它 = `closePanel()`：就是退出口。
  - ⚠️ **曾经写成「取消」= 停操作 + 关面板**，两个入口职责撞车（× 也是关面板），且用户按取消时正是想看结果 —— 别改回去。
  - 右上 **× / Esc / 点遮罩** = `closePanel()`：拉取 → 掐断；**同步 → 转后台继续跑**（写库不该被一个手滑的关闭点掉）。
  - **忙碌时点遮罩不关**（防误触杀掉 40 秒的拉取）。
  - 同步“停止”停在**批次边界**（`BATCH_SIZE=12`）：`/commit` 每项独立事务，**掐断在飞的写库请求 = 服务端可能写了一半而界面说不清**。停完文案「已中断：已同步 N 部（已写入，可重开补齐剩余）」。
- **后台同步指示器**：`.bgm-float`（写在 `#bgm-sync-modal` **之外**，否则弹窗 hidden 后它也没了），只在「弹窗已关 + 同步中 + **没按取消**」时出现；点它 `openBgmSyncModal()` 回来，`busy` 时重开**保留现场**（不清空 candidates/勾选/进度/行尾结果）。**不跨页面刷新**（跨刷新要落库排队，另一量级，没做）。
- **上次同步结果**：`localStorage['vt-bgm-sync-last']` = `{at, interrupted, total/added/updated/skipped/failed, items[{t,s}]}`，明细上限 500 条；用原生 `<details>` 常驻**弹窗顶部**（放步骤 2 里首屏看不见 —— 首次打开时步骤 2 是 hidden）。`total===0` 不写，免得盖掉上一次的真结果。
- **弹窗结构**：`.modal` 自己**不滚**（`overflow:hidden`），滚动交给中段 `.bgm-scroll`，形成「固定头（× / 标题 / 上次同步）+ 可滚中段 + 固定底栏（取消 / 同步）」。⚠️ **别把 `.bgm-scroll` 去掉**：曾直接给 `.modal` 上 `overflow:auto`，结果绝对定位的 × 和底部的「同步」一起被滚到 fold 外（实测 900px 窗口里同步按钮 top=1076），两个都点不到。
- **「只选 TV」按钮与「默认只勾 TV」规则：2026-09-25 已删**。理由是它与「分类」筛选职责重叠（同一个概念摆两处 = 又一次歧义），且它是勾选侧的**第二层隐式过滤**。现在默认勾选 = **全选**，只把冲突项（`CONFLICT`）留给人工。
- **匹配与动作**：`EXTERNAL_ID`→UPDATE、标题/别名**唯一精确**命中→LINK（都是"更新"）、`NONE`→CREATE、命中多个→**SKIP**（交人工，绝不自动关联）。
- **「不动本地数据」的含义**：更新路径只写 `media_entry` / `external_work` / `external_episode` / `external_relation` + **只补缺失的** `episode`；`media` 的标题/年份/备注/评分/状态/标签/封面**一律不写**（新增时才建 media）。
  - ⚠️ **2026-09-24 待拍板**：用户提「日期/评分等能关联的也同步进本地媒体」。查证结论：`media.rating` 是**个人评分**（`V3` 建的 `DECIMAL(2,1)`，UI 标注「个人评分 0~10」），既语义不同、又**装不下 10.0**，不能写 Bangumi 评分；本地也没有 `air_date` 列（放送日期在 `external_work.air_date`，媒体详情页已展示）。要落外部评分得先加列（建议加在 `external_work` 侧，别碰 `media.rating`）。**未动代码，等用户拍板。**
- **不做**：标题模糊匹配（实测「剥掉第N季/幕/期比基名」零增益，且误关联代价更大）；媒体详情里的单条刷新/换绑/关键词搜索保持原样。
- **注意**：AniList / Omofuna 的同步**入口**虽已废弃，但它们的代码与 `media.source` 数据**在用**（`SearchService`/`RecommendService`/来源标签），不要顺手删。
- **连带影响**：V38 把三张表删了，而**冻结的桌面轨道**里 `MigrationTool`（MySQL→SQLite 迁移工具）的清单还列着 `metadata_sync_task(_item)` / `metadata_sync_draft` —— 那是按 §13「保留不删、不维护」的老代码，跑它到这三张表会报表不存在；将来解冻桌面时一并处理，现在不要动。

### 17. 媒体库对账「清理未关联」（2026-09-25 用户拍板；已在真库执行）

- **入口**：同步番剧弹窗 → 「清理未关联」→ ① 干跑（只报告）→ ② 执行清理（需手输 `DELETE`）。也可直接打 `/api/media/reconcile/*`。
- **规则（三条，写死）**：
  1. 无 Bangumi 关联 **且** 无引用痕迹 → **删**（**不打 Bangumi**，省上千次请求）
  2. 有引用 **且** 能精确关联 → **关联**（命中条目已在本地关联 → 合并；否则新建关联）
  3. 剩余（有引用但关联不上）→ **删**
- **判定用「名字或别名精确相等」，不是 `matchType=EXTERNAL_ID`**。后者是**宽松信号**，实测误判 23%（「轻松熊 → 摇曳百合」「无自觉圣女 → 无敌看板娘」）。
- **别名是命中率的关键**：Bangumi **搜索响应本身就带 `infobox`**，`infobox.别名` 收录各种译名，`BangumiMetadataProvider.parseSubject` 早就解析了 → 零额外请求。「描绘直至生命尽头」对 `name_cn` 相似度 0.00，但**是别名之一**。加别名后精确命中 8% → 72.5%。
- **⚠️ 分页必须用 id 游标（`m.id > afterId`），不能用 OFFSET**：干跑时数据不变 → `OFFSET=0` 反复取回同一批（曾导致任务扫 200 条就 DONE）；live 时数据在删 → OFFSET 建在变短的集合上 → 跳行。
- **删除复用 `MediaService.purge`，但它漏三张表，`purgeDeep` 必须补**：`media_entry`（1:1 结构子表，实测攒了 33 条孤儿）、`title_mapping`（直接删行）、`highlight_project`（`media_id` 是 **NOT NULL** 没法解绑，**只删条目数为 0 的空壳**，有内容的工程保留并记 warn）。
- **封面删除只删 DB `cover_path` 指向的那个具体文件**，绝不扫目录。`covers/clip/`（片段）、`covers/ep/`（单集）、`covers/ext/`（Bangumi 缓存）**一律不碰**。
- **⚠️ 坑：`mvn spring-boot:run` 的工作目录决定 `cover-dir`**（`cover-dir = ${VT_DATA_DIR:data}/covers`）。从 `backend/` 启动会解析成 `backend/data/covers`，与真实 `data/covers` 不是同一个目录 → `deleteCover` **全部静默失败**（DB 里 `cover_path` 已置空、磁盘文件还在，本次事后补删了 5503 个）。**要动封面时工作目录必须是仓库根，或显式设 `COVER_DIR`。**
- **live 的前置条件**：必须有一条**比最近一次 live 更新**的 `DONE` `dry` 任务（`MediaReconcileJobService.create` 里校验）。⚠️ 曾经只查「历史上存在过 DONE 的 dry」→ 那条干跑会**永久免检**后续所有 live，与「每次执行前先看新报告」的意图不符（2026-09-25 用户指出后收紧）。
- **⚠️ 工作目录决定 `cover-dir`（实测已踩）**：`cover-dir = ${VT_DATA_DIR:data}/covers` 是**相对启动工作目录**解析的。从 `backend/` 启动会解析成 `backend/data/covers` → `deleteCover` 全部**静默失败**（DB 里 `cover_path` 已置空、磁盘文件还在）。现已加 WARN 日志（`封面文件不存在，没删到任何东西: ...（解析为 <绝对路径>）`），看到它就去查启动目录 / `VT_DATA_DIR` / `COVER_DIR`。
- **live 的其它前置**：任务表 **V39 `media_reconcile_job`**；重启由 `MediaReconcileRecovery` 把 RUNNING 标 INTERRUPTED；取消**只在批次边界**停（沿用 §16 的约定）。
- **幂等**：只扫未关联媒体，已关联一律不动 → 重跑天然收敛。
- **既有缺陷 ①（2026-09-25 已修）**：`external_work.end_date` 原是 `varchar(32)`，装不下 Bangumi「放送结束」的自由文本（实测值 `2022年3月16日(OVA) / 2023年9月20日(TV Edition)`，44 字符）→ `Data too long`，该条目**永远关联失败**。已由 **V40** 加宽到 `varchar(128)`，重跑后 media 3619 关联成功。
- **既有缺陷 ②（已修）**：`MediaService.purge` 漏删 `media_entry` → 对账的 `purgeDeep` 补上，历史 33 条孤儿一并清掉。
- 过程存档（**已过时，看本节**）：`docs/superpowers/specs/2026-09-25-media-reconcile-design.md`、`plans/2026-09-25-media-reconcile-plan.md`（按旧的「分层人工」规则写的）。

### 18. 「全量同步」= 按筛选条件跳过拉取候选，直接同步（2026-09-25 用户拍板）

- **入口**：同步番剧弹窗「选范围」旁的 **⚡ 全量同步**（两步确认防误点）；接口 `/api/media/full-sync/{start,job/{id},job/latest,job/{id}/cancel}`。
- **语义**：沿用**同一套筛选条件**（年/季/月 + 分类 + 地区），但**跳过「拉取候选」**，把符合条件的番剧**全部**同步进来。不受弹窗 400 行渲染上限约束。
- **⚠️ 同步逻辑必须与弹窗逐条勾选同源**：同一个 `SyncActionDecider`（EXTERNAL_ID→UPDATE / TITLE→LINK / NONE→CREATE / 命中多个→SKIP）+ 同一个 `MetadataSyncCommitService.commit`。所以它**幂等** —— 第二次跑走 UPDATE/LINK，不会重复新增（实测：同范围跑两遍，第二遍 `新增 0 · 更新 28`）。
- **任务表 V41 `media_full_sync_job`**（与 V39 `media_reconcile_job` 是兄弟表，计数语义不同没合并）；`MediaFullSyncRecovery` 启动把 RUNNING 标 INTERRUPTED；与对账**共用单线程 `mediaBatchExecutor`**（都在猛打 Bangumi，串行才不会触发限流）。
- **⚠️⚠️ 取消的坑（两个任务都有，2026-09-25 实测踩到手）**：循环里**不能**用 `jobMapper.updateById(job)` 写进度 —— MyBatis-Plus 会把内存行里非空字段**全部**写回，包括 `status=RUNNING`，于是**把用户刚设的 `CANCELLED` 覆盖掉**，取消随机失效（现象：取消后 status 秒回 RUNNING，任务一路跑完）。正确做法：
  1. 循环内用 **只 set 进度字段的 `LambdaUpdateWrapper`**（`saveProgress`），绝不碰 `status`；
  2. 收尾时**再读一次 DB**，晚到的取消也要认（`stop = cancelled || DB 里是 CANCELLED`）。
  上次以为「对账取消能停」，那只是取消恰好落在两次覆写之间的窗口里。
- **断点续跑（2026-09-25 加）**：
  - **全量同步按「段」续跑**：新建任务时，若存在**同筛选条件**且状态为 `INTERRUPTED` / `CANCELLED` / `FAILED` 的旧任务，就从它的 `done_ranges` 继续（= 跳过已整段跑完的前 k 段）。依据：`done_ranges` **只在整段跑完时才 +1**，而段的顺序由 `SyncRangePlanner` 按条件确定 → 「前 k 段已完成」是精确的。
  - **`DONE` 不复用**：跑完过还想再跑 = 想拿 Bangumi 的新增，这时跳过任何段都是错的。
  - **对账天然续跑**：它只扫「未关联」的 media，已关联的离开集合、已删的不存在 → 再跑一次天然只处理剩下的。⚠️ 但 live 前必须先跑一次**新的** dry（见上面收紧的前置条件）。
  - 实测：任务在「段 2/4」被取消 → 同条件再起，自动从**第 3/4 段**开始，只处理后两段（49 条）✓
- **⚠️ 执行器的 `queueCapacity` 不能是 0**：单线程正忙时提交新任务会被直接**拒绝**，`@Async` 方法压根不跑 → 任务行**永远停在 PENDING**（2026-09-25 实测：取消一个任务后立刻再起一个，新任务卡死）。给个小队列（现为 8），让它排队等前一个跑完。
- **规模提示（实测推算）**：13 年 ≈ 52 段、约 1.4 万条；每条 commit 后端要拉 subject+集+关联 ≈ 3 次 Bangumi 请求 → **2–4 小时**。用「整年」跑会撞 Bangumi 的 1000 条上限（任务 message 会列出来，建议改选月份）。

---

## §19 媒体页筛选（2026-09-25 重构为「chips + 浮层」，对齐推荐编辑器）

**语言与推荐编辑器的候选库筛选同源**（`remotion/editor/panes.tsx` 的 `FilterPopover`）：主行只留高频（搜索）+ 一个 `⚙ 筛选`；已选条件变成可**单个 × 掉**的 chips；点 ⚙ 开浮层，左栏维度、右栏取值，**取值点选即时生效且面板不关**（可连加条件）。**维度之间 AND；「题材」是多选、同维度内 OR。**

### 维度与选项来源（全部数据驱动，只列库里真有的）

| 维度 | 存储 | 选项字典接口 |
|---|---|---|
| **题材** | `external_work.genres_json` | `GET /api/media/genres` = **白名单 ∩ 实际** + 计数 |
| 年份 | `media.year` | `GET /api/media/years` |
| 季度 | `external_work.season`（SPRING/SUMMER/FALL/WINTER，**与大段标签同口径：冬=1–3月**） | 前端常量（只有 4 个） |
| 状态 | `media.status` | 前端常量 |
| 收藏夹 | `media_collection` | `GET /api/collections` |
| 标签 | `media_tag` | `GET /api/media/tags` = **只列真挂在媒体上的** + 计数 |

### ⚠️ 题材为什么必须白名单

Bangumi 的 tag 是**原始标签堆**（全库 **17871 个不同值**），混着：人名（津田尚克 / 若山詩音，还带中/日文双份）、制作公司（8bit / Lay-duce）、年份与档期（2026年4月 / 2026春 / 未定档）、来源（漫画改 / 轻改）、国家（日本）、以及用户吐槽（厕纸 / 略无聊 / 哈气推动剧情法）。直接当筛选项就是一万七千项的垃圾堆。

- 白名单 = `MediaService.GENRES`（**41 项，硬编码**，取值依据 = 真库实测出现次数 ≥ 30），2026-09-25 用户拍板。
- 白名单**只用于生成选项列表**；查询侧不校验（传白名单外的词也能查，无害）。

### SQL

- 题材（多选 OR）：`EXISTS (SELECT 1 FROM external_work ew WHERE ew.media_id = a.id AND JSON_OVERLAPS(ew.genres_json, CAST(#{genresJson} AS JSON)))`
  - 需要 **MySQL 8.0.17+**（本机 8.0.46 ✓）；**SQLite 侧不维护**（桌面轨道已冻结 §13）。
  - 计划走 `idx_external_work_media` + FirstMatch，**不是**全表×全表。
- 谓词抽成接口常量 `MediaMapper.GENRE_FILTER` / `SEASON_FILTER`，在 **5 个查询**里复用（`listFiltered` / `countFiltered` / `listByLatest` / `countLatest` / `listByCollection`）+ `listExportRows`。
  - **必须全加**：前端 `addCommon` 把同一组筛选发给所有 tab，只加一部分会让「切到最近观看就静默忽略条件」= 静默错结果。
- 顺手补齐：`/api/media/recent` 与 `countLatest` 原来**没有 `tagId`**（与 list 侧不一致），本次一并加上。

### 已删的死选项（用户 2026-09-25「删掉，先保留状态」）

- **「待确认」**：`media.confirmed` 真库 **5255 条全是 1** → 筛了恒为 0。
- **「子分类」**：`media.subcategory` **5254/5255 是 null** → 筛不出东西。
- `fillSubcategoryFilter()` 保留为 **no-op**（两个调用点 `loadFormats` / `selectFormatTab` 不动），以后数据长起来再挂回浮层。

### ⚠️ 坑：浮层被自己关掉 —— 必须用 mousedown 判外部点击

取值点选 → `setDim` → `renderFilterPop()` 把取值节点**整块重建** → 等 `click` 冒泡到 `document` 时目标已脱离 DOM，此时 `filterPopEl.contains(e.target)` **和** `e.composedPath()` **都不再包含浮层** → 判定成「点了外面」→ 刚开的浮层被关掉。

**唯一稳的判法：用 `mousedown`（早于 click，此时 DOM 还是完整的）判外部点击。** 已在浏览器实测（capture 阶段探针看到 `inPath: true`、冒泡阶段却变成 false，抓出来的）。

---

## §20 「导出清单」无行数上限（2026-09-25 删掉原来的 `LIMIT 500`）

**用户报的现象**：收藏夹「异世界」候选 **557** 部，导出清单只有 **500** 部。

**根因**：`MediaMapper.listExportRows` 里硬编码的 `LIMIT 500`，配合 `ORDER BY (a.year IS NULL), a.year DESC, a.id DESC` —— **按年份降序截断，丢的是最老的年份**。

算术验证（「异世界」逐年累计）：2016 年累计 498 → 2015 年累计 506，**上限正好切在 2015 年中间**；丢弃 = 2015 剩 6 + 2014 及更早 51 = **57** = 557 − 500 ✓

**为什么两个数字会打架**：候选数走 `/api/media/count`（**无上限**），清单走 `/api/media/list-export`（**有上限**）→ 天然不一致，且对话框只有"去重提示"、**没有任何截断提示** → **静默丢数据**。

**性能从来不是理由（实测）**：

| 范围 | 耗时 | 体积 |
|---|---|---|
| 异世界 557 部 | **0.23s** | — |
| 全库 5249 部 | **2.0 – 2.2s** | 962 KB |

**已删**，并同步清掉 4 处"上限 500"的过时注释（`MediaMapper` / `MediaService` / `MediaExportRow` / `MediaController`）。

**规则**：
- **别再把上限加回来**。要限制就必须**让调用方显式传**，且**截断必须对用户可见**（返回 total + UI 明确写"已省略 N 部"）。
- 改这块前注意：**「候选」与「已选」走的是同一条 SQL**（已选靠 `ids` 参数）—— 上限会**同时**影响两者。
- 相邻但**不同**的 500：`SearchService` 的语义检索分页上限、同步弹窗「上次同步结果」的 localStorage 明细上限 —— 别误伤。

---

## §21 API 的 `limit` 不再钳位（2026-09-25，与 §20 同族：静默截断）

**用户报的现象**：编辑器候选 **557 部**、已选只有 **200 部**。

**根因**：`MediaService` / `CollectionService` 把 `limit` **一律钳到 200**（4 处：`list` / `recent` / `listTrash` / `CollectionService.media`），叠加编辑器里写死的 `limit: 500` → 实际拿到 200。

**一个根因、四处受害**：

| # | 功能 | 症状 | 可见性 |
|---|---|---|---|
| 1 | 编辑器「用当前筛选替换已选」 | 已选 **200** 而非 557 | 可见（用户报的） |
| 2 | 编辑器「已选中有多少不在筛选内」 | 误算 `557-200=357` | 隐藏 |
| 3 | `fillTagMediaSelect` 媒体下拉（`limit=500`） | 5249 部里只列 **200** | 可见 |
| 4 | 回收站（`limit=200` 不分页） | 只显示 200 | 隐藏 |

**已去掉钳位**（保留 `Math.max(limit, 1)`）。**为什么安全**：返回行数**天然被表数据量封顶** —— 不可能靠 `limit` 拿到比库里更多的行；而更重的「清单导出」从来就没有上限（§20）。实测全库 5249 行 = **1727 KB / 1.04s**。

**配套改动**：
- 编辑器 `recompute`：`limit: hits`（按 count 的实际命中数取满），**并删掉那句谎报的提示** `if (hits > 500) alert("本次只取前 500 部")` —— 它说的是 500，实际给的是 200。
- `fillTagMediaSelect`：先 `/api/media/count` 拿准数，再一次取满（不引入魔法数字）。
- ⚠️ 回收站前端仍写死 `limit: 200` 且**不分页**（当前库里只有 6 条，未暴露）—— 以后清空/恢复量大了要一起处理。

### ⚠️ 改编辑器必须重新构建 + 升缓存版本号

编辑器的 `panes.tsx` 是**独立构建**的：`cd backend/remotion && npm run build:editor`（产出 `dist-editor/`，由 `WebConfig` 映射到 `/recommend-editor/**`）。

而 `index.html` 里引用它的版本号是**写死的**：

```html
<script type="module" src="/recommend-editor/editor.js?v=20260925-candidate-cap"></script>
```

**改了 `panes.tsx` 不升这个 `?v=` 号，浏览器会一直拿旧 bundle** —— 表现就是「改了没生效」。**必须两个都做**。

---

## §22 推荐模板的卡片几何：**必须按画幅预算反推**（2026-09-26）

**用户报的现象**：封面是**横图**、图片显示不全而且过大。

### 两个都是几何错误，都在渲染侧

| # | 位置 | 错法 | 后果 |
|---|---|---|---|
| 1 | `scenes/Opening.tsx` | `cardHeight = cardWidth ***** cardAspect` | `cardAspect`（190/270）是**宽/高比** → 乘出来是 **297×209 的横版卡**，竖版封面被裁成一条横带 |
| 2 | `scenes/Cards.tsx` GridScreen | `cardH = coverH + height*****0.24` | perScreen=10 时每卡 **586px**，两行加行距 **1220px > 1080** → **第二行直接被画出画面外**（perScreen ≥ 5 起就在溢出） |

### 规则

- **方向比率一律"宽/高"**（`cardAspect` / `posterAspect` 都是）。要算高就**除**它；要算宽才能乘。**看到 `* aspect` 先想一下是不是该 `/`**。
- **网格卡片高度必须由画幅预算反推**，不许"封面多高 + 文字多少"累加：
  ```
  cardH = (height − pad*2 − labelH − gap*(rows−1)) / rows      // 净高按行数均分
  coverH = min(cardW / posterAspect, cardH − height*textRatio)  // 封面吃掉剩余，守海报比例
  ```
  这样恒有 `pad*2 + labelH + cardH*rows + gap*(rows−1) = height` —— **任何 perScreen × 画幅都不溢出**。
- 网格屏**不放简介与标签**：它是"一眼扫过"的场景，长文归资料卡（`MediaInfo`）。塞进去必然把卡片撑爆。
- 封面用 `<Poster contain>`：完整显示 + 模糊底自动填边，**不要用 cover 裁**。

### 回归门禁

`src/grid-geometry.test.ts`（78 项）锁死上面两条：2 套主题 × 3 种画幅（720P/1080P/4K）× perScreen 1-10，
断言纵向/横向总占用不超画幅、封面与文字区都是正高度、`openingCardSize` 恒为竖版。
**已验证它抓得住旧 bug**（把旧公式改回去 → 720P 一屏 5 部即报 `1180.4 > 720.01`）。

> 改 Remotion 组件后**必须 `npm run build:editor` 并升 `index.html` 的 `?v=` 号**（同 §21）。

### 顺带记下的环境坑

- MySQL CLI **batch 模式会把制表符转义成字面 `\t`** → 脚本解析 TSV 要加 `--raw`。
- Windows 下 **node 把 `/tmp` 解析成 `D:\tmp`**（不是 Git Bash 的 `/tmp`）→ 临时文件写项目内 `.tmp/`。
- `recommend_draft.config` 是**嵌套**的：读分辨率要用 `$.config.resolution`，用 `$.resolution` 恒为 NULL（会得出错误结论）。

---

## §23 编辑器候选库「按年份分组」（2026-09-26 用户要求）

- **开关**：候选库搜索栏的 `📅 按年份`（默认**关** —— 不开时保持原来的 id 倒序）。状态是组件局部 state，不进 `CandidateFilter`。
- **排序**：分组时必须让后端 `sort=year&order=desc`，否则年份交错、分段无意义。
  - `MediaMapper.listFiltered` 新增了 `sort == "year"` 分支（与 `listByCollection` 同款）。
  - 排序**不放进 `CandidateFilter`** —— 那个对象会随模板保存、还会影响导出清单顺序；只在 `api.media()` 上单独传 `sort/order`。
- **分组逻辑**：`yearRuns()` 按年份切**连续段**，同一年跨页时"与上一段同年就并入" → 不会出现重复表头。
  切分组 = 换 `filterKey`（把 `__groupByYear` 并进签名）→ 自动复用「页码与签名绑成原子状态」的回第 1 页机制。
- **表头**：`grid-column: 1 / -1` 跳满整行 + `position: sticky`；视觉照抄主应用 `.group-head`（渐变年份 + 淡色计数）。
- **计数如实**：最后一段在无限滚动中未必取完 → 标「已加载 N 部」（其余段标「N 部」），别把部分数当成年份总数。

---


## §24 agent-browser 使用纪律（详细版在**全局记忆**）

**完整纪律已写入全局记忆** `~/.pi/agent/AGENTS.md` 的「agent-browser 使用纪律（跨项目）」一节 —— 那是跨项目生效的唯一真源，
下面只留本项目特有的部分，别在这里重复维护。

**本项目特有**：

1. **改 Remotion 组件后必须 `npm run build:editor` + 升 `index.html` 里 `editor.js/css` 的 `?v=` 号**（见 §21）——
   不升版本浏览器会拿旧 bundle，表现就是"改了没生效"。验证时 `open` 带 `?bust=$(date +%s)`。
2. **典型断言写法**（本项目验收一次拿全证据的做法）：把「操作 + `await` 轮询等待 + 结构断言 + 回读计算样式」压进**一条** `eval`。
   例（候选库按年份分组的验收）：点开关 → 轮询等 `.vt-year-head` 出现 → 逐项比对"每张卡的年份 == 它上方表头" → 回读 `getComputedStyle(...).position` 是否为 `sticky`。
3. **隔离实例的验收前置**：`taskkill` 掉 18099 旧进程 → 起新实例 → **断言 `/actuator/health` 200** → 再看日志确认 Flyway/配置是新的。
   不前置就可能在跑旧 class（本项目踩过）。
4. **别拿编辑器截图判断分辨率**：预览是 `plan.width × plan.height` 的 canvas 缩到面板宽（~750px）再加截屏压缩。
   要量分辨率就用渲染产物（`render-recommend.ts` 的 `{"width":…,"height":…}` 回执）或接口数据。

---

## §25 分页排序**必须是全序**（2026-09-26，本项目第二次栽在这上面）

**用户报的现象**：2026 年 ∩ 异世界收藏夹有 **87 部**，但候选项只加载出 **57 部**。

**根因**：新加的 `sort=year` 排序写成了 `ORDER BY (a.year IS NULL), a.year DESC` —— **没有唯一键兜底**。
MySQL 对并列行（同一年内）**不保证稳定顺序** → `LIMIT/OFFSET` 翻页时**同一行重复出现、另一些行被跳过**
→ 前端按 id 去重（`!current.some(seen => seen.id === item.id)`）把重复的丢掉 → **加载数变少**。

**实测证据**（5 页 × 30 = 150 行，`collectionId=13`）：

| 排序 | 唯一行 | 重复 | 2026 累计 |
|---|---|---|---|
| `ORDER BY (a.year IS NULL), a.year DESC` ← 错 | 116 | **34** ✗ | 走不满 87 |
| `ORDER BY (a.year IS NULL), a.year DESC, a.id DESC` ← 对 | **150** | **0** ✓ | 87 ✓ |
| `ORDER BY a.id DESC`（默认，天然唯一） | 150 | 0 ✓ | 39（年份交错，正常） |

修完后走**真实接口** 8 页 240 行：唯一 240 / 重复 0 ✓、年份块 `2026→2025→2024→2023` 每年只一段 ✓、**2026 累计 87** ✓。

### 规则

- **凡是 `LIMIT/OFFSET` 分页，`ORDER BY` 末尾必须带唯一键**（本项目就是 `a.id`）。
  并列排序（同一年 / 同评分 / 同 `latestAt` / 同 `deleted_at`）**必须**补 `, a.id <同方向>`。
- 这不是"锦上添花"，是**正确性要求**：没有全序，OFFSET 分页在语义上就是未定义的。
- **前端的按 id 去重会把错误吃掉一半** → 症状表现为"少了 N 条"，不会报错，极难察觉。

**已修 4 处**（`MediaMapper`）：`listFiltered` 的 `latest`/`rating`/`year`、`listByCollection` 的 `latest`/`year`、`listByLatest`、`listTrash`。
（`ORDER BY a.id` 的默认分支本来就唯一，不用动。`ClipMapper` 的 `ORDER BY g.latest DESC, g.video_fp DESC` 按 `video_fp` 分组，也唯一。）

### 验证方法（改完照做）

```bash
# 取多页 → 比对"总行数 vs 去重数"，重复必须为 0；再确认同一维度值只出现一个连续块
for off in 0 30 60 90 120 150 180 210; do
  curl -s "http://127.0.0.1:PORT/api/media?limit=30&offset=$off&sort=year&collectionId=13"
done   # 然后在脚本里统计：总行 / 唯一 / 重复 / 年份块序列
```

> 历史：本项目**第二次**栽在 OFFSET 分页上。第一次是对账任务的 id 游标（OFFSET 在 dry/live 两种模式下都失效，见 §17）；
> 这次是排序并列。**下次再写分页查询，先问一句："这个 ORDER BY 是全序吗？"**

---

## §26 推荐预览/渲染输入：**默认批量取数**，长请求必须有进度反馈（2026-09-26）

**用户报的现象**：「我一次勾选全部为何预览不生效」——全选 137 部后预览画面**几十秒不变**。

### 三层原因（都有实测）

1. **不是截断**：接口 200、137 部全返回、`missing: 0`。
2. **是慢**：`buildRenderInput` 逐部取数 —— `for (id : ids) mediaService.get(id)`（每部 8 条 SQL）+ 循环里逐部查 tags/external_work/collections/子分类 = **18 条 SQL/部、185-207ms/部**。
3. **UI 毫无反馈**：`busy` 只把「▶ 导出视频」按钮改成"提交中…"并禁用；**已经有旧预览时，预览区一点变化都没有** → 看起来就是"不生效"。

### 已做的修复

| 项 | 做法 |
|---|---|
| **批量取数** | 新增 `MediaMapper.listRenderBatch`（一条带标量子查询的 SQL 顶掉 `get()` 的 8 条）+ 批量 tags / external works / collections + 预加载收藏夹与子分类字典 → **6 条 SQL 封顶，与媒体数无关** |
| **指纹也走批量** | `metaFingerprint(ids)` 原先同样逐部 `mediaService.get(id)`，而它**每次渲染输入都要算** → 改成 `fingerprintOf(ids, loadRenderMedia(ids))`，渲染输入直接复用已加载的那份 |
| **主色按需 + 缓存** | `accentColorForPath` 要整张解码封面；**主色只有银幕式用** → 非 cinema 直接跳过；`CoverService` 里按封面路径加缓存（`""` 表示算过但取不出） |
| **UI 进度遮罩** | `busy` 时在预览上盖 `.vt-busy-veil`（转圈 + 「正在准备 N 部素材…」+ 首启会下载封面的说明） |

**实测（137 部）**：`25.4s / ~1233 条 SQL` → **`0.29s / 6 条 SQL`**；5 部 `46 条 → 6 条`。

### 规则

- **渲染输入/导出的媒体数据一律批量取**，别写 `for (id) mediaService.get(id)`：那是 8 条 SQL/部，且 `metaFingerprint` 会让它**每请求付两遍**。
- **分组字典（收藏夹/子分类）是小表** → 一次 `selectList(null)` 预加载，别在循环里 `selectById`。
- **只有银幕式需要 `accentColor`**；⚠️ 因此 `sessionSignature` **必须包含 `groupStyle`**（已补）——否则 chapter ↔ cinema 互切不重取输入，银幕式会拿不到主色。
- **超过 ~1 秒的前端请求必须有可见进度**：禁用按钮不算，预览区本身要盖遮罩。判断标准是"用户能不能看出东西在动"。

### 附带踩到的构建坑

改 `RecommendService` 构造器后，`RecommendServiceTest` 报的是**运行时** `NoSuchMethod`（不是编译错误）—— Maven 增量编译**没重编那个测试类**（它自身源码没变）。**改构造器/签名后要改测试并重跑；看到 `NoSuchMethod` 先想"是不是陈旧 class"**。

---

## §27 网格卡片版式：少部必须单独成档，底部要给 chrome 留位（2026-09-26）

**用户报的现象**：「假如页面只有一部或两部作品，卡片样式就会很大或者很窄看起来很别扭」。

**根因**（`gridGeometry` 的两个设计漏洞）：

1. **卡片高一律按"画幅净高 ÷ 行数"算** → 只有 1-2 部时行数=1 → 净高 = 整幅画高 → 卡片顶满 1080、上下空荡；3 部时列宽又窄 → 卡片又高又瘦。
2. **列数规则 `≤4 一行、>4 两行`** → 6 部时是 3 列 × 2 行 → 格子又宽又矮，海报被 `contain` 缩到中间留两条虚边。

**修法（三条）**：

- **列数优先单行**（`maxColumns = 6`）：≤6 部铺一行 —— 格子是竖的，正好贴合海报比例。
- **封面高设上限**（`maxCoverRatio = 0.62`）× **卡片高贴内容**（`cardH = coverH + textH`，不再用净高硬撑）→ 少部时卡片自然变优雅，多余空间居中留白。
- **少部时卡片宽由海报比例反推**（`cardW = min(列宽, coverH × posterAspect)`）→ 不再被列宽撑成又宽又扁。
- **底部单独留白**（`bottomPadRatio = 0.085`，上方仍 0.03）：画面底部有进度条 chrome，两行时最后一行会被它压住 —— 居中留白不够用。

**视觉重做**（骨架不变：封面 + 标题 + 元信息）：序号胶囊（盘点语境里"第 N 部"是信息）、封面底部渐隐（与文字区自然衔接，不再硬切）、顶部品牌色发丝线、分层阴影 + 竖向渐变底。

**回归门禁**（`grid-geometry.test.ts`，78 项）新增断言：封面高 ≤ 0.62 画幅高；**卡片宽高比 ∈ [0.4, 1.0]**（"巨大/狭窄"的直接判据）；≤6 部必须单行；纵向总占用（含底部留白）≤ 画幅高。

**实测渲染**（1920×1080，perScreen=10）：2 部 → 502×778 居中双卡；10 部 → 259×424 双行十卡，底部元信息完全避开进度条。

---

## §28 ★ 重点项（A+C+D，2026-09-26 用户拍板）

**需求**：「分组内假如我有几个想重点突出」+ 用户定：**各组各自**命名重点、**手动勾选**、**不设数量上限**、方案 **A+C+D**。

### 契约（只加一个布尔，不动 params）

- `PocMedia.featured?: boolean` —— Java 侧按请求的 `featuredIds` 置位（`RecommendService.buildRenderInput`）。
- **刻意不做成 `params.featuredIds`**：场景编排只需知道"这一部是不是重点"，一个布尔最省事。
- 编辑器侧 `EditorConfig.featuredIds: number[]`（候选卡右下角 ★ 按钮，**可反选**）；
  ⚠️ **`sessionSignature` 必须包含它** —— ★ 会改变场景结构，签名不含就不会重取输入。

### 场景编排（`scene-plan.ts`）

| 方案 | 做法 |
|---|---|
| **A** 群像内标记 | 网格卡右上 ★ 胶囊 + 品牌色描边/微光 + 金色发丝线；组标签行加「★ 重点 N」 |
| **C** 组内单独亮相 | 本组群像网格放完后，**重点项逐部补一幕 `MEDIA_INFO`**（复用现成资料卡，零新渲染代码） |
| **D** 全片重点回顾 | 结尾前插入 `GROUP_INTRO「全片重点回顾」`（常量 `FEATURED_RECAP_TITLE`）+ 只含重点项的网格 |

**时长提醒**：每部重点 = `durations.detail` 秒。**不设上限**意味着用户要自己承担长度 —— 每组 3 部 × 27 组 × 15s ≈ 20 分钟。建议搭配调小 `detailSec`。

### 给「超长参数方法」加参数的代价（记录）

`buildRenderInput` / `RecommendService.render` / `VideoExportTaskService.create` 都是 40+ 参数位置参数。
本次加 `featuredIds` 动到 **15 处**调用/签名（`openingIds` 旁边机械插入），且两处测试的 **38 个 Mockito matcher 列表**全碎。

**做法（可复用）**：不要手改，用脚本按真实签名生成 matcher 列表并替换（见 worklog 增量十四的命令）；
或者更好 —— **把这种方法的参数收进一个小对象**（本次没做，属技术债）。

---

## §29 序号必须**本地化**；核心区做在**组首**（2026-09-26 用户拍板）

### 一、序号：不要用 `PocMedia.order` 当展示序号

**用户报的现象**：「数量排怎么一会 500 一会几十」。

**根因**：`PocMedia.order` 是 Java 侧按**请求的 ids 顺序**编的**全局**序号（1..N），而画面是按 `groupBy` **重排**的 —— 两者不同源：
第 1 组是 `01…87`，第 2 组就变成 `88…159`（全局继续累加），**全片核心回顾里更是 `03 / 128 / 402` 满天飞**。

**修法**：`Scene.numberFrom`（**本地序号起点**，1 基）—— 组内从 1 数；核心回顾按回顾顺序从 1 数；
组标签行也不报全局区间了（改成「共 N 部」）。`GridCard` 用 `numberFrom + index`，`MediaInfo` 用 `numberFrom`。

### 二、核心区放在**组首**（原「组尾逐部资料卡」已删）

**用户**：「重点不太突出，能不能分组后开局把核心的几个展示出来」+ A+C+D 升级为「组首核心区」。

```
[组章节页]  →  [★ 本组核心]（组首）  →  [群像（全组，核心带 ★）]  →  下一组
                                            ↓
                          最后：[全片核心回顾] → [结尾]
```

- **核心 ≤2 部 → 逐部满屏**（每部一幕 `MEDIA_INFO`）；**≥3 部 → 一屏大卡**（几何自动给大卡）。
  为什么分档：逐部满屏吃 N 幕 `detailSec`，而「核心数量不设上限」+ 逐部满屏 = 成片长度失控。
- **核心项在组内排到最前**（`groupMedia` 里 featured 优先）：① 组首讲完直接进群像，叙事不跳；
  ② 跨幕接力只需在第一屏内做。
- 同一批**不再展示两次**（原组尾资料卡删除）。

### 三、动效（豪华档）—— 全部帧驱动

`animation.ts` **硬禁** CSS `transition`/`animation`/`@keyframes`/`setTimeout`/`requestAnimationFrame`/`Math.random`
（Remotion 逐帧渲染会乱序或重复，浏览器时钟驱动的动画会**闪烁且不可复现**）。可用的是 `useEnter`(spring) /
`staggerFrames` / `interpolate` / 三角函数。

| 阶段 | 效果 |
|---|---|
| 入场 | 金色**扫光**扫过核心题头（`translateX` + 渐变亮带）；每卡 **spring** 上浮 + 0.94→1（回弹由 spring 给）；封面**显影**（`grayscale/blur/brightness`，与开场暗房显影同一语言）；★ 角标**弹性落位**（延迟 + 反向旋转） |
| 驻留 | 封面**慢推镜**（1.0→1.05）；★ **呼吸微光**（`sin` 驱动，确定性） |
| 退场 | 整幕 `scale 1→0.94` + 淡出，把画面交给下一幕 |

⚠️ **诚实标注**：这是**跨幕接力**，不是严格的「同一对象 morph」。真正的 morph（银幕式「片名卡缩小 → 片段长出来」）
是在**同一幕内**做的，跨幕需要共享几何，成本/风险不成比例 —— 如需严格 morph 要单独评估。

### 四、转场音（④）真正落地

`stingTimeline` 原先**只认银幕式的 `TITLE` 幕** —— chapter 完全没有 sting 挂点。
现已加上 `scene.kicker === CORE_KICKER` → **金色扫光 + ★ 弹入与音效同帧落下**。

## §30 候选库分页：**拼页必须校验**，别静默按 id 去重（2026-09-26，与 §25 同族）

- **列表怎么来的**：候选库是**分页拼**的（`offset = (page-1) * pageSize`），一页一批 append。
- **为什么必须校验**：只要某一页与前面**不是同一份快照**，位置就整体错位 —— 触发源有三：① 后端排序不是全序（§25）；
  ② **集合归属在会话期间也会被改写**（实测：查的半小时里「异世界」554 → 553、2004 年 2 → 1，media 总数没变）；
  ③ 某页请求失败（`.catch(() => undefined)`）而页码照样 +1，那一页永远不再取。
  旧写法把重复行**静默按 id 丢掉** → 列表永远少几部、年份段错位（用户报「候选某年只显示 5 部，与收藏夹数量不符」），
  **只有整页重载能恢复**（内存里那份错列表没有重试入口）。
- **现在的规则**（`BasketPane` 翻页 effect）：同一 offset **重取一次**；再撞上就 `notify(msg, { label: '重载候选库' })` ——
  按钮清空列表回第 1 页重建（toast 带动作时留 8s）。重复判定**要连页内自撞一起管**（先 `Set(已加载)` 再 `add`），
  否则同一张卡会被插两遍。
  改这块时：**不要把「静默去重」写回去**；末页天然不足一页，不能当成异常。
- **表头**：未加载完必须写「已加载 N / M 部」（只印总数会被当成"这一年就这么多"）。

## §31 序言/简介 = **语义富文本**（2026-09-26 用户两轮拍板：「能分段、加粗、颜色标记」→「都改，颜色做个区分，红色是提醒的」）

**口径：留语义、砍排版。** 这一屏是「朗读节奏 + 画幅预算」驱动的画面，所以：

- 留：这是标题 / 这是条目 / 这段要突出（突出带**语义**，不是让用户选颜色）
- 砍：字号、字体、对齐、缩进、表格、图片、链接、**颜色自选器** —— 排版归模板；放开排版就守不住上面两个约束

**语法唯一真源**：`backend/remotion/src/rich-text.tsx`（编辑器按钮 + chapter 序言屏 + 银幕式简介三处共用）。

| 写法 | 含义 | 备注 |
|---|---|---|
| 空行 | 分段 | 段间距 = 1 个字号 |
| `## 小标题` | 行首块级 | 放大 1.3x + 金色 + 行高收紧 |
| `- 条目` | 行首块级 | 金色圆点 + 悬挂缩进；**相邻条目**间距只有 0.25 个字号（成组） |
| `**文字**` | 加粗 | **同时提亮**（正文是 muted 时只加 fontWeight:900，在 1280x720 下几乎看不出，实测要放大 4 倍才分得出） |
| `==文字==` | 重点（金） | 片名 / 数字 / 结论 |
| `!!文字!!` | 提醒（红） | 叠甲 / 避雷 / 注意 —— 用户明确要求「红色是提醒的」 |
| `++文字++` | 补充（青） | 来源 / 附注 |

- **语义色固定**，不随媒体/章节轮转（重点永远是重点色）；可按场景微调（`RichInline` 的 `tones`），但**不要**把 `accent` 绑回"当前媒体主色"。
- 未闭合标记 / `****` **当普通文字**，不抛错、不吞字；改解析器时这条不能破。
- **格式仍是纯字符串**（`config.intro`）→ 草稿/模板/导出任务三层 payload **零迁移**，解析只发生在渲染侧；
  银幕式那处只有一个行位（clamp 1）→ 取**第一块**。
- **预算与自动收字号**：`INTRO_LAYOUT` + `estimateIntroHeight` + `fitIntroSize` 是**渲染与编辑器预算条共用的同一份**常量/算法。
  正文预算 = 宽 0.7 × 高 0.5；放不下就阶梯收字号（下限 0.72x，再小宁可在编辑器里报警）。
  **改渲染排版必须同步改这份常量**，否则编辑器的“约 N 行”会骗人。
- **不打算上的**：真富文本编辑器（contentEditable/TipTap）—— 与上面这批功能完全重叠，代价是 payload 换 HTML（要消毒）
  + 数据迁移 + 100~250KB 依赖 + 行数/字号收口重算。**要上之前先来读这一节。**

### 验收脚本纪律（2026-09-26 血的教训）

用浏览器验收编辑器时：**草稿先 API 备份，结束后 API 还原；绝不用 UI 去“还原原值”**。
那天我的脚本在**草稿还没加载完**时采样了 textarea（拿到空值），最后又把那个空值当“原值”写回 →
**把用户手写的简介清空了**（已用 `curl /api/recommend/draft` 的备份恢复）。
正确姿势：`curl -s /api/recommend/draft > backup.json` → 用浏览器改 → 结束后 `PUT /api/recommend/draft` 回滚。

## §32 推荐等级 = **写死的四档**，第 1 档接管 ★ 重点（2026-09-26 用户拍板并实施）

- **名单唯一真源**：`backend/remotion/src/tier.tsx` 的 `RECOMMEND_TIERS = ['强推','推荐','值得一看','一般']`（顺序即强度，index 0 最强）。
  **不做配置**（用户明确「按你的直接定死吧，也不需要配置」）——全局设置/`site_setting`/接口一概没有，别再去加。
- **名次 → 视觉**：`tierLook(rank)`（**唯一真源**，渲染三处 + 编辑器胶囊共用）
  `0` 彩虹（旋转渐变环/内环 + 彩虹光晕呼吸）/ `1` 金 / `2` 青 / **最后一名 = 默认卡片（不描边不出胶囊）**。
  3 档时不会出现青色（第 3 档就是"最后一名"→ 默认）。
- **第 1 档 = 原来的 ★ 重点**（`scene-plan.ts` 的 `isCore`）：组首核心区（≤2 部逐部满屏 / ≥3 部一屏大卡）、组内排最前、结尾「全片核心回顾」。
  `PocMedia.featured` 已删除，别复活。老草稿的 `featuredIds` 在 `editor/state.ts#parsePayload` 里**自动迁成 `mediaMarks[id].tier = 0`**（有新媒体标注时不覆盖）。
- **数据面**：`EditorConfig.mediaMarks: Record<mediaId, {tier?, reason?}>`（稀疏：缺键 = 最低档/无理由）——
  与 `mediaClips` 同构，**草稿/模板/导出 payload 零迁移**；Java 侧对应 `RecommendService.MediaMark(tier, reason)`（`Map<Long, MediaMark>`，经 Controller/RecommendVideoService/VideoExportTaskService 一路透传）。
- **推荐理由**：用户「只是类似提一嘴」→ 编辑器 `maxLength 30`；网格卡**紧贴图下方一行**（超出省略号）、资料卡**标题下两行**；
  样式与等级胶囊同一套字体/字重/字距，**第 1 档用彩虹渐变字**（`reasonTextStyle`）。网格卡的文字区高度已并入 `GRID.textRatio`，`grid-geometry.test` 守着 perScreen 1~10 不溢出。
- **卡片位置约定**（同日用户三轮迭代后定稿）：等级胶囊**封面右上**；序号**已下线**（网格胶囊 + 资料卡 `PICK NO.` 都不再画）；
  「资料推荐/片段推荐」角标**已下线**；资料卡右下那枚大号描边数字**保留**（版式装饰，不是序号读数）。
- **坑：渐变字与底条不能同层**（2026-09-26 用户报「推荐未出现」）：`reasonTextStyle` 第 1 档给的是 `backgroundImage: <彩虹>` + `WebkitTextFillColor: transparent`，
  若**同一层 style 后面**再写 `background` 简写，会把 `backgroundImage` 重置成 `none` → **字直接透明消失**（看着只剩一条空条）。
  网格卡理由条已拆成「外层底条 div + 内层渐变字 span」；以后加渐变字都照此分层，且**验收必须出帧看图**（资料卡那种没有覆写 `background` 的地方会正常，只测资料卡会漏掉）。

## §33 推荐视频「等级二级分组」+「本组核心」下线（2026-09-26 用户拍板并实施）

- **开关**：`EditorConfig.tierGroup`（编辑器 Layout 组「按推荐等级再分组」，**默认开**）；渲染侧 `RenderParams.tierGroup`（`resolveParams` 缺省 = `true`）。
  老草稿缺该字段 → `parsePayload` 靠 `defaultConfig()` 补齐成**开**（用户 2026-09-26 明确「默认开」）。
- **两级分组**：一级 = 现有 `groupBy`（不分组/年份/分类/收藏夹，Java 算组名），二级 = **推荐等级**。三档口径（`scene-plan.groupMedia` 的 `splitByTier`）：
  1. 档序 = `RECOMMEND_TIERS`，**「未分级」永远垫底**，空档不生成；
  2. **整组没有任何一部标了等级 → 不切**（老草稿结构零变化就是靠这条）；
  3. 子组名 `一级组名 · 档名`（一级为空时只用档名），只有**每个一级组的第一个子组**带 `firstOfParent`。
- **章节页**：仍**每个一级组一页**（标题用 `parentName`，即年份），档与档之间不插页 —— 成片只因为「本组核心」下线而变短。
  网格组头行改用**子组名**（`scene.groupName` → `GridScreen.groupName`，此前读的是 `media[0].group`）。
- **「本组核心」整块已删**（`CORE_KICKER` 常量 + 组首核心区一起没了）：第 1 档现在靠二级分组自成最前一群 + 卡片上的彩虹环/「强推」胶囊标识。
  `isCore`/`coreFirst` **保留**（关掉二级分组时仍需它把第 1 档提到组首）；`Scene.kicker` 字段与 `GridScreen/MediaInfo` 的题头能力保留但**暂时没人产**。
- **结尾回顾 = 「按全局等级分组」的滚动清单**（同日晚些再改两次，见下文 **§36**）：标过等级的每个档 = 一页 `全片回顾 · <档名>` 题头 + 一段 `RECAP_LIST`（现为分页卡墙；未标等级那批也算一段「全片回顾 · 其它」，见 §36）；关掉 `tierGroup` → 退回旧的「全片核心回顾」（只第 1 档，同样是卡墙）。
  回顾页/年份页的 `GROUP_INTRO` 都带 `mediaIds`（回顾页不属任何分组，按组名查不到 → 不传就报「共 0 部」）。
- **`mediaOfGroup`** 现在是「精确匹不上就按 `parentName` 合并子组」——年份章节页取的是**整年**成员，别改回只 `find(name)`。
- **转场音（sting）挂点**：chapter 侧从「本组核心区」改成 **`GROUP_INTRO`**（年份页 + 回顾页）——`bgm.ts#stingTimeline`。
- **Java 透传**：`buildRenderInput` / `VideoExportTaskService.create` / `RecommendVideoService.render` 参数表**末尾**新增 `Boolean tierGroup`（`null` = 前端未传 → Remotion 侧默认开），Controller 的 `RecommendExportRequest` 末尾加同名字段。
  ⚠️ 预览走编辑器本地 `applyLocalParams`（不用重启即可见），**导出**要后端重启一次才吃这个开关。
- 设计稿：`docs/superpowers/specs/2026-09-26-recommend-tier-subgroup-design.md`（含四项拍板结果）。

## §34 Bangumi 外部封面缓存 = **文件名带来源 URL 哈希**（2026-09-26 修：用户报「库里换了封面、视频里依旧没变」）

- **现象与根因**（实测）：媒体页封面是**远端 URL 直出**（`static/app.js#mediaCoverSources` = `[coverPath, externalCoverUrl, fallbackCoverPath]`），
  而**推荐视频/编辑器**用的是**本地缓存** `/covers/ext/…`（`RecommendService:280` → `CoverService.ensureExternalCover`）。
  老实现文件名叫 `covers/ext/{mediaId}.{ext}` 且**命中就 return** → 来源 URL 换了它也不知道，
  「↻ 重新读取素材」只能把同一张旧图再交一遍 → 两边不一致。
- **修法**：缓存名 = `covers/ext/{mediaId}-{urlHash8}.{ext}`（`CoverService.externalCoverKey`）。
  URL 一变 = 新文件 = 立刻换新（浏览器也不会吃旧字节）；写入成功后清掉同 mediaId 的旧文件（含老命名 `{id}.{ext}`，删不掉就留着）。
- **副作用（要认）**：老命名的缓存文件**全部作废**（来源未知，不能当作"当前 URL 的图"），重启后第一次读素材会把用到的封面重下一遍；
  想清干净可以删 `data/covers/ext/` 里的老文件（纯缓存，DB 的 `external_cover_url` 就是真源）。
- **别改回"只看文件在不在"**：这个缓存**没有时效语义**，只能靠文件名绑定来源。
- 仍存的同类隐患（**未修，等用户点头**）：**手动上传/粘贴 URL** 的封面走 `CoverService.persist` → 文件名叫 `covers/{id}.{ext}`，覆盖上传不换名
  → 浏览器与 `accentCache`（按路径缓存）都会吃旧值。`covers/ep/` 那套「版本戳防浏览器缓存旧图」是现成的做法，要修照它抄；
  但 `media_reconcile` 那边按封面路径匹配的规则要先看一遍，别让版本戳被当成"要清理的自动下载封面"。

## §35 网格屏排版三条铁律（2026-09-26 用户四项点名后定稿）

1. **组标题行的「共 N 部」= 整组（子组）部数**，不是当前屏的张数；那枚第 1 档胶囊里的数字同理（`Scene.groupSize` / `Scene.groupTopCount`，由 `scene-plan` 在 push 场景时带上）。
   —— 用户原话：「推荐等级数量只是当前页面而不是该组所有」。**别再从 `media.length` 现场数**。
2. **行内张数由 `columns` 明确切分**（`GridScreen` 里 `gridRows(media.length, g.columns)`），
   **不要退回 `flex-wrap`**：卡片比列宽窄时 flex 一行能塞进比 `columns` 更多的卡 → 7 部显成「上6下1」。
   `gridRows` 保证每行最多差 1（7 → 4+3，10 → 5+5），`grid-geometry.test` 锁着。
3. **推荐序号 = 成片里的第几次露脸**（`Scene.numberFrom`，`buildScenePlan` 里的 `seq`，**跨组连续**）：
   底部进度条（`sceneLabel`）与资料卡大号数字都读它。**别再用 `PocMedia.order`**（那是 Java 的请求序号，
   分组重排后会出现「88-95 / 226」这种看不懂的数）；结尾回顾改成滚动清单（§36）后**不再显示序号**。
4. 附：**推荐理由按字数折行、最多两行**（超出省略号），两行预算已并入 `GRID.textRatio = 0.165`。

## §36 结尾回顾 = **分页小卡墙**（2026-09-26 用户两轮拍板）

**第一轮**：「结尾太长，几乎和整片一样了……先按推荐等级分组，然后年份，类似滚动条，一行展示：缩略图-番剧名称-集数」
**第二轮**（看完滚动清单版）：「不太舒服，小卡片一图流能支持吗」→「不要后面的背景框，直接展示。按年份左右往后直接铺开，完整展示。若本页展示不下，展示完毕后停留 5S，展示下一页。小卡片带标题，日期，集数」。

- **旧口径为什么长**（实测真草稿 222 部/185 部标了等级，`perScreen=4`、资料屏 7s）：每档除题头页外还要切 `ceil(n/4)` 屏网格，每屏 7 秒 → 3 页 + 47 屏 = **359s**（全片 831s 的 43%）。等于「按资料屏的节奏把全片重播一遍」。
- **现在**：每档 = 一页 `GROUP_INTRO` 题头（**保留**，sting 挂点未动）+ 一段 **`RECAP_LIST`**（新场景类型，一档一个场景、**组件内部翻页**）。
  一页 = 12 列 × 3 行 = **36 张**；卡片 = 封面(3:4) / 标题(最多两行) / `年份 · 集数`；页 = 错峰入场（0.025s/张，钳 0.5~1.5s）+ **停留**→ 下一页（页尾 0.25s 淡出）。
  同一份草稿实测：**51.7s**（1+3+2 = 6 页，占全片 6.3%）；补上「其它」那段后见下一条 **68.5s**。
- **「按年份铺开」的两种读法**（已拍板 ①）：① **按年份顺序打包填满**（年份印在卡上，页边界不切年份连续性）→ 6 页；② 「一年一组、整年不许跳页」→ 强推档 34 部摊 17 行、每行 2 张卡，全片 **≈ 15 页 ≈ 108s**。选 ①。
- **档内顺序 = 等级 → 年份**：**不要另写排序**——`groups` 本来就是「年份为主序」，`groups.flatMap(g => g.media)` 再按档 `filter` 天然得到该顺序。
- **停留秒数挂已有参数 `endingScrollSpeed`**（§33 里那个「结尾滚动速度」旋钮，分页形态下自然变成「每页停多久」）：
  `recapHoldSeconds` = `clamp(8 − 0.03 × speed, 5, 8)` → **100（用户当前值）= 5s**（他明说的那个数）、50 = 6.5s、0 = 8s。**不新增参数**。
  场景时长由页数算出，所以时间轴上这一段**拖不动**（`durationKeyOfScene` 走 default → null，与片段段同类）。
- **档序 = 强推 → 推荐 → 值得一看 → 一般 → 其它**：**空档不生成页**（题头与卡墙都不出）。未标等级那批（题头 **「其它」**，用户 2026-09-26 拍板用词，`UNMARKED_RECAP_TITLE`）**进回顾**（用户：「一般和未分类我没看到总结」）——旧规则「未分级不进回顾」本是为防「把全片重播一遍」，卡墙下一部 0.17s，37 部才多两页，规则已作废。
  同一份草稿实测：**68.5s**（4 段 = 1+3+2+2 = 8 页，占全片 8.2%）。
  ⚠️ 拿本库举例：「一般」档 **0 部**（222 部里 34/96/55 标了三档、37 部未标）→ 看不到「一般」那一页**是数据如此，不是 bug**；想让它出现得先在编辑器里给片标「一般」。
- **六个坑（出帧实测，别改回去）**：
  1. **卡内文字区必须按“两行标题”给预算**：第一版 `RECAP_TEXT_RATIO=0.062` → 只有单行标题的卡才看得到集数，两行标题的卡把集数顶出卡外被裁（现 0.074）。
  2. **集数那行在 133px 宽的卡里很容易超宽**：mono 是全宽字，`2000 年 · 167 集` ≈ 119px > 可用 115px → 被省略号吃。现用 `2000 · 167集`（年份不带“年”、“集”前不留空格、无 letterSpacing）≈ 103px。
  3. **不能给外层卡面**（用户：「不要后面的背景框」）：卡片自己就是卡面（深底 + 描边），直接落在画布上。
  4. **一页最多 36 张 → 不需要切片渲染**（上一版滚动清单要按视窗裁行，否则每帧挂两百张图）。
  5. **结尾（落款）那面封面墙必须封顶**：`Ending.tsx` 是**纵向居中**的 flex，封面墙是最后一个子元素 —— 全量铺时 222 部的墙 ≈ 21 行 ≈ 3600px，把居中的 `THE END` / 结尾标题 / 文案顶到画面**上方 1300px 之外**，成片里只剩一堆封面（用户 2026-09-26 报「最后结尾的感谢观看也没有」，属**老 bug**，草稿一大就犯）。现 `endingWallCount()` = 每行几张 × 2 行（1920×1080 实测 11×2 = **22 张**），剩下的全在回顾卡墙里。改 `wallRatio` / 墙的 `maxWidth` / `gap` 时**必须同步这个函数**（它按同源公式算行容量）。
  6. **摆哪几张 = 第 1 档优先 + 同档内按草稿 `seed` 确定性洗牌**（`endingWallCovers()`；用户 2026-09-26：「第一档然后随机展示就行」）。原来是 `input.media` 原顺序前 22 张（= **勾选顺序**，与等级/年份/分组无关）。
     实测真草稿：22 张 **全是「强推」**（强推 34 部 > 22 张，所以永远轮不到第 2 档）。真 `Math.random()` 不行：逐帧并行渲染，同一帧在不同 chunk 里会换一批（`seed` 取自 `params.seed`，即草稿里那个种子；同 seed 两次渲染必须一致）。
     想换一批：改草稿 `seed` —— 编辑器里 **🎲 换个摆位** 在**银幕式**那側（章节式目前没这个按钮）。
- **章节页缩略图排：满了就横滚**（用户 2026-09-26：「章节下方的图片如果展示不下的话无滚动效果，添加滚动」）。
  旧实现 `GroupIntro` 里 `.slice(0, 8)` —— 第 9 张起**直接丢掉**（报「共 34 部」却只给 8 张图）。现在：能摆几张摆几张（按内容区宽算，实测 11 张），多的撑开一条横向胶片条，
  **在本页时长内匀速滚完**（起手 0.4s、末 0.6s 停）；错峰封顶 `INTRO_THUMB_STAGGER_CAP`（否则横滚时后面的图会在已开始滚之后才显影）。
  实测本库：26 个年份页里 9 页超过 8 张（2024 年 28 张最多）→ 8 页会滚；回顾的「强推」题头页 34 张必定滚。
- **落地位置**：纯计算 `src/recap.ts`（+ `recap.test.ts`）、渲染 `src/scenes/RecapList.tsx`、计划 `scene-plan.ts` 结尾块、`GroupIntro.tsx` 缩略图排、`RecommendComposition` 分支、`editor/timeline.tsx` 段色。
- **日期只能给到年份**：`media.season` 是“系列第几季”（V31），**不是播出季度**，别当月份用。
- **未做/待定**：页数随素材量线性增长；想再少页数就加列/加行（14×3 = 42/页 → 5 页；16×4 = 64/页 → 3 页，但卡片只剩 100px 宽）；**没有**「每行显示推荐理由」「序号」。

### §33 补 · 未标等级那群**不加后缀**（2026-09-26 用户：「推荐显示未分级去掉」）

- `splitByTier` 里未标等级的子组 **组名直接用一级组名**（不再 `一级组名 · 未分级`），仍排在各档之后。
- ⚠️ 由此一个后果：`mediaOfGroup` **不能先做精确匹配**了（未标那群与一级组同名）——改成
  「先按 `parentName ?? name` 收子组，收不到才退回精确匹配」，否则章节页的「共 N 部」与缩略图只数到未标那批。
- 编辑器侧同一轮修的 bug：**等级只能勾不能取消** → 新增 `tier.tsx` 的 `cycleTier`（未标 → 强推 → … → 一般 → **未标**）
  与 `toggleTier`（面板里点同一档 = 取消）；候选卡胶囊上未标时显示「未标」（以前会显示最后一档的名字，看着像已选）。

## §37 BGM 条显示 = **曲子自身的位置**（2026-09-26 用户报：「音乐条进度显示有问题，显示的是视频进度」）

`src/chrome.tsx` 的 `BgmBadge` 是编辑器里那个「音乐条」（缩放/位置 X/Y 调的也是它）。旧口径**三处都在报非曲子的数**：

| 元素 | 旧（错） | 现 |
|---|---|---|
| 进度条 | `(帧 − 窗口起点) ÷ 窗口长度` | **曲内位置 ÷ 曲长** |
| 左边时间 | **绝对视频时间**（窗口起点 + 比例×窗口） | 曲内位置（循环后归零） |
| 右边时间 | **窗口长度** | **曲长**（`durationSec`，Java ffprobe 填） |

- **为什么"看起来就是视频进度"**：`bgmRange=all` 且曲长探不到（ffprobe 失败 → `durationSec` 缺省）时，整条时间轴退化成「一首盖满全片」→ 窗口 = 全片，三处数字必然等于视频进度。真草稿实测（839.5s 片长、200s 曲子）：修前显示 `1:00 / 13:59`，修后 `1:00 / 3:20`。
- 纯计算抽到 `bgm.ts` 的 `bgmBadgeState(frame, slot, fps)`（+ 单测）；`BgmSlot` 新增 `durationSec`（曲长）。曲长真的探不到时**退回窗口口径**（只能如此），此时条上仍是视频进度 —— 那是探测失败，看日志里的 ffprobe WARN。
- **静音段不挂条**：新函数 `bgmSlotIndexAt()` 按**该条自己的尾巴**判定，找不到活动曲 → 返回 -1 → 条不渲染。旧代码找不到时回退到第 0 条/最后一条，于是「BGM 只在开头+结尾」的片子中间十几分钟也挂着一条，写着毫无意义的位置（实测 300s 时显示 `1:25 ↻`）。
- **顺手修的单位坑（同源，一起改的）**：`<Audio startFrom>`（现名 `trimBefore`）**单位是帧，不是秒**（Remotion 类型定义写明 "in frames"；`getExpectedMediaFrameUncorrected` 也按帧插值）。旧代码把 `startFromSec` 直接传进去 → 结尾那段"曲子后半段"实际只跳到第 3.7 秒（`112` 被当成第 112 帧）。现统一走 `bgmStartFromFrames(slot, fps)`。
- **本条改动的影响面**：会改变**听到的结尾 BGM**（真的从后半段起放），并把 `bgmRange=all` 从「只铺一遍」改成「轮流铺到片尾」（见下）。
- **`bgmRange=all` = 轮流铺到片尾**（2026-09-26 修）：旧实现只把曲目列表走**一遍** → 曲目总长 < 片长时变成「全程只有前几分钟有音乐」（实测：200s 曲子 + 1000s 片子 = **4 分钟后全静音**；只因曲长探不到时 `fallbackSec = 片长/曲数` 恰好铺满，这个坑一直没暴露）。现在 `for (i < MAX_BGM_SLOTS && cursor < total)`、`tracks[i % tracks.length]`，每遍都从头放（不设 `startFromSec`）；`MAX_BGM_SLOTS=500` 只防脏值把循环跑飞。

## §38 编辑器：显示时长不设上限 + **手动渲染**（2026-09-26 用户两条要求）

### 一、「显示时长无限制可自由发挥」

旧上限（**三处**都钳，改一处没用）：编辑器 `<input max>`、`src/params.ts` 的 `durations`、Java `RecommendService.normalizeDurations`。
现只留**每段下限** + 一个防手滑兜底 **`MAX_SEGMENT_SEC = 600`**（填 999999 会让渲染跑几十小时，所以不是完全无上限；要再抬两处一起抬）：

| 段 | 下限（保留） | 旧上限 | 现上限 |
|---|---|---|---|
| 开场 / 序言 / 章节 / 资料卡 / 片名卡 / 结尾 | 2 / 1 / 1 / 3 / 1 / 1 | 20 / 10 / 10 / 15 / 5 / 10 | **600** |

- 两处常量必须同步：`backend/remotion/src/params.ts` 的 `MAX_SEGMENT_SEC` 与 Java `RecommendService.MAX_SEGMENT_SEC`。
- ⚠️ **改 Java 侧上限后必须重启后端**（IDEA 实例），否则**导出**仍按旧上限截断 —— 表现为「预览 30s、成片 20s」（预览是本地 `applyLocalParams` 算的）。

### 二、手动渲染：「● 应用并渲染」

状态模型（`editor/main.tsx`）：

- `config` = 右侧面板实时编辑的那份（便宜，不碰 Player）；
- `applied = { signature, config }` = **已应用到预览的快照**；`appliedConfig = applied.signature === signature ? applied.config : config`；
- `dirty = appliedConfig !== config` → 按钮显示 `● 应用并渲染`（高亮），否则 `⟳ 应用并渲染`；
- **例外（自动应用）**：
  1. `signature = sessionSignature(config)`（选片 / 片段 / 等级 `mediaMarks` / BGM / 模板形态）一变就自动应用一次 —— 这些字段的值来自后端 `remoteInput`，不应用会让预览和素材对不上；
  2. **时间轴/胶片条拖拽松手**（`useDurationDrag` 的 `onCommit` → `applyNow`）：拖拽是显式操作，松手即应用（否则拖完看不到变化，手感是坏的）；
  3. **点导出前**（`onExport` 里先 `setApplied` 再 POST，toast 附带「已先应用未应用的改动」）：导出走的是实时 config，不应用会出现「成片有改动、预览还是旧的」。
- `applyNow` **必须用 `configRef.current` + 现算 `sessionSignature(latest)`**：拖拽松手那一瞬的 React 闭包可能还是上一帧的 config —— 实测（同一次事件里连发 move+up）会把**旧值**写进快照，表现为「拖完按钮还是 ●、总帧不变」。修正后实测（真机）：拖一张时长牌 +62px → 总帧 30316 → **30376（+60 帧）且按钮保持 `⟳`（已应用）**。

- 吃 `appliedConfig` 的：Player、时间轴、胶片条、预估时长（都从 `rendered.plan` 来）。**别改回 `config`**：用户 2026-09-26 报的「右侧一更改信息就会重新渲染，太卡」就是这么来的（每次按键重建 inputProps → 整棵合成重渲）。
- 不吃它的：**导出 / 变体 / 局部重渲**（POST 实时 `config`）→ 没点「应用」也能导出最新改动。
- 实测（真草稿、浏览器）：把「结尾」10 → **30**（旧上限 10）后总帧**不变**（30256）、按钮变 `●`；点击后总帧 30256 → **30856 = +600 帧（20s×30fps）** ✓。

## §39 开场不要「显影中」计数（2026-09-26 用户：「开场这个显影中去掉吧」）

- `scenes/Opening.tsx` 底部那行 **`NN 显影中`**（`pad2(...)` + 「显影中」，`bottom: 0.09h`）**已删**。它是旧 HTML 模板「正在选片」的叙事残留，用户看片时点名去掉。
- 保留的是：错落封面逐个**显影**本身（`interpolate` 算 `grayscale/blur/brightness`，不是 CSS transition）、`SEASON IN REVIEW` + 标题 + 副标题、底部 `开场 · 进度 · mm:ss` 胶囊（`Trackbar`，与计数不是一回事）。
- 删完 `pad2` 在该文件已无引用（import 一并去掉）。

### 四、片段集变化也走手动（2026-09-26 用户：「片段更改信息仍是直接渲染，一并归入手动渲染」）

- **病因**：`sessionSignature()` 里原本含 `clips: config.mediaClips` → 勾/去/排序一个片段 = 签名变化 → 会话 effect 重建会话（`POST /session/<token>/render-input`）→ `setRemoteInput` → Player 整棵重渲。**参数类改动早就手动化了，片段类漏了。**
- **改法**：
  1. `sessionSignature()` **去掉 `clips`**（`editor/state.ts`，单测钉住「片段集变化不再进签名」）；
  2. 片段素材（`preparedClips`）只能由后端准备 → 片段集变了**仍必须重建会话**，但时机改成**点「应用并渲染」时**：`applyNow()` 比 `JSON.stringify(mediaClips)` 与 `appliedClipsKeyRef.current`（上次建会话时用的片段指纹，会话成功回报时写入），不同才 `setReloadTick(v => v+1)`。
- ⚠️ 别把 `clips` 加回签名，也别在片段改动时直接 bump `reloadTick` —— 那就是「一改就重渲」的老毛病。
- 实测（真机、真草稿）：勾一个片段 → **无任何 `/api/recommend/session` 请求**、总帧 **30856 不变**、按钮变 `● 应用并渲染`；点应用 → 恰好 **1 次** `render-input POST`、按钮回 `⟳ 应用并渲染`。
- 顺带发现（**数据问题，不是本条逻辑**）：`clips.material_state = REFERENCE_ONLY` 的片段（库里只有引用、没有本地源视频）勾了也不会进片 —— 后端报「找不到本地源视频，请将文件放入 data/videos」。选中这类片段时总帧不变是正常的。

### 五、开场卡片描边已删（2026-09-27，判定「划痕」= 卡片那圈 1px 白描边）

- 用户报开场「类似划痕的直线/空框」。代码层排查：章回式开场的**唯一**细直线来源就是卡片那圈 `1px solid rgba(255,255,255,.14)`（`TopLine` 在画面最上沿、`Stars` 是圆点、背景图已被用户自己排除）。
- 卡片处在「还没显影完 / 封面本身很暗」时，卡片内部几乎看不见，只剩这圈描边 + 投影 → 暗底上就是一条细直线（成片再经 H.264 → 断续，更像刮痕）。
- 处理：**删掉该描边**，投影保留并改为随显影进度淡入（`0.65 * progress`）→ 显影早期不再有硬边；进度 1 时观感与原来一致。
- **❗最终结论（2026-09-27 用户：「封面排序第9，卡片周围有一圈虚线，仍旧存在」）**：**根本不在画面里**，是**编辑器界面**的「🎬 拖到这里 = 加入开场秀」拖放框（`.vt-drop-opening`）—— 它**常态就是金色虚线**（`1px dashed rgba(255,209,102,.45)`，`#ffd166`）。开场秀名单（`<ol class="vt-opening-order">`，每行带 `idx` 序号）就渲染在这个框**里面**，所以第 9 个（以及整份名单）看着都像被一圈金虚线框住 = 用户说的「类似虚线金边」。
  - 数字证据：全项目 `grep -rn dashed` → **视频侧 0 处**；编辑器侧 5 处，**金色虚线仅此 1 处**；DOM 全量扫描（`getComputedStyle`）无其它虚线元素。
  - 处置：`.vt-drop-opening` **常态改淡实线**（`1px solid rgba(255,209,102,.16)`），金虚线只在 `.over`（真拖到上面时）出现 —— 拖放提示保留、静止时不再有线。
  - 顺带修真 bug：拖拽在框外松手时 `.over` 高亮**可能残留不消失**（`dragleave` 不来）→ 加全局 `dragend`/`drop` 兜底 `setDropZone(null)`（`editor/panes.tsx`）。
  - 按错误假设删掉的**开场卡片 1px 描边已还原**（`Opening.tsx` 与原来一致；只保留用户要的「删掉 NN 显影中」）。
  - 教训：**用户在编辑器里看到的「线」先分清是「画面内容」还是「编辑器 UI」**；`grep dashed` + DOM 扫描能一步区分，别再猜渲染管线。
- **✅收尾结论（2026-09-27，用户：「中间预览开场…切换到第 5 帧就能看到卡片周围有一圈金色线框」）**：两处都要治，**画面里那个就是开场卡片的 1px 描边**：
  - 像素证据：真草稿渲 `opening-f5` 「金色」像素 **0 个**，长亮线全是灰/蓝 → 画面里没有真金色，是**半透明白描边叠暖色背景**看着像金；
  - 预览 DOM 证据（`.vt-player-shell *` 全量）：223 张卡片 `DIV` 上边框/阴影**只有** `1px rgba(255,255,255,.14)` + 暗投影，全子树**金色边框 0 / dashed 0**，唯一 outline 是 Player 控制按钮的焦点环；
  - 处置：**删掉开场卡片 `border`**（保留暗投影）；改完重载预览再扫 → **223 张卡 `borderTopWidth = 0px`**、`cardsWithBorder: 0`、gold/dashed 全 0（有效果断言：别再把这圈描边加回去）。
  - 教训：**“是不是金色”不能靠眼睛定调** —— 先用像素/DOM 数字量一遍（`r-b>60` 的金色像素计数），再去猜来源。

- **❌已推翻（2026-09-27，用户当时就质疑「你在逗我？我看了图片哪有边框？」）**：~~线框既不是我们画的、也不是浏览器 UI，而是封面图自带的印刷亮边~~ —— 「外圈像素比内部亮 +28」这个统计量**证明不了有边框**（封面边缘本来就是亮内容）。保留此条当教训：**统计量要先说清它能证明什么**。
  - 数字证据：按开场顺序第 **9** 张（= 用户自己说的「封面排序第9」）`data/covers/ext/7540-386fed48.jpg` **外圈亮度 190 / 内部 130（+60）**，223 张里有 **18 张**这种自带亮边；反查：开场前 12 张里第 2/6/8/9/11/12 张都有 → 用户看到的「随机」= 哪张封面带这种边。
  - 为什么「和显影有关系」：显影早期 `grayscale/brightness(0.7)/opacity` 把封面压暗去色后，**只剩那条亮边看得清** → 看着像卡片周围一圈金线；显影完成后边融入画面就不再像线。
  - 处置：`openingReveal(progress)` —— **显影前 35% 完全不显示卡片**，35%→100% 线性显出（卡片出现时封面已有样子，亮边不会单独跳出来）。导出并加了 3 条单测（`src/grid-geometry.test.ts`）。
- **✅✅✅最终定位（2026-09-27 深夜，用户给出关键现象：「框在卡片**外**周围一圈」+「卡片内容显影切换时虚线会有一定**闪烁**」）**：真凶是 **卡片外层 div 上的 `filter: blur()` 的模糊外溢**。
  - 机制：**CSS `filter` 的绘制结果会画到元素矩形之外**（模糊外溢）→ 封面边缘像素被糊出卡片四周成一圈光晕；边缘亮度沿周边凹凸 → 那圈**断续**（实测 15~22 个亮段）；`blur`/`opacity` **逐帧**在变 → 那圈**闪**。它既不是 border/outline/dashed，也不在元素自己的像素里，所以 DOM/CSS/元素像素三层都查不到（前 6 轮全栽在这）。
  - 数字（卡片 275×391 @1080p、基线取矩形外 **30px** 那圈）：σ=5 → 矩形外 1px **+68**、2px +51、4px +29；σ=1.5 → +48/+19.5/+3，断成 **15 亮段/14 隙**；把 blur 挪到**内层 `<img>`**（外层 `overflow:hidden` 裁掉）→ **所有距离 0.0**。
  - 逐帧（`developFrames=42`）：矩形外 1px 的可见亮度差 帧14 `0` → 帧30 `+26.3` → 帧42 `0`，每帧最大 ±4.3 = 「闪烁」。
  - **处置（用户拍板 A）**：`filter` **必须加在内层 `<img>`**、不能加在卡片外层 div（`Opening.tsx`）。代价：显影时卡片外轮廓不再是糊出来的软边，而是清晰圆角矩形（内容仍在溶解）。
  - ⚠️ **别把 `filter` 挪回卡片外层 div**（会立刻复活「卡片外一圈会闪烁的虚线」）；另：探针基线**不能用自己换算的 RGB 灰度**（ffmpeg `gray` 是 limited-range：`#08070f` → Y=23），否则量程差会被当成光晕。
  - 教训：**「元素外一圈线」优先怀疑画在元素矩形之外的东西（filter / box-shadow / blur 外溢）**，别只在 `border/outline` 里找。
  - 试过但不采用：**裁掉印刷边**（居中裁 6/10/14% 实测只能把 +61 降到 +39/34/28，边太厚，裁不干净，还会裁掉画面）。

## §40 导出渲染：**props 里不许塞二进制**；章节式也有段边界（2026-09-27）

- **封面禁止再内联成 base64**（事故：导出必崩 `Page.addScriptToEvaluateOnNewDocument: Target closed`）。
  - 真因链：`RecommendVideoService` 传 `coverMode="embed"` → `resolveCover` 每张封面转 data URI；2026-09-25 封面链改成 Bangumi 优先后，223 部用的是 `covers/ext/*.jpg` 高清缓存（**实测 86.9MB → base64 ≈ 119MB**），Remotion 往页面注入 props 时 Chrome 目标直接挂。对照：2026-09-21 那次成功导出输入只有 **3.06MB / 内联 12 张**。
  - 复现（已留证）：把任意小输入灌满内联封面到 **120MB** → 同一条命令**必现**；降回小体积即正常。13 秒就死，报错里只有一句 CDP 异常 → 别再往「Chrome 坏了 / GL 后端」方向查：`npx remotion browser ensure` + 四种 `--use-gl/--use-angle` 手动起都正常。
  - 现在：导出走 **`"url"` 模式**（封面路径形态）+ 渲染脚本 `--covers-root <data/covers 绝对路径>`，由素材服务托管 `/covers/**`。props 实测 **4.57MB**。
- **根相对素材在渲染页面里必须改写成绝对地址**：Remotion 页面挂在它**自己内部 server**（端口随机）上，`/covers/...`、`/site/bg/...` 这类根相对路径会打到那个 server → 404。这就是当初「内联 base64」存在的原因；`render-recommend.ts` 现在把 `/covers/**` 改写成 `${assetOrigin}/covers/**`。
  - 素材服务两个根：`<root>/assets/**`（片段/BGM/sting）、`/covers/**`（封面根，可选）。**两个根都要先 `path.resolve`**：`safePath` 用规范化结果做前缀比对，传 `D:/x/y` 这种正斜杠根会全量 400（实测踩过）。回归测试：`scripts/asset-server.test.ts`。
  - 另加 props 体积看守：输入 JSON **>32MB** 就打 `warn`（提示「封面是否又被内联成 base64」）—— 这个故障模式报错极难猜，留个路标。
- **分块切点按段边界**：现在**两种模板都有** `boundaryFrames`（银幕式 `buildCinemaPlan`、章节式 `buildScenePlan`，同一份 plan 与 composition 校验总帧数）；Java 侧 `RenderChunks.planByBoundaries` 通用，拿不到边界才回退固定 120s。章节式 223 部实测：`[0,510,1020,…]`（之前是 `null`）。
- **别信「旧测试是绿的」**：`RecommendServiceTest.显示时长归一化到默认区间` 在 2026-09-26 改规则后一直失败（期望上限 20s）没人管。改这类「上限/默认值」规则时，**同 PR 里搜一遍断言旧值的测试**。

### §40 附：导出任务生命周期三态（2026-09-27 事故后定稿）

- **`killChild` 必须杀「整棵树」**：Java 起的 tsx 进程下面还有真正渲染的 node（`tsx/dist/preflight`）和一串 `chrome-headless-shell`；只 `destroy()` 父进程，孙进程会继续烧 CPU。顺序：**子先父后** → 等 2s → `destroyForcibly`。
- **`pause` 只在块边界生效**（设计如此，别当 bug 修）：一个 PAUSED 任务可能仍在渲当前块、并把后面的 PENDING 堵住。所以：`delete()` 对 PAUSED **必须先 `killChild` 再删工作目录**（否则线程继续渲、目录被抽走 → 白占队列 + 孤儿块产物）；UI 必须把这件事说出来（DTO 的 `active` 字段 + 「排队中 · 正在渲 #N」/「正在收尾当前块」）。
- **不要相信「异常会被看见」**：`updateStage` 的 SQL 缺了一对引号（`status = RUNNING`），MySQL 报 `Unknown column 'RUNNING'`，被 `onStage` 的 catch 吞成 WARN → **stage 文案从来没写进库**、任务面板一直是空。改 mapper 的 SQL 后，先 `grep -n "status = [A-Z]"` 扫一遍同型裸字面量。
- **串行队列的可见性**：PENDING 在 UI 上和「卡死」长得一模一样。凡是单线程串行执行的东西，都要能回答「谁在占」。

### §20 附：清单排序的**两套口径**必须一致（2026-09-27）

「按年份分组」时排序曾经只在成片侧生效、清单侧写死倒序（`buildListText` 的 `order.sort` 恒为 `Number(b)-Number(a)`，UI 还挂着「（分组时排序不生效）」自我交代）。**同一件事（年份组顺序）出现在两处就必须同源**：`src/scene-plan.ts` 的 `groupMedia()` 与 `editor/export-list.ts` 的 `buildListText()` 现在都读排序开关（`groupSort` / `sortBy`），「不排序」时两边都沿用年份倒序、「年份未知」永远排最后。

## §41 Animeko WEB 缓存文件命名有**两代**，C2 定位必须都试（2026-09-29 修：集灯莫名 missing）

- **现象**：Animeko 里显式缓存了某集、文件也在 `media-downloads/web-m3u/` 里，但集灯是 missing、本地回顾不可用（`/api/episodes/{id}/material/channels` 返回 `UNAVAILABLE`）。
- **原因**：Animeko 把 WEB 缓存的文件名从 `{mediaId}.{ext}` 换成了 `http-v2-{sha256}.{ext}`，而 registry（`datastore/mediaCacheMetadataV2`）里**只有 `origin.mediaId` / `metadata.subjectId` / `metadata.episodeId`，没有任何路径字段** → 只按 `mediaId.ext` 猜路径必然落空。
- **新命名公式**（Animeko `HttpMediaCacheEngine.httpDownloadId`，实测 9/9 文件吻合）：
  `http-v2-` + `sha256("${len(mediaId)}:${mediaId}${len(subjectId)}:${subjectId}${len(episodeId)}:${episodeId}")`，输出文件再加扩展名。
  Kotlin `String.length` 与 Java 同为 UTF-16 码元数，`String.length()` 直接用；`MessageDigest` + `HexFormat` 够用，别加依赖。
- **旧代命名**：`{mediaId}.{ext}`，其中 `[\/:*?"<>|]` 被换成 `-`（`toSafeDownloadId`）。旧缓存仍在，**两代都要试，v2 优先**（与 Animeko 自己的 `restoredHttpDownloadId` 偏好一致）。
- 唯一真源：`AnimekoCacheLocator.engineFileCandidates()`；**黄金样例**（真实三元组）：零之使魔 双月骑士 / subjectId=1103 / episodeId=2957 → `http-v2-73b20a95fd2079401ccab838451d77bdb046220e4139cb44780b7bf8e0884415.mp4`，见 `AnimekoCacheLocatorTest.httpV2NamingHit`。
- 排查这条路别乱猜哈希：文件名 ↔ 真实 URL 的对应只在 Animeko 自己的 `data/logs/app.log`（`Preparing to download with id=http-v2-…, url=…`），公式去 Animeko 源码 `HttpMediaCacheEngine` 找；sha256(uri)/sha256(mediaId) 这类猜测全部 miss。
