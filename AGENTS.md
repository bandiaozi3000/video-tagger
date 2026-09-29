# Video Tagger — 项目指令（Pi 自动加载）

> 本文件是 **Pi 在本项目每次启动都会自动加载的指令/记忆载体**（替代旧 Claude memory 机制）。
> 详细规则清单与溯源见 `docs/rules.md`；本文件只放「每次必须带」的核心。

## 0. 确认制（最高优先，用户 2026-09-03 强调）

**我解释 → 用户决策 → 用户明说「执行」→ 我才动手。**

- 用户提问题/疑问 → 我只做**分析/回答**（现状、可行性、方案选项、利弊），**不改代码**。
- 用户了解后**明确说「执行」或指出方向** → 才动手。
- 执行中遇决策点 → 停下说明选项，等拍板再继续。
- 「方案已确认/grill 过」≠ 开工许可；**动手改代码前仍需单独确认**。
- 唯一例外：用户描述的是明确 bug 现象且语境即要求修复（如「播的是片段不是整集」）——仍先说明根因，若上一步刚确认过该方向可直接修完汇报。

## 1. 协作基线

### Remotion 多媒体推荐 POC（2026-09-14）

- 已确认新增并存的“多媒体混合推荐”模板方向：复用当前推荐向导的多媒体 `ids + mediaClips` 选择语义；媒体无 Clip 时保留资料卡，有 Clip 时播放选定片段。
- 最小 POC 已于 2026-09-14 完成并**验收通过**（813 帧、两次渲染一致、资料-only 媒体保留资料卡、有声/无声段音频符合预期）。
- 生产接线（正式模板入口、草稿接线、导出队列、Electron 打包）**仍待用户单独授权**；尚未授权替换旧模板或迁移 `RecommendVideoService`。
- 遗留：真实渲染未覆盖“同一媒体 2 个 Clip”（真实库无足够素材）；Remotion 自带 Chrome Headless Shell 约 521MB，打包体积未评估。
- 设计规格：`docs/superpowers/specs/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-design.md`；执行计划：`docs/superpowers/plans/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-plan.md`。
- **片段字幕条（`clip.badge`）明确不接（用户 2026-09-20 拍板「不接，保持现状」）**：编辑器里那组勾选（媒体名/片段名/序号/备注/自定义）与契约里的 `RecommendMediaClips.Badge` 都**保留不动**，但银幕式渲染侧永远不读它 —— 别当“未修的 bug”去接。旧实现只在 `templates/archive/recommend-clip.html`（已退役 HTML 模板）里。
- POC 通过前，Remotion 工程保持独立，输入使用本地 JSON/资源包，不新增数据库表、不改默认模板、不把真实媒体资源提交到 Git。

### 桌面轨道冻结（2026-09-17 用户拍板）

- 桌面端（Electron 壳 + SQLite 数据源）当前不使用：**代码保留不删，但不再同步维护**——不写 SQLite 迁移/基线/列清单、不打包、不做桌面验收、不升桌面包版本。将来要用时一次性从 MySQL 全量重建。
- 唯一"每天在动且无报错"的风险：`body.desktop-mode` 布局依赖 `#titlebar` / `.sidebar` / `.statusbar` / `.container` 四个容器——改 `index.html` 大结构时保留它们。
- **不属于冻结范围（勿误删）**：`sqlite-jdbc` 依赖与 `AnimekoTagService` / `AnimekoWatchImportService`——它们用 SQLite JDBC 当客户端读 Animeko 自己的库，与桌面数据源无关。
- 详细规则与解冻清单：`docs/rules.md` §13。

- **傲娇口吻**：钉宫理惠式ツンデレ。偏傲（被使唤/被批评）/偏娇（顺利/求助）按情境切换。
- **先质疑再执行**：任务不合理/歧义/有更好做法 → 及时反馈不盲从；用户报的 bug 先验证成立（复现/读码/查数据）再动。
- **需求先理清再做完善**：边界、状态、反馈、交互闭环都考虑；UI 严格贴合项目既有风格。

## 2. 项目工作流要点（详细见 docs/rules.md）

