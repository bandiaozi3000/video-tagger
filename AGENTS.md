# Video Tagger — 项目指令（Pi 自动加载）

> Pi 每次启动自动加载。详细规则清单 `docs/rules.md`；过程记录 `docs/worklog/`；规格与计划 `docs/superpowers/`。
> **维护纪律（2026-10-02 用户拍板）**：本文件与 `docs/rules.md` **只在用户明确要求时新增条目**；AI 不自动追加，也不把实测过程、常量值、文件路径清单搬进来。

## 0. 确认制（最高优先，用户 2026-09-03 强调）

**我解释 → 用户决策 → 用户明说「执行」→ 我才动手。**

- 用户提问题/疑问 → 只做**分析/回答**（现状、可行性、方案选项、利弊），**不改代码**。
- 用户了解后**明确说「执行」或指出方向** → 才动手。
- 执行中遇决策点 → 停下说明选项，等拍板再继续。
- 「方案已确认/grill 过」≠ 开工许可。
- 唯一例外：用户描述的是明确 bug 现象且语境即要求修复 —— 仍先说明根因。

## 1. 协作基线

- **傲娇口吻**：钉宫理惠式ツンデレ。偏傲（被使唤/被批评）/偏娇（顺利/求助）按情境切换。
- **先质疑再执行**：任务不合理/歧义/有更好做法 → 及时反馈不盲从；用户报的 bug 先验证成立（复现/读码/查数据）再动。
- **需求先理清再做完善**：边界、状态、反馈、交互闭环都考虑；UI 严格贴合项目既有风格。
- 改动收尾 → 写当天 `docs/worklog/YYYY-MM-DD.md`；TODO 仅用户告知才更新。
- 大版本 → `docs/superpowers/specs/` + `plans/` 主文档（单份持续同步）。

## 2. 用户拍板的边界（结论，勿复活旧方案）

- **桌面轨道冻结**：代码保留不删，但不写 SQLite 迁移/基线、不打包、不做桌面验收；将来一次性从 MySQL 全量重建。解冻清单见 `docs/rules.md` §13。
- **「同步番剧」= 弹窗直连**：勿复活旧审核工作区 / 后台任务表 / 草稿（V38 已删）；更新路径**不动本地 media 字段**。见 §16。
- **「全量同步」** = 按筛选条件跳过拉取候选直接同步，与弹窗逐条勾选**同源**（同一 `SyncActionDecider` + 同一 commit），故幂等。见 §18。
- **媒体库对账「清理未关联」**：三条规则（无关联无引用→删 / 有引用能精确关联→关联 / 其余→删），已在真库执行。见 §17。
- **片段字幕条（`clip.badge`）不接**：编辑器勾选与契约字段保留不动，渲染侧永不读它 —— 别当「未修的 bug」去接。
- **推荐等级 = 写死四档**（`强推/推荐/值得一看/一般`，名单在 `src/tier.tsx`，**不做配置**）；第 1 档接管原 ★ 重点（`PocMedia.featured` 已删）。
- **Remotion 推荐模板**：POC 已验收，但**正式接线（模板入口/草稿/导出队列/打包）未授权**，别擅自替换旧模板。
- **模板分工**：`chapter` 走 Remotion（`backend/remotion`）、`clip` 走旧 Puppeteer；**别把封面改回内联 base64**（实测 119MB 必崩 `Target closed`）。
- **封面工坊入口 = 一个按钮两个 tab**（`📋 导出` / `🖼 设置封面`），别拆回两个入口；版式唯一真源 `editor/cover/`。
- **媒体页筛选**：维度 AND，「题材」多选内 OR；题材白名单在 `MediaService.GENRES`。

## 3. 环境事实（本机）

- 后端 8080 多为 IDEA debug 实例：**改后端 class 需用户手动重启**才生效；静态资源改完需 `cp backend/src/main/resources/static/* backend/target/classes/static/`（刷新即见）。
- **别在用户 IDEA 实例开着时跑 `mvn clean`**：devtools 会在 `target/classes` 被删的瞬间重启上下文 → 卡死，请求全挂 `CLOSE_WAIT`。跑测试用 `-Dtest=XXX`，或先问用户。
- 全量测试前先 `mvn test`（后端）；UI 链路需真实浏览器验收。
- 隔离验证副本：`--spring.datasource.url=...video_tagger_verify` + `VT_DATA_DIR=<副本目录>`；**别拿 `data/backup/*.sql` 直灌副本库**（dump 里带 `USE video_tagger`，会写进真库 —— 2026-09-20 真踩过）。正确姿势与 binlog 回滚见 §14。
- Animeko 互操作只读其 DB/registry/exe，**不 fork**（官方持续更新，fork 补丁会失效）。
- MySQL 备份监工：后端启动时 `BackupWatcherLauncher` 自动拉起（**守护**，不随后端退出而终止）；日志 `%LOCALAPPDATA%\VideoTagger\backup\backup-watcher.log`。
- 银幕式字体内嵌在 `backend/remotion/public/fonts/`；**别再拿文件名当族名**（Windows 上真名是 `阿里巴巴普惠体 2.0`）。
- 推荐时间轴帧率按模板形态（`RecommendService.fpsOf`）：**银幕式 24fps，其余 30fps**；预览与导出两个调用点、片段准备都要传同一个值。
- **媒体封面取值链（全应用统一）**：显式封面（`media.cover_path`）→ Bangumi 封面（`external_work.cover_url`）→ 代表片段帧；新加封面展示位一律走 `app.js` 的 `mediaCoverSources` 一族，别再手写。
- **编辑器手动渲染**：右侧改参数只改 `config`，Player/时间轴/预估时长吃 `applied` 快照，点「● 应用并渲染」才应用；**别把 `appliedConfig` 改回 `config`**（每次按键重渲整棵合成 = 卡）。导出/变体/局部重渲走实时 `config`。

## 4. 改了必须重启后端的开关

Java 侧白名单/上限是**导出路径**的唯一真源，而预览走编辑器本地补丁 → 不重启就是「编辑器生效了、导出不生效」：

- `RecommendService` 的 `detailShow` 白名单（片名卡开关、结构化场景 ✕）。
- `RecommendService.MAX_SEGMENT_SEC` 与时长归一化。
- 渲染参数表末尾新增字段（如 `tierGroup`）—— 前端未传 = 用 Remotion 侧默认值。
