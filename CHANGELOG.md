# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格。

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