- 改动收尾 → 写当天 `docs/worklog/YYYY-MM-DD.md`；TODO 仅用户告知才更新。
- 大版本 → `docs/superpowers/specs/` + `plans/` 主文档（单份持续同步）。
- 双库演进：**已冻结**——只维护 MySQL Flyway VNN；SQLite 侧（`migration-sqlite/vNN.sql`、`sqlite-schema.sql` 基线、`SqliteSchemaMigrator` 版本断言）不再同步维护。解冻清单见 `docs/rules.md` §13。
- **「同步番剧」= 弹窗直连（2026-09-21 简化，勿复活旧工作区）**：年/季/月多选 → 拉取候选 → 勾选 → 直接同步 → 报条数；旧的独立审核工作区 / 后台任务表 / 草稿已删（V38 删表），详见 `docs/rules.md` §16。更新路径**不动本地 media 字段**（标题/年份/备注/评分/状态/封面一律不写）。
- 记忆同步：改规则 → 同步 `docs/rules.md` 清单（Pi 不读 `~/.claude/.../memory/`）。
- **「全量同步」= 按筛选条件跳过拉取候选直接同步（2026-09-25 拍板）**：与弹窗逐条勾选**同源**（同一 `SyncActionDecider` + 同一 commit），故幂等；任务表 V41，与对账共用单线程 `mediaBatchExecutor`。**改这块前必读 `docs/rules.md` §18**（尤其「取消随机失效」那个坑：循环内绝不能 `updateById(job)` 写进度，会把 `CANCELLED` 覆盖回 `RUNNING`）。
- **媒体页筛选（2026-09-25 重构）**：主行 = 搜索 + `⚙ 筛选(n)` + 条件 chips（各带 ×）+ 清空，排序/视图归右侧；浮层左栏维度、右栏取值（**带计数**），点选即时生效、面板不关。**维度 AND；题材多选、同维度内 OR。** **改这块前必读 `docs/rules.md` §19**（题材为什么要白名单：Bangumi tag 全库 17871 个值、人名/公司/年份/吐槽全混着；以及「浮层被自己关掉」那个坑：判外部点击**只能用 mousedown**，click 阶段 `contains`/`composedPath` 都失效）。
- **媒体库对账「清理未关联」（2026-09-25 已在真库执行）**：无 Bangumi 关联且无引用 → 删；有引用且能精确关联（**含 `infobox.别名`**）→ 关联；剩余 → 删。**改这块前必读 `docs/rules.md` §17**（OFFSET 分页两种模式都不成立、删除要补 `media_entry`/`title_mapping`/`highlight_project`、`mvn spring-boot:run` 的工作目录会被解析成 cover-dir 导致封面静默删不掉）。

## 3. 环境事实（本机）

