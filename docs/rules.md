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
