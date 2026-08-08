# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。
每版演进的**叙事脉络**（为什么做 → 做了什么 → 延续）见 [docs/story.md](docs/story.md)，这里只列功能事实。

## [0.16.0] - 2026-08-08

### 新增
- **推荐导出 BGM 支持**：推荐向导「设置主题」步骤新增「🎵 添加 BGM」——选本地音频（mp3/m4a/wav，≤20MB）→ base64 **内嵌**进自包含 HTML；HTML 右下角显示 **BGM 名称 + 播放进度条 + 播放/暂停**（♪ 切换）；导出 MP4/WEBM 时 BGM 通过 ffmpeg **循环混入音轨**（`-stream_loop -1`，导览多久播多久）。
- 接口：`POST /api/recommend/html` 与 `POST /api/recommend/video` 新增 `bgmName`/`bgmBase64` 字段（可空，不传行为不变）。

### 工程化
- 版本 0.15.0 → **0.16.0**。

## [0.15.0] - 2026-08-08

### 新增
- **omofuna 番剧同步（中文标题源）**：媒体 tab 新增「⇄ 同步中文番剧」入口 → 弹层内年份 chips 多选（2000~2026）→ 后台任务用 Node+puppeteer 连系统 Chrome 真实浏览器抓取 omofuna（日漫/动画/剧场）的中文标题/年份/封面 → 自动过 MaccMS 验证页（点「继续访问」）→ 逐条导入，命中库中已有（title 或 original_title 精确匹配）跳过。**补充 AniList**：omofuna 直接给中文标题，AniList 只给日文原名 → 同番会并存两条，靠既有「合并」功能手动治理。
- **异步任务 + 进度轮询**：抓取 20~40 分钟后台执行，POST 立即返回 taskId，前端每 2s 轮询「已抓页数/条数」+ 不确定进度条动画；刷新页面后重开弹窗自动恢复进度（GET /current）。
- **媒体来源字段**：media 新增 `source`（MANUAL / ANILIST / OMOFUNA 细分）——同步导入自动标注数据源（AniList/omofuna），手动新建默认 MANUAL，由系统决定不手选；历史数据启发式回填（`original_title` 非空→AniList、封面 `cfhls.top`→omofuna、其余手动）；列表卡片**同步来源角标**（AniList/omofuna，手动默认不显示）+ 详情 meta 完整展示来源。为后续按来源筛选/统计/治理打底。
- **搜索来源筛选 + 筛选区折叠重构**：搜索新增「**来源**」下拉（手动 / AniList 同步 / omofuna 同步，按所属媒体 source 后置过滤，与格式/子分类同排）；搜索筛选区重构为「**常用项常驻 + 更多筛选折叠**」——格式/子分类/来源常驻一行，时间/自定义区间/按媒体聚合收进「更多筛选 ▾」展开区，未来新增筛选项统一放折叠区，保持主行简洁不臃肿。`/api/search` 新增 `source` 参数。
- **媒体列表来源筛选**：媒体 tab 筛选区（子分类/状态/收藏夹/年份那排）新增「**来源**」下拉，覆盖最近观看 / 全部媒体 / 收藏夹内三个列表分支；`GET /api/media`、`/api/media/recent`、`/api/media/count`、`GET /api/collections/{id}/media` 均新增 `source` 参数。
- **同步入口合一**：媒体工具栏两个同步按钮（⇄ 同步番剧 / ⇄ 同步中文番剧）合并为一个「⇄ 同步番剧」；弹层内**数据源单选 chips**（AniList / omofuna）+ 年份 chips 勾选，开始同步按来源分流——AniList 同步阻塞约几十秒，omofuna 异步任务 + 进度轮询 + 刷新恢复。
- **媒体分页 200 修复**：后端媒体列表 limit 上限从 100 提到 200（此前前端「200 条/页」选项被后端钳成 100），`list`/`recent`/收藏夹内列表三处统一。
- **同步分类筛选**：同步弹层新增「**分类**」chips 多选（按来源切换）——AniList 用 format 7 类（TV / TV 短片 / 剧场版 / OVA / ONA / 特别篇 / 音乐）、omofuna 用类目 3 类（日漫 / 动画 / 剧场），默认全选=不过滤，勾选后只导入所选分类控制导入量。`POST /api/media/sync-anilist` 新增 `formats` 参数（GraphQL `format_in` 过滤），`POST /api/media/sync-omofuna` 新增 `types` 参数（node 脚本只抓所选类目页）。
- **回收站**：媒体删除改「**移入回收站**」（软删除，`deleted_at` 标记；集/片段/标签/封面保留，撤回原样恢复）；媒体 tab 新增「**回收站**」子 tab 视图（最近观看 | 全部媒体 | 回收站）——标题搜索 + 列表（含删除时间）+ 单条撤回 / 彻底删除 + 清空回收站。接口：`GET /api/media/trash`（列表/搜索）、`GET /api/media/trash/count`、`POST /api/media/{id}/restore`（撤回）、`DELETE /api/media/purge?ids=`（彻底删除）、`DELETE /api/media/trash`（清空）。集/片段删除保持直接删。V14 迁移加 `deleted_at` 列；所有正常媒体查询排除已删。
- **修复最近观看计数 SQL 报错**：媒体 tab 点选报错根因是 countLatest 的 `AND EXISTS` 前缺空格（软删恒真条件拼接后成 `IS NULLAND EXISTS`），已补空格并全库扫描确认仅此一处硬编码 AND 行。
- **修复年份筛选 SQL 报错**：媒体筛选带年份（及任意相邻筛选组合）报 SQL 语法错误——根因是 MyBatis **相邻 `<if>` 拼接不加空格**（软删恒真条件放大触发），已统一给所有 `<if>` 内容加前导空格根治。
- **媒体列表排序**：筛选区新增「排序」**维度下拉（时间 / 评分）+ 升降序切换按钮（↓/↑）**，`GET /api/media` 新增 `order` 参数（asc/desc 白名单，默认 desc）；评分排序无评分媒体恒排最后；时间降序=最新在前、评分降序=高分在前。参考主流列表交互。
- **修复详情返回丢分页**：媒体列表翻页后进详情再返回，此前回到第一页——`showView('media')` 改 `loadMedia(false)` 保留当前页码/筛选，返回回到翻页位置。