- 后端 8080 多为 IDEA debug 实例：**改后端 class 需用户手动重启**才生效；静态资源改完需 `cp backend/src/main/resources/static/* backend/target/classes/static/`（刷新即见）。
- Animeko 互操作只读其 DB/registry/exe，不 fork（官方持续更新，fork 补丁会失效）。
- 隔离验证副本：`VT_DATA_DIR=<副本> nohup mvn -q -o spring-boot:run -Dspring-boot.run.arguments=--server.port=18099`。**要连副本库时**：`--spring.datasource.url=...video_tagger_verify` + `VT_DATA_DIR=<副本目录>`；**别拿 `data/backup/*.sql` 直灌副本库**（dump 里带 `USE video_tagger`，会写进真库 —— 2026-09-20 真踩过，用 binlog 才捞回来；正确姿势与回滚步骤见 `docs/rules.md` §14）。
- Animeko 路径自动探测：DB=`%USERPROFILE%\AppData\Roaming\Him188\Ani\data\ani_room_database_main.db`，exe=`D:\Tool\Ani\Ani.exe`。
- 全量测试前先 `mvn test`（后端）；UI 链路需真实浏览器验收。
- **MySQL 备份监工（2026-09-20 用户指令）**：后端启动时由 `config/BackupWatcherLauncher` 自动拉起 `scripts/backup-mysql-watch.ps1`（幂等：容器健康→**立刻备一次**→之后每 60 分钟；双写 `data/backup/` + `%LOCALAPPDATA%\VideoTagger\backup`；留 3 代；全局互斥 `Global\VideoTagger-MySqlBackupWatcher`），每 5 分钟看护重拉（子进程退出码 0 = 已有实例在跑→不重拉）。它是**守护**：不随后端退出而终止（后端重启/关掉都不影响备份节奏）。开关 `videotagger.backup.enabled`（`BACKUP_WATCHER_ENABLED=false`）。`scripts/install-backup-watcher.ps1`（计划任务）**变成可选**，两个渠道靠互斥共存。查看日志：`%LOCALAPPDATA%\VideoTagger\backup\backup-watcher.log`；手动停：`Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | ? CommandLine -like '*backup-mysql-watch*' | % { Stop-Process -Id $_.ProcessId -Force }`。
- **PowerShell + Docker 探测的坑（2026-09-20 实测）**：`$ErrorActionPreference='Stop'` 时，原生命令（`docker info`）往 stderr 写会变成**终止性异常**，Docker Desktop 重启的那几分钟会让监工直接自杀退出（当天日志里发生两次）→ 脚本里所有 docker 调用必须走 `Invoke-DockerQuiet` 包装（临时改 `Continue` + 只看 `$LASTEXITCODE`）。
- 银幕式（cinema）字体：内嵌在 `backend/remotion/public/fonts/`，由 `src/cinema/fonts.tsx` 注入；**别再拿文件名当族名**（`阿里巴巴普惠体 2 115 Black` 在 Windows 上永不命中，系统真名是 `阿里巴巴普惠体 2.0` / `Mona Sans`，只当兜底）。开场时长由用户设置直接决定（`scan = 55%`），掠影拍点在短场景下会等比压缩。
- **推荐等级 = 写死四档，第 1 档接管 ★ 重点（2026-09-26 用户拍板并实施）**：`强推 / 推荐 / 值得一看 / 一般`（名单在 `backend/remotion/src/tier.tsx` 的 `RECOMMEND_TIERS`，**不做配置**）；名次→视觉（0 彩虹 / 1 金 / 2 青 / 最后一名 = 默认卡片）唯一真源是 `tierLook`；每部媒体的标注存 `EditorConfig.mediaMarks: {tier?, reason?}`（稀疏，零迁移），Java 侧对应 `RecommendService.MediaMark`；`PocMedia.featured` 已删（老草稿的 `featuredIds` 自动迁成第 1 档）。改这块前必读 `docs/rules.md` §32。
- **序言/简介是「语义富文本」（2026-09-26 用户两轮拍板）**：块级 `## 小标题` / `- 条目` / 空行分段；行内 `**加粗**`、`==重点==`（金）、`!!提醒!!`（红）、`++信息++`（青）。语法唯一真源 `backend/remotion/src/rich-text.tsx`（编辑器按钮 + chapter 序言 + 银幕式简介共用）；`config.intro` **仍是纯字符串**，解析只发生在渲染侧；预算/收字号是 `INTRO_LAYOUT + fitIntroSize`（渲染与编辑器预算条共用）。改这块前必读 `docs/rules.md` §31（含「加粗必须提亮」「语义色固定」「验收脚本必须先备份草稿」三套实测结论）。
- **媒体封面取值链（2026-09-25 用户拍板反转，全应用统一）**：**显式封面（`media.cover_path`）→ Bangumi 封面（`external_work.cover_url`）→ 代表片段帧（`fallback_cover_path`）**。
  - 反转理由：「**手动上传的封面以本地为准**」；而**自动下载的本地封面在对账时已全部清掉**（`media_reconcile`），所以这两级实际不会打架。
  - 前端唯一实现在 `static/app.js` 的 `mediaCoverSources/mediaCoverSrc/mediaCoverAttrs`（卡片/列表行/搜索卡/回收站/详情都走它）；编辑器同序（`backend/remotion/editor/panes.tsx`）；推荐视频与单集推荐后端同序（`RecommendService.resolveCover` / `RecommendSingleService.firstCover`）。
  - **新加封面展示位请走这条链**，别再手写 `externalCoverUrl || coverPath || ...`。
  - Bangumi 封面缓存位置：`CoverService.ensureExternalCover` → `covers/ext/<mediaId>.<ext>`，**故意不写 `media.cover_path`**。
  - 目录约定（别混）：`covers/<数字>.<ext>`=media 封面、`covers/clip/`=片段、`covers/ep/`=单集、`covers/ext/`=Bangumi 缓存。
