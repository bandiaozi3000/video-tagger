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
- 记忆同步：改规则 → 同步 `docs/rules.md` 清单（Pi 不读 `~/.claude/.../memory/`）。

## 3. 环境事实（本机）

- 后端 8080 多为 IDEA debug 实例：**改后端 class 需用户手动重启**才生效；静态资源改完需 `cp backend/src/main/resources/static/* backend/target/classes/static/`（刷新即见）。
- Animeko 互操作只读其 DB/registry/exe，不 fork（官方持续更新，fork 补丁会失效）。
- 隔离验证副本：`VT_DATA_DIR=<副本> nohup mvn -q -o spring-boot:run -Dspring-boot.run.arguments=--server.port=18099`。**要连副本库时**：`--spring.datasource.url=...video_tagger_verify` + `VT_DATA_DIR=<副本目录>`；**别拿 `data/backup/*.sql` 直灌副本库**（dump 里带 `USE video_tagger`，会写进真库 —— 2026-09-20 真踩过，用 binlog 才捞回来；正确姿势与回滚步骤见 `docs/rules.md` §14）。
- Animeko 路径自动探测：DB=`%USERPROFILE%\AppData\Roaming\Him188\Ani\data\ani_room_database_main.db`，exe=`D:\Tool\Ani\Ani.exe`。
- 全量测试前先 `mvn test`（后端）；UI 链路需真实浏览器验收。
- **MySQL 备份监工（2026-09-20 用户指令）**：后端启动时由 `config/BackupWatcherLauncher` 自动拉起 `scripts/backup-mysql-watch.ps1`（幂等：容器健康→**立刻备一次**→之后每 60 分钟；双写 `data/backup/` + `%LOCALAPPDATA%\VideoTagger\backup`；留 3 代；全局互斥 `Global\VideoTagger-MySqlBackupWatcher`），每 5 分钟看护重拉（子进程退出码 0 = 已有实例在跑→不重拉）。它是**守护**：不随后端退出而终止（后端重启/关掉都不影响备份节奏）。开关 `videotagger.backup.enabled`（`BACKUP_WATCHER_ENABLED=false`）。`scripts/install-backup-watcher.ps1`（计划任务）**变成可选**，两个渠道靠互斥共存。查看日志：`%LOCALAPPDATA%\VideoTagger\backup\backup-watcher.log`；手动停：`Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | ? CommandLine -like '*backup-mysql-watch*' | % { Stop-Process -Id $_.ProcessId -Force }`。
- **PowerShell + Docker 探测的坑（2026-09-20 实测）**：`$ErrorActionPreference='Stop'` 时，原生命令（`docker info`）往 stderr 写会变成**终止性异常**，Docker Desktop 重启的那几分钟会让监工直接自杀退出（当天日志里发生两次）→ 脚本里所有 docker 调用必须走 `Invoke-DockerQuiet` 包装（临时改 `Continue` + 只看 `$LASTEXITCODE`）。
- 银幕式（cinema）字体：内嵌在 `backend/remotion/public/fonts/`，由 `src/cinema/fonts.tsx` 注入；**别再拿文件名当族名**（`阿里巴巴普惠体 2 115 Black` 在 Windows 上永不命中，系统真名是 `阿里巴巴普惠体 2.0` / `Mona Sans`，只当兜底）。开场时长由用户设置直接决定（`scan = 55%`），掠影拍点在短场景下会等比压缩。
- **媒体封面取值链（2026-09-20 用户定稿，全应用统一）**：**Bangumi 封面（`external_work.cover_url`）→ 显式封面（`media.cover_path`）→ 代表片段帧（`fallback_cover_path`）**。前端唯一实现在 `static/app.js` 的 `mediaCoverSources/mediaCoverSrc/mediaCoverAttrs`（三处：卡片/列表行/搜索卡/回收站/详情都是它）；编辑器同序（`editor/panes.tsx`）；推荐视频与单集推荐后端同序（`RecommendService.resolveCover` / `RecommendSingleService.firstCover`）。**新加封面展示位请走这条链，别再写 `coverPath || fallbackCoverPath || ...`**（旧顺序会让片段帧盖掉 Bangumi）。
- 推荐视频渲染：`chapter`（含 `stream`/`overview` 回退）走 **Remotion**（`backend/remotion`，需先在该目录 `npm install`；可用 `RENDER_REMOTION_DIR` 覆盖）；`clip` 样式仍走旧 Puppeteer `render.js`。`RENDER_FFPROBE_PATH` 不配则按 ffmpeg 同目录探测（探不到时会先试一次混合再回退，会多一条 WARN）。Player 预览页需先在 `backend/remotion` 跑 `npm run build:player`（产出 `dist-player/`，已 gitignore；产物不存在时 `/preview` 自动回退旧 HTML）。
- **推荐时间轴帧率按模板形态（2026-09-20 用户拍板）**：`RecommendService.fpsOf(groupStyle)` → **银幕式 = 24fps**（番剧素材实测清一色 23.976；24fps 时间轴下逐帧都落在真帧上，不再每 5 帧补一帧，且素材零重编码直通），**其余模板 = 30fps**（旧行为一字不动）。预览（`RecommendController`）与导出（`RecommendVideoService`）两个调用点都必须用 `fpsOf`，片段准备 `RecommendClipSourceService.prepare(..., fps)` 也要传同一个值（其 0.05 容差让 23.976 直通）。**判“帧节奏是否均匀”只能用帧间差**（`tblend=all_mode=difference,signalstats` 的 YAVG），**不能用 md5**（h264 重编码会把同内容像素改写 ±1 → 假阴性）。