### 接口变更
- `POST /api/media/sync-omofuna`：body `{"years":[2026,...]}`，创建后台抓取任务并立即返回 `{taskId,status:"RUNNING",...}`；已有进行中任务返回 400。
- `GET /api/media/sync-omofuna/{taskId}`：轮询任务状态（RUNNING/DONE/ERROR + 已抓页数/条数/新增/跳过），不存在返回 404。
- `GET /api/media/sync-omofuna/current`：最近一次任务（前端刷新恢复进度）。

### 工程化
- 新增 `OmofunaSyncService`（读 node 产物 JSON 逐条 upsert，`original_title` 显式留空）+ `OmofunaSyncTaskService`（内存任务表 + `@Async(syncExecutor)` 跑 node + reader 线程解析进度行）+ `OmofunaSyncController`；AsyncConfig 新增单线程 `syncExecutor`（不与封面/embedding 池争抢）。
- 新增 `backend/scripts/omofuna.js`（puppeteer-core 抓取：验证页自动点「继续访问」、按 URL `show/{分类ID}--------{页码}---{年份}.html` 翻页终止、hash 去重、页间限速、stdout 进度行 + JSON checkpoint 输出）。
- 版本 0.14.0 → **0.15.0**。

## [0.14.0] - 2026-08-07

### 新增
- **媒体首播年份 + 原标题**：`media` 表新增 `year`（首播年份，可空=未知）与 `original_title`（AniList 原生日文标题）两列；列表卡片与详情页 meta 首位展示年份。
- **番剧同步（AniList 数据源）**：媒体 tab 工具栏新增「⇄ 同步番剧」入口 → 弹层内**年份 chips 多选**（2000~2026，全选/清空）→ 按勾选年份从 AniList 批量导入番剧名称/年份/封面。标题以日文原名入库（`title` 与 `original_title` 同值占位，**可后续编辑成中文**）；命中库中已有（`title` 或 `original_title` 相同）自动**跳过不重复建**；封面经既有 coverExecutor **异步下载**，失败静默降级不阻塞主链路。
- **标签三级同步（片段→集→媒体）**：打片段标签自动**并集同步**到所属集，再同步到所属媒体（集打标同样上溯媒体），媒体标签过滤从此有数据可用；同步只做**单向向上并集**（INSERT IGNORE 幂等），删除不级联、由用户按需在详情页手动清理。标签管理页新增「⇄ 同步历史标签」按钮一键把历史片段/集标签落库。
- **推荐页来源过滤 + 全选本页**：推荐勾选网格顶部新增**收藏夹来源下拉**（勾选某收藏夹只看其中番剧）+ **标签手输过滤框**（带自动补全，Enter/blur 触发，未知标签 toast 提示）+「☑ 全选本页」按钮；勾选状态跨页保留。

### 接口变更
- `POST /api/media/sync-anilist`：body `{"years":[2004,...]}`，按年份逐个同步（分页拉取、页间 200ms 限流、单个年份失败跳过），返回 `{"added":241,"skipped":1}`。
- 媒体列表接口（`GET /api/media`、`GET /api/media/recent`、`GET /api/media?collectionId=`）增加 `limit`/`offset` 分页参数。
- `GET /api/media` 与 `GET /api/media/count` 增加 `collectionId` 过滤参数（收藏夹来源筛选）。
- `POST /api/media/retry-covers`：遍历 `cover_url` 非空但封面文件缺失的媒体，重新触发异步补下，返回 `{"triggered":N}`。
- `POST /api/tags/sync-all`：全量历史标签三级同步（幂等，可重复跑），返回 `{"synced":N}` 新增媒体标签条数。

