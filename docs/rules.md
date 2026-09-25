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