- **BGM 条（编辑器里的「音乐条」）显示的是曲子自身的位置**（2026-09-26 修：用户报「显示的是视频进度」）：进度 = 曲内位置 ÷ **曲长**（`bgm.ts` 的 `bgmBadgeState`），左边时间是曲内位置、右边是曲长（不是窗口长、不是绝对视频时间）；**静音段（窗口之间）不渲染条**（`bgmSlotIndexAt`）。另：`<Audio startFrom>`（现名 `trimBefore`）**单位是帧不是秒** → 一律用 `bgmStartFromFrames(slot, fps)`。**改这块前必读 `docs/rules.md` §37。**
- **编辑器两件套（2026-09-26 用户要求）**：①「显示时长」不设上限（旧上限 20/10/10/15/5/10 → 只留下限 + `MAX_SEGMENT_SEC=600` 兜底；常量在 `src/params.ts` 与 Java `RecommendService` **两处**，**改 Java 后需重启后端**，否则导出仍按旧上限截断）；②**手动渲染**：右侧改参数只改 `config`，Player/时间轴/预估时长吃 `applied` 快照，Player 下方工具条右侧的 **「● 应用并渲染」** 才应用（**自动应用的三个例外**：`sessionSignature` 变化 / 时间轴**拖拽松手** / 点**导出前**）。**别把 `appliedConfig` 改回 `config`**（每次按键重渲整棵合成 = 卡）。**片段集改动也走手动**（`sessionSignature` 里**故意不含 `clips`**；点应用时才比对片段指纹重建会话——“片段素材必须后端准备”）。导出/变体/局部重渲走实时 `config`。**改这块前必读 `docs/rules.md` §38。**
- 推荐视频渲染：`chapter`（含 `stream`/`overview` 回退）走 **Remotion**（`backend/remotion`，需先在该目录 `npm install`；可用 `RENDER_REMOTION_DIR` 覆盖）；`clip` 样式仍走旧 Puppeteer `render.js`。**导出崩溃 `Target closed` 的第一嫌疑 = props 里塞了二进制**（封面内联 base64 → 实测 119MB 必崩）：导出走 `"url"` 模式 + 渲染脚本 `--covers-root` 托管 `/covers/**`，**别把封面改回内联**；分块切点两种模板都按段边界（`boundaryFrames`）→ 改这块前必读 `docs/rules.md` §40。`RENDER_FFPROBE_PATH` 不配则按 ffmpeg 同目录探测（探不到时会先试一次混合再回退，会多一条 WARN）。Player 预览页需先在 `backend/remotion` 跑 `npm run build:player`（产出 `dist-player/`，已 gitignore；产物不存在时 `/preview` 自动回退旧 HTML）。
- **推荐视频分组 = 两级（2026-09-26 用户拍板并实施）**：一级 `groupBy`（不分组/年份/分类/收藏夹），二级**固定按推荐等级**（`强推→推荐→值得一看→一般`，未标等级那群垫最后、**组名不加后缀**），开关 `tierGroup` **默认开**；整组没标等级就不切（老草稿零变化）。**「本组核心」区已按用户要求整块删除**，第 1 档靠分组 + 卡片标识；结尾改成**按全局等级分组回顾**（`全片回顾 · <档名>` 题头页 + **`RECAP_LIST` 分页小卡墙**：12×3 = 36 张/页，卡片 = 封面 / 标题 / `年份 · 集数`，页 = 错峰入场 + 停留→下一页；**页时长由页数算出、停留挂已有参数 `endingScrollSpeed`（100 → 5s）、时间轴上拖不动**；**「其它」（未标等级）也单独出一段**「全片回顾 · 其它」（题头常量 `UNMARKED_RECAP_TITLE`；用户 2026-09-26 定名），空档（如「一般」0 部）不出页）。**结尾（落款）封面墙已封顶为两行且「第 1 档优先 + 同档内按草稿 `seed` 洗牌」**（`endingWallCount()` / `endingWallCovers()`；封顶前 222 部会铺 21 行、把「感谢观看」顶出画面 —— 用户报过）。另外**章节页缩略图排超过能摆的张数就横滚**（不再是 `.slice(0,8)` 直接丢）。**改这块前必读 `docs/rules.md` §33 与 §36**（§36 含：档内顺序靠 `groups` 展平而非另写排序、卡内文字区按两行标题给预算、集数那行在窄卡里会超宽、章节页缩略图横滚、结尾封面墙封顶与选人规则；以及：章节页只挂每个一级组第一子组、`mediaOfGroup` 按 `parentName` 合并、sting 挂点改到 `GROUP_INTRO`、Java 参数表末尾新增 `Boolean tierGroup` → 导出需重启后端）。
- **推荐时间轴帧率按模板形态（2026-09-20 用户拍板）**：`RecommendService.fpsOf(groupStyle)` → **银幕式 = 24fps**（番剧素材实测清一色 23.976；24fps 时间轴下逐帧都落在真帧上，不再每 5 帧补一帧，且素材零重编码直通），**其余模板 = 30fps**（旧行为一字不动）。预览（`RecommendController`）与导出（`RecommendVideoService`）两个调用点都必须用 `fpsOf`，片段准备 `RecommendClipSourceService.prepare(..., fps)` 也要传同一个值（其 0.05 容差让 23.976 直通）。**判“帧节奏是否均匀”只能用帧间差**（`tblend=all_mode=difference,signalstats` 的 YAVG），**不能用 md5**（h264 重编码会把同内容像素改写 ±1 → 假阴性）。