### 修复
- **番剧同步混入老番**：AniList `seasonYear` 查询会混入未标季度的老番（勾 2000 实测混入 1969~1999 条目）——同步逻辑严格按 `startDate.year == 目标年` 过滤，非目标年份一律忽略不建。
- **封面异步下载中断后无法补**：`media` 新增 `cover_url` 列留存 AniList URL；同步命中已有且无封面时补 URL 并重新触发下载；新增 `retry-covers` 手动补下入口（前端工具栏「⇩ 补下封面」）。
- **批量删除补「全选本页」**：媒体列表工具栏新增「☑ 全选本页」，一键勾选当前已加载列表全部进批量删除。
- **列表页分页**：媒体列表按 100 条分批加载 + 尾部「加载更多」按钮，替换一次性全量加载。
- **收藏夹来源过滤失败**：`listFiltered` 缺 `collectionId` 参数（静默返回全部）而 `countFiltered` 有 → 列表/count 不一致、勾选收藏夹无效果；补齐参数 + SQL `IN (SELECT media_id FROM media_collection ...)` 子查询修复。
- **推荐页缺「全选本页」**：推荐勾选网格顶部新增全选/取消（toggle 当前页），勾选状态跨页保留。

### 工程化
- 新增 `AniListSyncService`（GraphQL `Page` 分页 + 去重 upsert + 异步封面）；`Media`/`MediaRequest`/`MediaDetail`/`MediaSummary`/`MediaMapper` 全链路增加 `year`/`originalTitle`；Flyway `V11__media_anilist_sync.sql`；版本 0.13.0 → **0.14.0**。
- 新增 `TagSyncService`（`syncFromClip`/`syncFromEpisode`/`syncAll`，片段→集→媒体单向向上并集）；实时接线 `ClipService.linkClipTags` + `EpisodeService.addTag`，同步后触发媒体向量重嵌；`MediaTagMapper.insertIgnore` 返回 `int` 以统计新增条数；`MediaMapper.listFiltered` 加 `collectionId` 参数。

## [0.13.0] - 2026-08-07

### 新增
- **推荐导出向导化（独立「推荐」tab）**：导航新增第 7 个「推荐」tab，整条导出链路改为**分步向导**——① 勾选要推荐的番剧（顶部实时计数 + 步骤指示条）→ ② 填写主题文案（实时预览大标题）→ ③ 生成 HTML 预览（弹窗内嵌 iframe 直接看效果），没问题再「导出视频」/「下载 HTML」。
- **主题文案参数化**：`recommend.html` 的 `<title>` 与 `<h1>` 由 `__TITLE__` 占位符注入用户填写的大标题（空 → 默认「我的番剧推荐」，HTML 转义防注入）。
- **预览弹窗内嵌 iframe**：`POST /api/recommend/html` 生成的**自包含单文件**直接写 `iframe.srcdoc` 渲染，无需下载即可逐张翻看导览效果；弹窗内直接进「导出视频」。
- **视频导出弹窗**：选择**标题 / 格式（MP4 / WEBM）/ 清晰度（720P / 1080P / 4K）/ 导出位置**。导出位置用 **File System Access API**（`showSaveFilePicker` → 写入所选文件；用户取消保留原状），非 Chromium 自动降级为浏览器默认目录下载。
- **WEBM 格式导出**：`render.js` 编码参数按格式分流——MP4 `libx264`（veryfast + faststart）/ WEBM `libvpx-vp9`（CRF 32 + 低延迟 row-mt）。

### 接口变更
- `POST /api/recommend/html`：body 增加可选 `"title"`（主题文案，缺省/空白用「我的番剧推荐」）。
- `POST /api/recommend/video`：body 增加可选 `"title"` 与 `"format":"MP4|WEBM"`（缺省 MP4）；返回 `video/mp4` 或 `video/webm` 附件。

### 工程化
- `RecommendService.buildHtml(ids, title)` 标题注入 + `RecommendVideoService.render(ids, title, format, resolution)` 格式参数化；`render.js` 新增 `--format` 与 `encodeArgs()` 分流编码器。
- **渲染质量调优**（修复导出视频卡顿）：抓帧 JPEG 质量 82→70（1080P 帧率稳至 **~59fps**，此前受负载波动 38~55）；h264 `-crf 20` / vp9 `-crf 28` 码率提升近一倍（画面少伪影）；4K 档视口+抓帧降档至 1920 再 ffmpeg 放大（4K 从 18.8→31.6fps）；前端选 WebM 时提示「播放依赖 VP9 硬解，卡顿建议 MP4」。
- 前端 `index.html` 新增「推荐」tab + `.wizard-steps` 步骤条 + 三 pane 向导区 + 预览/视频导出弹窗；`app.js` 向导状态机（步骤切换/计数/标题预览/iframe srcdoc/FS API 保存）；`app.css` 向导与弹窗样式块。
- 新增/更新测试：`RecommendServiceTest` +2（标题注入/转义）、`RecommendControllerTest` +2（标题透传/WEBM 响应）、`RecommendVideoServiceTest` 5 例（校验路径），共 25 例全通过。

## [0.12.0] - 2026-08-07

### 新增
- **渐变环流推荐导出**：媒体列表批量勾选（多选模式勾多部）→ 工具栏「导出推荐」→ 弹窗选 **HTML / 视频** 与清晰度（**720P / 1080P / 4K**）→ 下载。整条链路「勾选 → 生成 HTML → 导出视频」一键打通。
  - **自包含推荐 HTML**（`POST /api/recommend/html`）：深色霓虹**渐变环流模板**——椭圆轨道自转 + 飘带式入场 + 自动导览（含进度条 / 「第 X 部 / 共 N 部」），封面转 **base64 内嵌**（`data:image/...`），输出单文件无任何外部依赖，可直接发送 / 手机打开。
  - **导出 MP4 视频**（`POST /api/recommend/video`）：Node + **puppeteer-core** 连系统 Chrome 以 `?record=1` 录制模式播放自动导览（忽略交互打断），CDP `Page.startScreencast` 抓帧 + **ffmpeg 固定帧率合成**（时长精确 = 7s 定场 + 每部 6s + 2s 收尾），三档分辨率可选。
- **封面内嵌读取**：`CoverService.base64ForCoverPath`——按 `/covers/**` 路径读封面转 base64 data URL（空 / 越界目录穿越 / 文件不存在 / 非文件 → null 降级），HTML 导出免外链、离开发送也能看图。

### 接口变更
- `POST /api/recommend/html`：body `{"ids":[...]}`，返回 `text/html` 附件 `video-tagger-recommend.html`（单次 ≤30 部，空 ids 400）。
- `POST /api/recommend/video`：body `{"ids":[...],"resolution":"720P|1080P|4K"}`，返回 `video/mp4` 附件（文件名带时间戳，渲染约 1 秒/部）。

### 工程化
- 新增 `RecommendService`（HTML 组装：格式名 + 子分类路径 + 状态中文 + 标签热度 TOP6，HTML 转义防注入，缺失媒体跳过保序）、`RecommendVideoService`（ProcessBuilder 编排，20min 超时 / 产物校验 / 临时目录清理）、`RecommendController`（DTO record 反序列化，规避 `Map<String,Object>` 数字→Integer 强转陷阱）。
- 新增 `backend/scripts/render.js`（puppeteer screencast 抓帧 + CFR 合成）与 `package.json`；`videotagger.render.*` 配置（scripts-dir 带工作目录候选兜底解析，IDE 项目根 / mvn backend 双场景可用）。
- 模板 `templates/recommend.html`：`__SLIDES_JSON__` 占位符 + `?record=1` 录制模式；前端工具栏「导出推荐」按钮 + 导出弹窗 + 下载 toast（`.toast`）。
- 新增测试：`RecommendControllerTest` 4 例、`RecommendServiceTest` 8 例、`CoverServiceTest` 6 例，共 18 例全通过。
- 渲染踩坑：Windows 下 headless Chrome 加 `--disable-gpu` 会把超大 viewport 宽度 ×0.75 压缩（1920→1440），须去 GPU + `--window-size` + `--force-device-scale-factor=1`；ffmpeg concat demuxer 末帧 duration 语义不可控会拉长总时长，改 CFR `-framerate` 精确还原。

## [0.11.0] - 2026-08-06

### 新增
- **收藏夹管理增强（独立 tab）**：导航新增第 6 个「收藏夹」tab——左侧收藏夹列表（媒体数 + 选中高亮）+ 右侧内容网格的管理视图。支持**重命名**（`PUT /api/collections/{id}`）、**删除**（确认弹窗，收藏夹内媒体仅解除关联、本体保留）、工具栏「＋ 新建收藏夹」（新建后自动选中）。删除/重命名同步刷新媒体筛选下拉。
- **媒体卡片快捷收藏**：封面左下角 ♡ 按钮（hover 浮现，批量删除模式下隐藏）→ 弹收藏夹勾选浮层（复用 `.coll-check` 风格），勾选/取消即时加入/移出收藏夹，无需进详情页。
- **收藏夹视图移出入口**：收藏夹 tab 内容网格的卡片操作由「删除媒体 ×」改为「移出收藏夹 ⇤」（amber 色，直接解除关联、媒体本体保留），杜绝收藏夹上下文误删媒体；删媒体入口收敛到媒体页/详情页。
- **详情页标签池（媒体/集/片段三处）**：详情页标签展示升级为**标签池**卡片——每个标签带 `×N` 次数徽标 + **五档分级配色**（1 次灰 / 2-3 紫 / 4-6 粉 / 7-9 橙 / 10+ 金·大号·光晕），次数越高越暖越显眼，降序排列。
  - **媒体页**：按媒体三级（作品级 + 集 + 片段）聚合引用次数（复用 `GET /api/tags/manage?mediaId=`）；作品级已挂标签保留 × 移除（集/片段引用不动），纯集/片段引用标签只展示热度；保留添加输入框与补全。
  - **集页**：按**集内聚合**（集本身 + 其下片段引用，新 `GET /api/tags/episode-stats?episodeId=`）；集标签保留 × 移除与添加。
  - **片段页**：新增「片段标签」区——片段自身标签（`clip.tag` 拆词）+ 每标签在整部作品里的引用热度（复用 manage?mediaId），纯展示；count=0 灰档无徽标。
  - 三处共用 `.tag-pool-chip` 五档样式与分档函数；聚合接口失败均兜底回原标签展示。

### 修复
- **跳转失效（bangumi 等路径）**：`buildJumpUrl` 此前只认 `bilibili.com/video/` 路径，`/bangumi/play/` 等 URL 返回原样（无 `t` 参数）导致跳转静默失效。改为按**域名**选时间参数格式（YouTube `t=1018s` / B 站系纯秒 `t=1018`，未知站点不拼），用 `URL.searchParams.set` 覆盖已有 `t` 防双参数。
- **跳转 key 不一致**：`JumpController.put/poll` 统一走 `VideoFingerprint.normalize()`（此前扩展端用 `normalizeUrl` 只去 `t`、后端原样存，URL 归一化结果对不上时跳转失效）。

### 接口变更
- `PUT /api/collections/{id}`：重命名收藏夹（body `{"name"}`；空名 400、不存在 404）。
- `GET /api/tags/episode-stats?episodeId=`：某集内标签聚合（集本身 + 其下片段引用，`refCount`=集内引用总数），集详情页标签池数据源。

### 工程化
- `CollectionService.rename`（空名校验 + `updateById`）；`CollectionController` 加 PUT 端点；`CollectionControllerTest` 新增 3 例。
- 前端收藏夹 tab：`views` 注册 + `showView` 接入 `loadCollections`；`renderMediaGrid` 加 `container` 参数（默认 `mediaGridEl`，收藏夹视图复用）；`loadCollections/renderCollList/loadCollMedia/deleteCollection`、快捷收藏浮层 `openFavPicker/loadFavOptions`（外部点击/滚动收起）。
- `TagMapper.countByEpisode`（episode_tag ∪ 其下 clip_tag 聚合）；`TagAdminService.episodeStats`；`TagController` `/episode-stats` 端点；新增 2 例单测（TagAdminServiceTest 13 / TagControllerTest 4）。
- 标签池三处：`renderDetailTags`/`renderEpisodeDetailTags` 改 async 聚合渲染 + `renderClipTags`（片段拆词热度）+ `tagStatTier` 分档函数；`.tag-pool-chip` 五档配色。

## [0.10.0] - 2026-08-06

### 新增
- **分类树（子分类任意层级细分）**：`media_subcategory` 改邻接表（新增 `parent_id`，0=根），唯一键 `(format_id,name)` → `(parent_id,name)`——同一格式下可在任意分类下继续细分（如 番剧 → 热血 → 战斗）。媒体改按 `subcategory_id` 引用节点（V10 迁移回填存量，`subcategory` 名字保留为展示快照）。
- **子树收敛筛选**：媒体列表与搜索按子分类筛选时，选中**分类及其全部下级**的媒体都算（后端递归 CTE / 客户端过滤兜底）——选「番剧」能看到挂在「热血」下的媒体。
- **管理格式弹层树化**：子分类按 `parent_id` 缩进渲染为树，每节点「＋新增下级」（新增位置高亮、顶部「＋根级」切回）与「删除」；删除保护升级——节点**有下级或子树挂媒体**时拒绝删除。
- **下拉树化**：新建/编辑媒体、媒体筛选、搜索三个子分类下拉改 option value=节点 id + 层级缩进，媒体可挂到**任意层级节点**（不限于根级）。
- **统计路径 label**：按子分类分布按节点聚合，label 为「父 / 子」路径（跨分支重名可区分）。
- **自动识别归组**：扩展打标新建媒体默认「番剧」时按名字解析到格式树节点（找不到保持未分类）；新建媒体内联新增子分类可挂到当前选中分类下。
- **标签池维护增强**：通用池新增分页（page/size，默认 50，50/100/200 切换）与**全选本页**；`POST /api/tags` 新增词条、`DELETE /api/tags?ids=` 批量删孤儿（任一被引用整体拒绝）；**新增标签弹层**——实时去重（防抖匹配全量词库，命中提示「已存在」并可跳去合并）、空格/逗号分隔**批量入池**、逐词回显结果，替代原工具栏裸输入框。

### 接口变更
- `POST /api/media-formats/{id}/subcategories` body 加 `parentId`（0=根，缺省根）；`GET /api/media` / `GET /api/search` 子分类参数 `subcategory`（名字）→ `subcategoryId`（节点 id，子树收敛）。
- `GET /api/tags/manage` 加 `page`/`size`（返回 `PageResult{items,total}`）；新增 `POST /api/tags`（加词条）、`DELETE /api/tags?ids=`（批量删孤儿）。

### 修复
- **标签管理页 500**：`TagMapper` 关联查错用 `clip`（实表 `clips`）+ `countGlobal`/`countByMedia` 缺列导致 TagUsage 原生 long 映射 NPE（仅数据存在时触发）。
- **分类树 UI 错乱**：fm 弹层添加区换行错位（改 flex-wrap 两行布局）、子分类下拉层级显示（原生 option 路径字符串 `父 / 子`，代替全角空格缩进）、缺根级新增入口（顶部「＋根级」切回 + 「新增到『X』下（根级）」高亮提示）。

### 工程化
- Flyway `V10__subcategory_tree`（parent_id + 唯一键 + media.subcategory_id + 存量回填）。
- `MediaMapper` 递归 CTE（`countBySubcategoryId`/`subtreeIds`，子树收敛 + 删除保护）；`MediaFormatService` 内存 DFS 子树计数；`SearchResult`/`MediaSummary`/`MediaDetail`/`StatsResponse.SubcategoryStat` 携带 `subcategoryId`。
- `PageResult`（分页 record）；`TagAdminService.add/deleteBatch`（新增/批量删孤儿 + 引用预检）；`TagMapper.countGlobal/countByMedia` 补 `0 AS` 列。
- 单测适配 + 新增子树过滤、父节点跨格式校验、有下级删除保护、子树计数 4 例；标签管理新增/批量删除/分页单测（90+ 例通过）。

## [0.9.0] - 2026-08-06

### 新增
- **标签补全上下文化**：`GET /api/tags` 补全带 `mediaId` 上下文——有媒体上下文时该媒体已用标签（媒体/集/片段三级）优先 + 全局高频兜底；无上下文时从全局词库按**三级引用总次数**聚合排序（取代原来只统计 `clips.tag` 拆词，媒体/集层标签由此进入补全）。排序：精确命中 > 前缀 > 包含；同级次数降序。扩展浮层记住最近保存的 mediaId，同一页面连续打标补全带上下文；Web 片段编辑/集打标/媒体详情加标签三处补全接入。
- **标签管理页（新 tab「标签」）**：通用池视图（全词条 + 媒体/集/片段三级引用计数 + 搜索过滤）+ 按媒体维度视图（媒体下拉 → 该媒体已用标签及引用数）。支持**改名**（同步 `clips.tag` 冗余列 + 引用实体自动重嵌；新名撞既有词条 400 引导合并）、**合并**（高然→高燃，三级关联迁移 + `clips.tag` 同步 + 删源词条 + 重嵌）、**删孤儿**（仅无任何引用词条可删，被引用拒绝）。复用现有 modal/confirm 弹窗体系。
- **接口**：`GET /api/tags/manage?q=&mediaId=`（管理列表）、`PUT /api/tags/{id}`（改名）、`POST /api/tags/merge`（合并）、`DELETE /api/tags/{id}`（删孤儿）；`IllegalArgumentException` 统一 400 错误体。

### 工程化
- `TagAdminService` + `TagUsage`（三级计数聚合记录）；`TagMapper` 全局/媒体维度聚合查询；`ClipMapper` `selectByTagContains`/`updateTag`；三个关联 Mapper 加 `moveRefs`/`deleteRefs`。
- 新增单测：`TagAdminServiceTest`（改名同步+重嵌/撞名/合并迁移/删孤儿，7 例）、`ClipServiceSuggestTest`（全局聚合/媒体上下文/精确前缀排序，3 例）、`TagControllerTest`（manage/补全 mediaId 透传，3 例）。

## [0.8.0] - 2026-08-06

### 新增
- **媒体/集层备注**：`media` 与 `episode` 表新增 `note` 字段（V9 迁移）——媒体备注在「新建/编辑媒体」弹窗录入、媒体详情页展示；集备注在集详情页头部内联编辑（新增 `PUT /api/episodes/{id}` 端点）。备注参与**关键词检索**（媒体/集搜索 SQL 加 `note LIKE`）与**向量语义检索**（MEDIA/EPISODE embedding 文本拼备注，变更自动重嵌）。
- **搜索全字段高亮**：搜索结果命中词在所有可见文本（标题/备注/标签）高亮显示（`<mark>`），一眼看出命中来源。
- **搜索按媒体聚合**：搜索工具栏「按媒体聚合」开关（默认开）——结果按所属媒体分组展示（媒体头 + 命中片段），点击媒体头进详情，方便顺着一部部收集话题素材。
- **打标时间范围筛选**：搜索工具栏「时间」下拉——不限/近 7/30/90 天/自定义区间（`GET /api/search` 新增 `from`/`to` 参数，按实体创建时间后置过滤）；结果卡片显示打标时间。
- **搜索结果角标**：卡片显示格式/子分类/站点小角标（格式配色沿用媒体卡片，站点由 URL 前端解析 hostname）。
- `SearchResult` 携带 `mediaTitle`/`mediaFormat`/`subcategory`/`createdAt`，片段结果补齐所属 `mediaId`（enrich：CLIP→episode→media 批量解析）。

### 工程化
- Flyway `V9__media_episode_note`（media/episode 加 note 列）。
- `SearchServiceTest` 新增 enrich 媒体信息、时间范围过滤、媒体备注命中 3 个用例（72 → 75 个单测）；既有 SearchService/SearchController 测试同步 7 参签名。

## [0.7.0] - 2026-08-04

### 新增
- **媒体格式细分**：番剧泛化为「媒体」，新增 **媒体格式**（视频/图片/文字…，可维护字典）+ **子分类**（视频：番剧/电影/电视剧/美剧/纪录片；图片：插画/壁纸/摄影；文字：小说/轻小说/文章…，可维护字典）。图片/文字为单层媒体，仅视频有「集/片段」子层。
- **格式 tab 导航**：媒体列表顶部「全部/视频/图片/文字」一键切换。
- **筛选升级**：媒体列表与搜索页均支持按格式/子分类过滤；搜索结果为后置过滤（向量命中后按媒体格式/子分类收敛）。
- **管理格式快功能**：媒体列表「⚙ 管理格式」弹层——左格式列表 + 右子分类增删改（含每子分类媒体数），可新增格式（带「有集/片段子层」标记）；新建/编辑媒体弹窗内可「＋ 新建」子分类。删除保护：格式/子分类被媒体引用时拒绝删除。
- **统计增强**：统计视图加「按媒体格式分布」「按子分类分布」卡片。
- **自动识别**：打标保存时按 URL 域名粗判格式（图片站→图片，其余→视频）、按标题含「第X集/季」等标记探测子分类「番剧」（低置信仍走待确认）。

### 重构
- **全面改名 anime→media**：表（`anime`→`media`、`anime_tag`→`media_tag`、`anime_collection`→`media_collection`）、类、接口（`/api/anime*`→`/api/media*`）、前端、向量 `EntityType.ANIME→MEDIA`（Milvus 前缀 "A" 保留，数据免迁移）。`anime.type` 拆为 `media_format` + `subcategory`，旧数据映射：ANIME→视频/番剧、MOVIE→视频/电影。
- **API**：`GET/POST /api/media-formats` + 子分类 CRUD；`GET /api/search` 增 `format`/`subcategory` 过滤参数。

### 工程化
- Flyway `V8__media_format`（加列/表改名/建字典/种子/向量任务实体类型迁移）。
- 新增 `MediaFormatServiceTest`（删除保护/重复校验/格式树）与 TitleParser 子分类探测用例，单元测试 64 → 72 个全通过；IT（Testcontainers）待 Docker 环境验证。

## [0.6.0] - 2026-08-03

### 新增
- **双图封面**：片段打标一次截两档——缩略图（320px）+ 详情大图（min(videoWidth,1280)）；列表展示缩略图，**鼠标悬浮弹出详情大图预览**（无详情图自动回退缩略图，历史数据属预期）。
- **片段详情页大图**：hero 优先用详情大图，悬浮/详情更清晰。
- **集删除**：集详情页「删除该集」+ 番剧详情集行删除按钮，级联清理其下片段、标签、缩略 + 详情封面与向量。

### 工程化
- Flyway `V7__detail_cover`（`clips.detail_cover_path`）。
- `SaveClipRequest` 增 `detailCoverDataUrl`（上限 900KB），失败降级仅无大图。
- 删片段/番剧/集级联清理缩略 + 详情两张图。
- 悬浮预览在切换视图时自动收起，防残留遮挡。
- 后端测试 96 → 99 个用例全通过。

## [0.5.0] - 2026-08-03

### 新增
- **集 / 片段详情页**：点片段卡片进片段详情（大图 + 元信息 + 集/番剧导航 + 去原视频/编辑/删除 + 同集其他片段 + 相似片段）；点集卡片进集详情（封面 + 标题/集号 + 番剧导航 + 集标签管理 + 打标签/设封面/去原视频 + 该集片段列表）。两页逻辑一致，可链式跳转逐层返回（视图历史栈）。
- **列表改版**：全部片段卡片统一左侧缩略图横排（搜索 / 时间线 / 相似弹窗 / 集详情内片段 / 片段详情内同集片段），修复此前全宽大图顶置的样式问题。
- **点击行为调整**：片段/集卡片点击进详情页；跳回原视频移到详情页「去原视频」按钮；时间线轴标记小圆点保持直接跳转。

### API
- `GET /api/clips/{id}`（片段详情）、`GET /api/episodes/{id}`（集详情，解析封面 + 集标签 + 片段数）。

### 工程化
- 后端测试 94 → 96 个用例全通过。

## [0.4.0] - 2026-08-03

### 新增
- **片段截帧封面**：扩展打标时用 canvas 截取当前帧（320px JPEG 缩略图）作为片段封面；时间戳同源截取（普通模式 Alt+S 按下瞬间、连续模式每次保存、快存按键时）；CORS/DRM 截帧失败自动降级无封面，不阻塞保存。
- **集封面（自选高能画面）**：番剧详情每集显示封面，点「封面」从该集片段帧网格里自选一条设为集封面（`POST /api/episodes/{id}/cover-from-clip/{clipId}`），或上传图片兜底；未选时**智能默认**为该集被标记最多的片段帧。
- **番剧封面兜底**：无 og:image 的番剧，卡片墙/详情自动用其下代表性片段帧兜底（被标记最多、平分取最新）。
- **缩略图展示**：搜索 / 时间线 / 相似推荐 / 集列表 / 番剧卡片全链路带封面缩略图。
- **封面生命周期**：删片段 / 删番剧级联清理其下全部封面文件（补上既有番剧封面删除遗漏）；`deleteCover` 防目录穿越。

### 工程化
- Flyway `V6__frame_cover`（`episode.cover_path` + `clips.cover_path`）。
- `CoverService` 重构为分 kind 落盘（`clip/{clipId}.jpg` 稳定、`ep/{epId}-{nano}.jpg` 版本戳防缓存旧图、番剧维持 `{animeId}.{ext}`）。
- 后端测试 85 → 94 个用例全通过（新增 `CoverServiceIT` 9 例：落盘/删除/自选拷贝/base64/越界拒绝/级联清理/代表性兜底解析）。

## [0.3.0] - 2026-08-03

### 新增
- **番剧三层打标**：番剧 → 集(含季) → 片段，三层均可打标；打标时按标题前缀+正则自动归组番剧/集，浮层显示识别归属（可改），列表「待确认」批量审核兜底。
- **番剧卡片墙与详情页**：封面（扩展自动抓取 og:image + 手动上传）、追番状态（想看/在看/看完/搁置/弃番）、内容类型（动画/电影）、手动评分、作品级标签、最近观看。
- **手动创建 / 编辑 / 改名 / 合并番剧**；删除番剧级联清理其下集、片段、标签与向量。
- **集级打标**：Web UI 每集可打标签（「看完自动弹」扩展端待办已落地，默认关）。
- **三层混合检索**：`GET /api/search?dim=anime|episode|clip|mixed`，三层向量化（Milvus 单 collection 组合主键），mixed 跨层 RRF 融合，前端维度切换 + 混合分栏。
- **收藏夹与筛选器**：多对多自定义清单（整体浏览）+ 番剧列表按状态 / 类型 / 收藏夹 / 待确认筛选。
- **LLM 后台归组**：可开关，后台判断别名/不同季/不同翻译是否同番，自动合并。
- **看完自动弹**：扩展监听进度 ≥95%，默认关（设置页开启），弹集级打标轻提示。

### 工程化
- Flyway `V3__anime_tiered`（三层 schema + 标签词库）、`V4__embedding_tasks_entity_type`（向量任务三层化）、`V5__collection`（收藏夹）。
- 后端测试 80 → 82 个用例。

## [0.2.0] - 2026-08-02

### 新增
- **编辑 / 删除 / 追加标签**：Web UI 卡片可直接编辑与删除；重复片段提示支持"追加标签"合并到同一条。
- **连续打标模式**：保存后浮层不关，标签保持、时间戳跟随播放进度实时刷新，一集连标不碰键盘。
- **快捷标签位**：`Ctrl+Shift+1~9` 预填标签，可配静默直存（options 页配置）。
- **标签补全**：浮层输入时下拉已有高频标签。
- **重复片段提示**：同一视频 ±10s 内已存过则提示，可选择"追加标签 / 仍然新增"。
- **视频时间线视图**：按 URL 指纹聚合视频列表，点进单个视频看全部标记点沿时间轴排布，点击即跳回。
- **相似片段推荐**：每张卡片"相似"按钮，同标签优先 + 向量近邻顺藤摸瓜。
- **统计面板**：总量 / 视频数 / 标签数、Top 标签（可点击搜索）、站点分布、近 30 天趋势（原生 SVG）。

### 修复
- **Milvus 冷启动竞态**：compose 加 healthcheck，Milvus 晚于 app 就绪时 60 秒自动重连，语义搜索不再永久哑火。
- **3 秒去重静默吞数据**：误触判定改为"同 URL + 时间戳接近 + 标签相同"；同片段补不同标签走新建记录，扩展端提示"该片段刚已保存"。
- **密钥安全**：硬编码 Embedding Key 移出配置文件，仅从 `.env` 注入；后端默认绑定回环地址，Docker 端口仅发布到宿主机回环。
- Milvus 连接失败时关闭 gRPC channel，避免泄漏。

### 工程化
- 引入 **Flyway** 管理 schema 迁移（V1 基线 + V2 视频指纹）。
- 统一错误体 `{code, message}`（`@RestControllerAdvice`）。
- 输入校验增强（URL 格式、字段长度）。
- 新增 `GET /api/tags`、`GET /api/clips/near`、`GET /api/videos`、`GET /api/videos/{fp}/clips`、`GET /api/clips/{id}/similar`、`GET /api/stats`、`PUT/DELETE /api/clips/{id}`。

### 架构 / 数据
- `clips` 表新增 `video_fp`（URL 指纹，同一视频聚合）与 `video_duration`（可选）；历史数据启动时自动回填。
- 后端测试 46 → 60 个用例。
