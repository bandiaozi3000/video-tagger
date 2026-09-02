# v0.23 远程视频源、数据源订阅与 Clip 资产化设计

- **版本**：v0.23.0
- **日期**：2026-08-29
- **状态**：设计追加定稿，继续实施
- **配套计划**：`docs/superpowers/plans/2026-08-29-video-tagger-v023-remote-video-source-plan.md`

## 1. 背景

v0.22 已完成稳定的 `Media → MediaEntry → Episode → Clip` 上下文、Bangumi 元信息缓存、逐集状态和后台同步任务，但视频身份仍主要由网页 URL、`videoFp` 和裸时间码表达。同一 Episode 的本地文件、远程流、下载副本、修正版和备用线路无法被可靠区分，Clip 也无法证明时间码基于哪个具体视频版本。

v0.23 在不把 Video Tagger 变成通用播放器或下载器的前提下，增加受控的片源发现、逐集映射、播放、下载、视频资产和换源时间码校准能力，使远程观看产生的 Clip 能够安全转化为本地可复用素材。

## 2. 设计原则

1. 片源绑定具体 `MediaEntry`，不只绑定媒体标题。
2. 打开详情和片源工作区不自动联网，发现必须由用户显式触发。
3. 先选择整部片源包，再审核逐集映射；冲突项必须解决。
4. 保存片源包默认只保存映射，不自动播放、不自动下载。
5. Provider 稳定 ID 是身份，临时播放 URL 只是短期解析结果。
6. Episode 可拥有多个视频资产，主线路和备用线路必须显式选择。
7. Clip 绑定具体 VideoAsset、来源 revision 和毫秒范围，不能只保存裸秒数。
8. 换源不自动复用时间码，必须经过映射、预览和确认。
9. 下载、裁剪和校准均使用可恢复后台任务。
10. 任何失败都不得删除或覆盖已有 Episode、Clip、标签、备注、封面或成功素材。
11. 不保存 Cookie/token，不绕过登录、付费、地区或 DRM 限制。
12. MySQL 与 SQLite 同步实现，Web 与 Electron 使用同一业务 API。
13. 产品版本只由用户显式声明升级；真实 Provider、订阅管理和快捷播放继续属于 v0.23。
14. 普通播放不要求用户理解 Provider、片源包、映射或 VideoAsset。
15. 数据源配置一次完成，播放时并行查询已启用来源并自动选择最佳候选。
16. 临时播放候选仅在下载、剪辑、固定来源或资产治理时物化为持久资产。

## 3. 产品入口与主流程

### 3.1 MediaEntry 入口

媒体详情外部资料区的每个条目分别显示：

- `片源 0/12`；
- 可播放、已下载、待处理、失效数量；
- `查找片源`；
- `管理片源`；
- `下载缺失集`。

主条目、OVA、特别篇互不混用片源工作区。

### 3.2 片源工作区

独立全屏 SPA，顶部固定展示媒体、条目、Bangumi ID、季度、格式和 Episode 数量。工作区包含：

1. `片源映射`；
2. `下载任务`。

黄金路径：

```text
选择具体 MediaEntry
→ 主动查找作品片源包
→ 查看候选与能力
→ 明确选择一包
→ 审核远程集到 Episode 的映射
→ 解决冲突
→ 确认只保存映射
→ Episode 详情播放或下载
→ 播放器标记 Clip
→ 按需准备本地 Clip 素材
```

## 4. Provider 与片源包

### 4.0 数据源定义、实例与 Provider

Provider 是后端能力适配器；数据源定义是可由订阅或本地模板创建的声明式配置；数据源实例保存用户启用状态、排序、健康状态和本地覆盖。三者不得混为同一对象：

```text
SourceSubscription
→ SourceDefinition
→ SourceInstance
→ VideoSourceProvider / MediaFetcher
→ MediaCandidate
```

支持 Animeko `exportedMediaSourceDataList.mediaSources` 订阅信封，通过兼容适配器转换为本项目内部模型。首批识别 `rss` version 1 与 `web-selector` version 2；未知 factory/version 只保留脱敏定义并标记不兼容，不执行。

订阅更新使用 ETag/Last-Modified 和成功快照。新增来源默认禁用；修改不覆盖用户排序、启用状态和偏好；移除来源标记为订阅已移除，不删除历史映射、资产和 Clip。

### 4.1 Provider 配置

设置页增加“视频源与下载”，Provider 配置只允许声明式字段：启用状态、基础地址、优先级、超时、并发、缓存期、允许播放/下载、默认清晰度、字幕和音轨偏好。

不允许：

- 任意 shell/JavaScript；
- 原始 ffmpeg 参数；
- Cookie、Authorization 或任意请求头；
- 任意本地文件路径；
- Provider 直接写业务数据库。

数据源模板负责声明字段，不允许模板携带可执行脚本。Jellyfin 是可选的个人媒体服务器模板，只在用户主动添加后出现，默认不参与查询；API Key 使用秘密字段保存且绝不返回明文。

### 4.4 真实 Provider 边界

- Jellyfin：查询 Series/Episode；完成受控播放代理前只标记搜索与元数据能力。
- Mikan、AnimeGarden 与通用 RSS：形成 BT 候选，但没有 BT 引擎时不得标记为可直接播放。
- Web Selector：声明式搜索、详情、线路、剧集和媒体规则；首阶段只播放通过安全策略的直接媒体，HLS、请求头会话和网页媒体捕获按能力单独标记。
- 所有真实 Provider 默认关闭；数据源实例启用后才参与显式测试或快捷播放。

### 4.5 数据源管理交互

设置中增加独立的“数据源管理”页面，包含数据源订阅、数据源列表、添加模板和高级分步测试。订阅来源默认只读，可复制为本地来源后编辑。

Web Selector 测试顺序固定为：连接检查 → 搜索作品 → 解析剧集/线路 → 解析媒体 → 实际播放。Jellyfin 使用连接 → 用户 → 作品 → 剧集 → 播放能力的 API 测试链路。

### 4.6 快捷播放与候选选择

普通路径从 Episode 直接点击播放：

```text
Episode
→ 并行查询所有已启用且具备相应能力的数据源
→ 增量生成 MediaCandidate
→ 按锁定来源、作品历史偏好、数据源顺序、线路 tier、可播放性和成功率排序
→ 高优先级候选快速选择
→ 创建短时播放会话
→ 播放
```

播放器提供非阻塞的来源抽屉，显示查询进度、候选线路、失败阶段和手动切换。播放前失败可自动尝试下一候选；稳定播放后不静默换源；用户手动选择后锁定本次来源。

片源包、逐集映射、采用、下载、资产和时间校准继续保留为“资源治理”高级流程，不再阻塞首次播放。

### 4.7 Animeko 网页源播放出口

`web-selector/v2` 的搜索、作品、线路与分集选择器在后端受限执行。订阅中的 Cookie 与自定义视频请求头不会被转发，但不会因此清空其余安全选择器配置。

每个分集候选必须明确标记播放出口：`DIRECT` 仅用于已解析并验证为公网 MP4/WebM/Ogg 的地址；`EXTERNAL` 指向该候选自身的源站分集页；`UNAVAILABLE` 不允许选择。自动选择优先 `DIRECT`，没有直放地址时选择排序最高的 `EXTERNAL`，由用户点击后跳转，不自动弹窗。

单源配置页承担“启用、优先级、配置摘要、保存、测试”闭环。测试必须实际执行搜索与分集解析，并尝试一次播放解析；不能仅根据能力声明显示直放成功。

### 4.2 片源包定义

片源包表示同一发布版本和时间轴体系下的一组资源，例如季度发布、播放列表、合集或用户本地文件集合。稳定身份为：

```text
provider + provider_package_id + revision
```

片源包保存作品信息、发布组、字幕/音轨、清晰度、编码、容器、能力、来源页、revision 和原始脱敏快照。最终播放地址不作为包身份。

### 4.3 片源包选择

- 候选默认不选；
- 按外部 ID、标题、年份、季度、格式和集数排序；
- 卡片正文打开详情抽屉，单选框只负责选择；
- 已稳定关联其他 `MediaEntry` 的包禁止直接迁移；
- 不自动合并多个包，不自动挑最高画质；
- 首次只选择一个主包，后续可添加备用包。

## 5. 逐集映射

远程 item 与本地 Episode 的映射拥有独立状态和理由：

- `PROVIDER_ID`；
- `EPISODE_NUMBER`；
- `TITLE_AND_NUMBER`；
- `MANUAL`；
- `MULTI_EPISODE`；
- `SPECIAL`；
- `IGNORED`。

唯一集号和历史稳定 ID 可自动建议。以下状态阻止采用：

- 多个本地候选；
- 多个远程 item 指向同一 Episode；
- SP/OVA 与正片未区分；
- 错误条目；
- 标题与集号明显矛盾。

用户可手工选择 Episode、忽略远程项、标记特殊内容、执行单集查找，或二次确认后在当前 `MediaEntry` 创建新 Episode。Provider 刷新不得覆盖人工映射。

## 6. VideoAsset 模型

统一资产类型：

- `LOCAL_ORIGINAL`；
- `REMOTE_STREAM`；
- `DOWNLOADED`；
- `UPLOADED`；
- `GENERATED_CLIP`；
- `PROXY_TEMP`。

每个资产绑定 Episode，可选绑定 source item，记录：

- Provider revision；
- 主/备用 role；
- 时长、尺寸、容器、视频/音频编码；
- 文件大小与内容指纹；
- 存储路径；
- 可用状态和最近校验时间；
- 来源页和安全脱敏后的 locator。

字幕和音轨使用独立 `VideoAssetTrack`。资产优先级显式保存，不依赖插入顺序。修正版创建新资产，不覆盖旧资产。

## 7. 探测与播放

片源状态包括：

- `UNCHECKED`、`CHECKING`、`PLAYABLE`；
- `EXPIRED`、`LOGIN_REQUIRED`、`DRM_PROTECTED`；
- `GEO_BLOCKED`、`UNSUPPORTED_FORMAT`；
- `NOT_FOUND`、`TIMEOUT`、`PROVIDER_ERROR`、`FAILED`、`DISABLED`。

每个状态显示最近检测时间、失败原因、能否重试和推荐动作。

播放使用短期会话：重新 resolve 临时地址、逐跳安全检查、HEAD/Range 探测、MIME 与兼容性判断。公开且浏览器可解码资源在应用内播放；CORS、登录、DRM 或格式不兼容时提供来源页、重新解析、明确换线或允许的下载操作。

系统不静默切换字幕组、版本或备用线路。

## 8. 下载与视频文件

保存映射不创建下载任务。单集、缺失集或批量下载必须再次明确确认，并展示预计大小、可用磁盘、目录、画质、字幕、音轨和并发。

任务状态：

- `QUEUED`、`RESOLVING`、`RUNNING`；
- `PAUSED`、`VERIFYING`；
- `COMPLETED`、`FAILED`、`CANCELED`。

默认全局并发 2、单 Provider 并发 1。应用重启恢复可继续项，批次单项失败不停止其他项。

托管目录：

```text
data/video-assets/media-{mediaId}/entry-{entryId}/episode-{episodeId}/asset-{assetId}.{ext}
```

下载使用 `.part`，完成后验证 MIME、容器、大小和指纹，再原子改名。远程文件名只做展示。被 Clip、时间映射、任务或高光项目引用的资产禁止普通删除。

## 9. Clip 与素材化

`clips` 新增：

- `video_asset_id`；
- `start_ms/end_ms`；
- `source_revision`；
- `time_mapping_id`；
- `material_state`。

历史 `url/video_fp/timestamp_sec/end_sec` 暂时保留。旧 Clip 无法确定资产时保持 `video_asset_id=NULL` 和 `REFERENCE_ONLY`。

远程播放器可直接创建引用型 Clip。需要导出或长期保存时创建素材化任务：

1. 优先裁剪已验证的本地完整资产；
2. 其次使用允许的 Range 下载；
3. 再次下载完整 Episode 后裁剪；
4. 失败时保留 Clip 与原时间引用。

## 10. 换源与时间码

`VideoTimeMapping` 描述旧资产到新资产的：

- 锚点；
- 固定 offset；
- 可选线性 drift；
- 置信度；
- `UNMAPPED/AUTO_ESTIMATED/NEEDS_REVIEW/CONFIRMED/DRIFT_DETECTED/INCOMPATIBLE` 状态。

单锚点计算固定 offset，双锚点以上计算线性 drift。检测到中间删减或插入时标记不兼容，不做非线性自动修复。

重映射必须先展示所有受影响 Clip、旧/新时间范围和置信度。默认不修改；低置信度项逐个确认。确认后仍保留旧资产与旧时间来源链路。

## 11. 数据模型

新增表：

```text
video_source_package
video_source_item
video_source_episode_map
video_source_resolution_cache
video_asset
video_asset_track
video_time_mapping
video_time_mapping_anchor
video_source_task
video_source_task_item
```

MySQL 使用 V26，SQLite 使用 v08；同步更新 baseline、SchemaMigrator、MigrationTool 和测试资源。

## 12. API 边界

```text
POST /api/media-entries/{entryId}/video-sources/search
GET  /api/media-entries/{entryId}/video-sources
POST /api/media-entries/{entryId}/video-sources/preview
POST /api/media-entries/{entryId}/video-sources/link
POST /api/media-entries/{entryId}/video-sources/refresh

GET  /api/episodes/{episodeId}/video-sources
POST /api/episodes/{episodeId}/video-sources/search
POST /api/episodes/{episodeId}/video-sources/{itemId}/probe
POST /api/episodes/{episodeId}/video-sources/{itemId}/select

POST /api/video-assets/{assetId}/play-session
POST /api/video-assets/{assetId}/download
GET  /api/video-assets/{assetId}/references
DELETE /api/video-assets/{assetId}

GET  /api/video-source-tasks
GET  /api/video-source-tasks/{id}
POST /api/video-source-tasks/{id}/pause
POST /api/video-source-tasks/{id}/resume
POST /api/video-source-tasks/{id}/retry

POST /api/clips/{clipId}/materialize
POST /api/clips/{clipId}/remap-preview
POST /api/clips/{clipId}/remap-confirm
```

## 13. 安全边界

所有远程网络访问复用统一策略：

- 仅允许明确协议；
- DNS/IP 校验，拒绝 localhost、私网、保留网段和云元数据；
- 每次重定向重新检查；
- 连接、读取和总超时；
- 探测体和下载大小限制；
- MIME 与实际容器校验；
- 系统生成文件名；
- 临时签名和凭据日志脱敏；
- 不保存 Cookie/token；
- 不代理 DRM/登录资源；
- ffmpeg 参数由受控代码生成。

## 14. 首版范围

第一阶段完成数据模型、Provider 契约、MANUAL/Fake Provider、片源包发现、逐集映射和只保存映射的工作流。

第二阶段完成 Episode 资产、探测、受控播放、单集下载、校验和下载任务。

第三阶段完成 Clip 资产绑定、素材化、时间映射和换源校准。

Torrent、通用代理、登录态抓取、DRM 绕过、非线性自动校准和硬字幕 OCR 不进入 v0.23。

## 15. 验收门禁

- 打开媒体详情和片源工作区不触发 Provider 搜索；
- 包候选默认不选，已关联其他条目的候选禁止迁移；
- 冲突映射阻止保存，人工映射刷新不覆盖；
- 保存映射不自动下载；
- 临时 URL 过期不破坏稳定关联；
- 不安全地址、重定向、登录和 DRM 明确拒绝；
- 下载失败不产生 READY 资产；
- Clip 素材准备和换源失败不破坏原数据；
- Clip-backed 资产删除受保护；
- MySQL、SQLite、Web、Electron 黄金路径通过。


## 16. 详细场景验收

### clip-source-remapping

## ADDED Requirements

### Requirement: Clip binds to a concrete source asset
The system SHALL allow a Clip to reference a specific VideoAsset, millisecond start and end times, source revision and material state while preserving legacy second-based fields for compatibility.

#### Scenario: Save Clip from remote player
- **WHEN** the user marks a time range in a remote Episode player
- **THEN** the system stores the selected asset identity, source revision and millisecond range and creates a `REFERENCE_ONLY` Clip unless local material already exists

#### Scenario: Historical Clip migration
- **WHEN** a legacy Clip has timestamps but no determinable VideoAsset
- **THEN** the system retains the Clip with a null asset reference and a compatible reference-only material state

### Requirement: Non-destructive materialization
The system SHALL prepare local Clip material through a persistent task without deleting or altering Clip metadata when preparation fails.

#### Scenario: Local full-episode asset exists
- **WHEN** a Clip requests materialization and a verified local Episode asset matches its source mapping
- **THEN** the system creates a controlled trim task from that asset

#### Scenario: Materialization fails
- **WHEN** range download, full download or trim fails
- **THEN** the Clip remains available with its tags, note, cover and original time reference and its material state becomes failed

### Requirement: Explicit time mapping between assets
The system SHALL represent source changes through a time mapping containing old asset, new asset, anchors, offset, optional linear drift, confidence and compatibility state.

#### Scenario: One confirmed anchor
- **WHEN** the user confirms one corresponding timestamp pair
- **THEN** the system calculates a fixed offset mapping and marks it for preview

#### Scenario: Multiple anchors reveal linear drift
- **WHEN** two or more anchors indicate a consistent duration ratio
- **THEN** the system calculates an offset plus linear drift and records the confidence

#### Scenario: Mid-episode edit is detected
- **WHEN** anchors cannot be represented by a safe linear mapping because content was inserted or removed
- **THEN** the system marks the assets incompatible and requires per-Clip manual handling

### Requirement: Remapping preview before confirmation
The system SHALL show all affected Clips, old and proposed time ranges, confidence and protection state before writing remapped references.

#### Scenario: High-confidence batch preview
- **WHEN** a confirmed mapping can transform several Clips safely
- **THEN** the system displays proposed ranges while keeping all Clips unmodified until the user confirms

#### Scenario: Low-confidence Clip
- **WHEN** a transformed Clip has low confidence or crosses an incompatible region
- **THEN** the item cannot be included in automatic confirmation and requires individual review

### Requirement: Preserve old asset and time reference
The system SHALL retain the original asset reference and original time data when confirming a remap, unless the user later performs a separate protected cleanup.

#### Scenario: Confirm remap to downloaded revision
- **WHEN** the user confirms a Clip remap to a new downloaded VideoAsset
- **THEN** the system records the mapping lineage and new reference while preserving recoverable original source information

#### Scenario: Delete old referenced asset
- **WHEN** the old asset remains referenced by remap history or another Clip
- **THEN** ordinary deletion is rejected with a reference report


### episode-source-mapping

## ADDED Requirements

### Requirement: Reviewable episode mapping suggestions
The system SHALL generate mapping suggestions from stable Provider episode IDs, unique episode numbers and title evidence, and SHALL expose the reason and confidence for each suggestion.

#### Scenario: Unique episode number match
- **WHEN** one remote source item and one local Episode share a unique episode number within the selected `MediaEntry`
- **THEN** the system proposes an automatic mapping and records `EPISODE_NUMBER` as the mapping reason

#### Scenario: Existing confirmed Provider mapping
- **WHEN** the source item has a previously confirmed stable Provider mapping
- **THEN** the system proposes the same Episode with the highest confidence

### Requirement: Conflict blocking
The system SHALL block package adoption while unresolved duplicate targets, multiple local candidates, wrong-entry items or unresolved specials remain.

#### Scenario: One remote item matches multiple Episodes
- **WHEN** title or numbering evidence matches more than one local Episode
- **THEN** the mapping is marked `CONFLICT` and the confirmation action remains disabled

#### Scenario: Multiple remote items target one Episode
- **WHEN** more than one active source item maps to the same local Episode without an explicit multi-version decision
- **THEN** the mappings are marked duplicate and require manual resolution

### Requirement: Explicit special and ignored-item handling
The system SHALL allow users to classify source items as special content, ignore them, map them manually or explicitly create a new Episode.

#### Scenario: Ignore NCOP item
- **WHEN** the user marks an NCOP source item as ignored
- **THEN** the item no longer blocks package adoption and remains recorded as an explicit ignored mapping

#### Scenario: Create Episode from remote item
- **WHEN** the user chooses to create a local Episode from an unmapped remote item
- **THEN** the system requires a second confirmation and creates the Episode only within the selected `MediaEntry`

### Requirement: Mapping-only adoption by default
The system SHALL save the selected package and confirmed Episode mappings without automatically starting playback or download.

#### Scenario: Confirm package adoption
- **WHEN** all blocking mapping conflicts are resolved and the user confirms adoption
- **THEN** the system persists package and mapping state and creates no download task unless the user separately requests one

#### Scenario: Local Episode lacks a source
- **WHEN** one or more local Episodes have no matching source item
- **THEN** the system allows adoption, reports the missing count and offers later per-Episode discovery

### Requirement: Provider refresh cannot overwrite manual mapping
The system SHALL treat manually confirmed Episode mappings as user data and SHALL require review before changing them.

#### Scenario: Refreshed episode number conflicts with manual mapping
- **WHEN** a Provider revision changes numbering for a manually confirmed source item
- **THEN** the system preserves the manual mapping and creates a conflict notice instead of remapping automatically


### remote-playback-download

## ADDED Requirements

### Requirement: Explainable source availability
The system SHALL expose structured source states including unchecked, checking, playable, expired, login-required, DRM-protected, geo-blocked, unsupported, not-found, timeout and Provider failure, together with the last check time and recommended next action.

#### Scenario: Signed URL has expired
- **WHEN** probing or playback receives an expired temporary address
- **THEN** the system marks the cached resolution expired, retains the stable source item and offers a new resolve attempt

#### Scenario: DRM or login is required
- **WHEN** the resource requires protected playback or authenticated access
- **THEN** the system refuses proxy playback or download and offers the sanitized source page when available

### Requirement: Controlled playback session
The system SHALL create short-lived playback sessions only after Provider resolution, remote resource policy checks and media probing.

#### Scenario: Public browser-compatible source
- **WHEN** a resolved source passes protocol, address, redirect, MIME and compatibility checks
- **THEN** the system creates a short-lived play session that the Episode player can use

#### Scenario: Unsafe redirect target
- **WHEN** any redirect resolves to localhost, a private network, cloud metadata or another prohibited address
- **THEN** the system rejects the session and records a sanitized security failure

## 29. Clip-first 播放工作台补充（2026-09-01）

### 29.1 产品取舍

Video Tagger 的播放器不是完整番剧娱乐平台，而是 `Episode → 播放 → Clip → 标签/备注 → 回看/素材化` 的生产工具。播放器能力以是否提升片段标记效率、来源可追溯性和后续维护安全性为判断标准。

本阶段必须完成：

- 应用内稳定播放公开且浏览器可解码的直接媒体；
- 播放候选可解释、可手工切换，不静默换字幕组或 revision；
- 播放中从当前时间直接记录点标记或 A/B 区间；
- 保存 Clip 时自动绑定 Episode、VideoAsset、source revision 与毫秒范围；
- 标签、标题和备注在播放器内完成，不再要求手工输入秒数；
- 临时地址过期、播放失败和外部源站 fallback 有明确状态与恢复入口；
- 已有 Clip 可在 Episode 播放上下文中回看，并为后续时间轴标记预留接口；
- Web 继续使用 HTML5 Video，Electron 后续可通过 PlayerAdapter 增加原生播放引擎。

本阶段明确不做：

- 弹幕发送、弹幕社区与复杂弹幕过滤；
- 剧集评论、回复、点赞等社区互动；
- 共同观看、房间、成员同步；
- 直播、投屏、媒体中心或通用播放列表；
- 为追求播放器完备度而复制 Animeko UI 或 AGPL 实现；
- 首版 HLS/DASH、DRM、登录态媒体、复杂多音轨和 ASS 排版能力。

### 29.2 播放工作台结构

Episode 详情中的快捷播放面板升级为稳定的播放工作台：

```text
Episode 上下文
├── 播放区：当前候选、原生媒体控件、错误与重新解析
├── 候选区：Provider、字幕组、清晰度、状态与手工选择
├── Clip Dock：当前时间、起点、终点、标题、标签、备注与保存
└── 来源状态：并行查询进度、失败原因和源站 fallback
```

播放工作台 SHALL 在用户开始播放后保持同一个 video 元素，Provider 增量轮询不得反复销毁播放器或重置进度。候选列表刷新和播放器生命周期必须解耦。

### 29.3 Clip Dock

Clip Dock 支持两种保存方式：

1. 点标记：以当前播放时间作为 `start_ms`，`end_ms=NULL`；
2. 区间标记：记录 A 点和 B 点，要求 `end_ms > start_ms`。

保存前：

- 若候选尚未成为 VideoAsset，则由用户保存动作显式触发延迟资产化；
- 标签必填并接入现有媒体上下文补全；
- 标题默认使用 Episode 标题，备注可空；
- UI 展示最终毫秒范围，允许清空或重新取当前时间；
- 保存失败保留草稿和播放位置；
- 保存成功清空区间草稿，但不强制暂停播放。

### 29.4 播放器最小控制集

首批只实现与打标直接相关的控制：

- 播放/暂停；
- 前后跳转 5 秒；
- 读取当前毫秒；
- 设置起点、终点和当前点；
- Clip 区间循环预览预留；
- 重新解析当前候选；
- 打开源站 fallback；
- 基础键盘操作与明确焦点状态。

倍速、音量、全屏继续使用浏览器原生控件；字幕、音轨、帧预览和 Electron 原生播放器进入后续增强，不阻塞首批 Clip 工作流。

### 29.5 会话与一致性

首批复用快捷播放 session，但前端不得把临时 locator 当作永久资产身份。Clip 保存必须先取得或创建 VideoAsset，再通过资产 Clip API 保存。

后续持久化 PlaybackSession 时，至少记录 Episode、VideoAsset、source revision、最后位置和最后心跳；该持久化不作为首批播放器工作台上线的阻塞项。

### 29.6 验收标准

- 用户从 Episode 详情进入快捷播放，候选查询完成后可选择直接播放候选；
- 播放开始后候选状态刷新不会把视频重置到 0；
- 用户无需手工输入秒数即可保存当前点 Clip；
- 用户可设置 A/B 点并保存区间 Clip；
- 第一次保存会显式将所选候选固定为 VideoAsset，后续保存复用该资产；
- 标签为空、区间非法、地址过期和资产化失败均保留 Clip 草稿并显示内联错误；
- 保存成功后 Episode 片段列表可重新加载并看到新 Clip；
- 外部来源仍明确跳转源站，不伪装为应用内可播放；
- 不新增弹幕、评论或共同观看依赖。

### Requirement: Explicit playback fallback
The system SHALL show a specific failure reason and explicit alternatives instead of silently switching versions or downloading content.

#### Scenario: Browser cannot decode the source
- **WHEN** probing succeeds but the browser cannot decode the container or codec
- **THEN** the UI offers source-page access, an allowed download action or another explicitly selected asset

#### Scenario: Primary source fails and fallback exists
- **WHEN** a fallback asset is available after primary playback failure
- **THEN** the system asks the user before switching when version, subtitle, release group or revision differs

### Requirement: Persistent download tasks
The system SHALL persist download and verification tasks with per-item state, progress, retryable error details and application restart recovery.

#### Scenario: Application restarts during download
- **WHEN** the application restarts while a resumable download item is running
- **THEN** the system returns it to a recoverable queued or paused state and retains verified progress metadata

#### Scenario: One item fails in a batch
- **WHEN** one Episode download fails within a multi-item task
- **THEN** other task items continue independently and the failed item can be retried after manual review

### Requirement: Download preflight and explicit start
The system SHALL require an explicit download action and SHALL validate estimated size, minimum free space, target directory and Provider capability before queueing work.

#### Scenario: Mapping is saved
- **WHEN** a source package is adopted successfully
- **THEN** no download task is created automatically

#### Scenario: Insufficient disk space
- **WHEN** estimated download size would violate the configured minimum free-space threshold
- **THEN** the system blocks task creation and reports required and available space

### Requirement: Safe download verification
The system SHALL download into managed temporary files and SHALL verify media type, container, size and fingerprint before marking a VideoAsset ready.

#### Scenario: Response body is not a video
- **WHEN** a download returns HTML, JSON or another unexpected payload
- **THEN** verification fails, the asset is not marked ready and the response content is not exposed as a playable file

#### Scenario: Verification succeeds
- **WHEN** the temporary file passes all configured checks
- **THEN** the system atomically promotes it to the managed asset path and records technical metadata


### video-asset-management

## ADDED Requirements

### Requirement: Unified VideoAsset identity
The system SHALL represent local originals, remote streams, downloads, uploads, generated Clip files and temporary proxy caches as distinct `VideoAsset` records bound to a specific Episode.

#### Scenario: Download remote episode
- **WHEN** a remote source item download is verified successfully
- **THEN** the system creates a new `DOWNLOADED` VideoAsset linked to the Episode and source revision without overwriting another asset

#### Scenario: Historical Episode URL
- **WHEN** a legacy Episode has only `url` and `videoFp`
- **THEN** the system keeps it readable and MAY create a compatible local or remote VideoAsset without deleting the legacy fields

### Requirement: Explicit primary and fallback assets
The system SHALL require explicit selection of primary and fallback assets and SHALL NOT infer priority solely from insertion order.

#### Scenario: User selects a primary remote line
- **WHEN** the user marks a playable Episode asset as primary
- **THEN** the system records the role and retains all other assets as fallback or inactive assets

#### Scenario: Primary line fails
- **WHEN** the primary asset becomes unavailable
- **THEN** the system asks before switching to a fallback with a different release group, subtitle language or revision

### Requirement: Asset and track metadata
The system SHALL store duration, container, codecs, dimensions, file size, content fingerprint, Provider revision and subtitle/audio track metadata when available.

#### Scenario: Verify downloaded asset
- **WHEN** download verification reads the media container
- **THEN** the system updates technical metadata and marks the asset ready only after validation succeeds

#### Scenario: Subtitle track discovered
- **WHEN** a Provider or verified local asset exposes subtitle tracks
- **THEN** the system records track type, language, format and default state separately from the VideoAsset

### Requirement: Managed asset storage
The system SHALL generate managed storage paths from database identities, use temporary `.part` files during download and atomically promote verified files.

#### Scenario: Remote filename contains unsafe characters
- **WHEN** a remote response supplies an arbitrary filename
- **THEN** the system uses a generated `asset-{id}` path and treats the remote filename as display-only metadata

#### Scenario: Interrupted download
- **WHEN** a download stops before verification
- **THEN** the system retains or removes only the managed temporary file according to resume capability and SHALL NOT expose it as a ready asset

### Requirement: Reference-protected deletion
The system SHALL prevent ordinary deletion of assets referenced by Clips, time mappings, active tasks or highlight projects.

#### Scenario: Asset referenced by Clip
- **WHEN** the user attempts to delete a VideoAsset referenced by one or more Clips
- **THEN** the system rejects ordinary deletion and returns the reference count and affected entities

#### Scenario: Unlink remote package
- **WHEN** the user unlinks a source package
- **THEN** the system retains downloaded assets and other referenced VideoAssets until separately and safely deleted


### video-source-discovery

## ADDED Requirements

### Requirement: Explicit MediaEntry-scoped discovery
The system SHALL start video source discovery only from a specific `MediaEntry` and SHALL NOT contact a video source Provider merely because a media detail page was opened.

#### Scenario: Open source workspace without network discovery
- **WHEN** a user opens the video source workspace for a `MediaEntry`
- **THEN** the system displays cached package and mapping state without invoking Provider discovery

#### Scenario: User explicitly starts discovery
- **WHEN** the user clicks the discover action for the selected `MediaEntry`
- **THEN** the system queries enabled Providers using the entry external IDs, titles, year, season, format and episode count

### Requirement: Explicit package selection
The system SHALL return source packages as unselected candidates and SHALL require the user to explicitly choose one package before episode mapping begins.

#### Scenario: Multiple release packages found
- **WHEN** discovery returns packages from different release groups, subtitle languages or editions
- **THEN** the system displays their capabilities, matching reasons and version metadata without automatically selecting the highest-ranked package

#### Scenario: Package already linked elsewhere
- **WHEN** a stable Provider package is linked to a different `MediaEntry`
- **THEN** the system disables direct adoption and explains the existing association

### Requirement: Controlled Provider configuration
The system SHALL allow administrators to enable and configure declarative Provider settings while rejecting arbitrary scripts, shell commands, raw ffmpeg arguments and unrestricted request headers.

#### Scenario: Provider connection test
- **WHEN** the user tests an enabled Provider configuration
- **THEN** the system reports supported capabilities, connectivity and a sanitized failure reason without persisting credentials in logs

#### Scenario: Unsafe Provider configuration
- **WHEN** Provider configuration includes an unsupported executable command or unrestricted header injection
- **THEN** the system rejects the configuration before it can be used

### Requirement: Stable package and item identity
The system SHALL identify source packages and items by Provider stable IDs and revisions rather than by temporary resolved media URLs.

#### Scenario: Temporary URL expires
- **WHEN** a cached resolved URL reaches its expiry time
- **THEN** the system retains the source package and item association and requests a new resolution before playback or download

#### Scenario: Provider returns a new revision
- **WHEN** a Provider refresh reports a new package revision
- **THEN** the system stores a revision diff and SHALL NOT silently replace the adopted revision or downloaded assets

### Requirement: Non-destructive package refresh
The system SHALL preserve confirmed mappings, historical revisions and downloaded assets when refreshing a package.

#### Scenario: Episode item disappears remotely
- **WHEN** a previously mapped source item is absent from a refreshed Provider response
- **THEN** the system marks the item stale or missing and retains its Episode mapping and existing assets

#### Scenario: New source item appears
- **WHEN** a package refresh discovers a new episode item
- **THEN** the system creates a pending mapping suggestion that requires review before adoption

## 30. 独立播放窗口与 Animeko 查询兼容优化（2026-09-01）

### 30.1 独立窗口

Episode 详情页只负责查询和选择候选。用户点击“进入播放与打标”后，Web 使用受用户手势触发的独立浏览器窗口，Electron 使用同源子 `BrowserWindow` 打开 `/player.html`。窗口采用“左侧大画面、右侧来源与解析状态、下方 Clip Dock”的信息结构，参考 Animeko 播放页的空间分配，但颜色、字体、按钮、表单、卡片和状态反馈继续复用 Video Tagger 当前网站设计语言。

独立窗口与主窗口通过 `BroadcastChannel` 通知 Clip 保存结果；主窗口刷新 Episode Clip，播放器不依赖主页面 DOM 生命周期。弹窗被浏览器阻止时，退回原 Episode 面板内工作台。

### 30.2 查询差异与优化

Animeko 的 Selector 查询将主标题用于搜索，同时携带全部作品名进行结果过滤；标题比较会做 Unicode、标点、空白和常见版本标记归一化，并结合包含关系和模糊相似度判断。其 Web 数据源还使用共享浏览器身份、Cookie 会话和原生播放器，因此与仅使用第一标题、无会话的浏览器直链方案表现不同。

本项目调整为：

1. 查询依次尝试 `MediaEntry.titleCn`、`MediaEntry.title`、媒体主标题和媒体别名，搜索结果按全部标题的归一化相似度排序并按 URL 去重。
2. 搜索关键词兼容 `searchRemoveSpecial` 与 `searchUseOnlyFirstWord`，移除剧场版、电影版等常见标记和标点后再查询。
3. 纯数字剧集按钮也可解析为集号，减少页面只显示“1 / 2 / 3”时的匹配失败。
4. 单 Provider 查询时限由 12 秒提高到 20 秒，为多别名搜索和详情解析保留余量。

### 30.3 线路访问兼容

浏览器直接加载第三方媒体会受到 CORS、Referer、防盗链和 Range 请求差异影响；Animeko 的 MPV/VLC 原生播放不受浏览器 CORS 限制。v0.23 新增与快捷播放会话绑定的受控媒体中继：前端只请求本地候选 stream API，后端校验候选和过期时间，向已解析的公开媒体地址转发合法 Range、浏览器型 User-Agent 与来源页 Referer，并校验每次重定向目标，禁止把它扩展为任意 URL 代理。

### 30.4 仍然保持的边界

- 不转发订阅 Cookie、Authorization、任意自定义请求头，也不处理登录、验证码、付费、地区限制和 DRM。
- 受控中继优先解决公开 MP4/WebM/Ogg 的 CORS、Range 与 Referer 问题；HLS/DASH、MKV 和需要原生解码器的线路仍不能标记为已完成。
- 若真实线路主要依赖 HLS/MKV，应在后续单独选择“内置 HLS 客户端”或“Electron 原生 MPV”路线，不在普通 HTML5 `<video>` 中伪装兼容。

### 30.5 精确作品与集匹配

为避免“同集号但不同番剧”进入可播放候选，快捷播放查询上下文 SHALL 同时携带作品外部 ID、集外部 ID、全部作品标题、集标题、季度集号和系列集号。候选筛选顺序固定为：

1. 作品或集外部 ID 命中时直接视为最高等级匹配，不以模糊标题覆盖 ID 冲突。
2. 无外部 ID 时，先对作品包标题、详情页标题和脱敏快照标题做 Unicode、标点、空白及常见版本标记归一化。
3. 作品标题低于匹配阈值的包不得进入详情后的可播放候选；仅集号相同不能通过。
4. 作品标题通过后，优先严格匹配系列集号/季度集号；集号冲突直接标记 `CONFLICT` 并排除。
5. 源站缺失集号时，仅当集标题高度吻合才允许 `FUZZY_TITLE_EPISODE`；作品标题通过但缺少集证据时只允许 `EPISODE_ONLY`，并在 UI 展示原因。

候选 SHALL 暴露匹配等级与原因，并把匹配等级纳入可播放、来源优先级和清晰度之外的最终排序。匹配失败必须显示“作品标题不匹配”“集号冲突”或“缺少可验证集证据”等可行动原因。

### 30.6 播放器交互取舍

播放器只围绕 `Episode → 播放 → Clip → 标签/备注 → 回看` 优化：采用沉浸式视频舞台、底部时间轴、起点/终点/已保存 Clip 标记、右侧当前 Clip 编辑、来源切换和折叠诊断。保存后保留当前来源并清空草稿，允许连续创建多个 Clip；已保存 Clip 可一键定位并循环回看。

不纳入 v0.23 的 Animeko 社交或完整播放器能力：弹幕、评论、共同观看、推荐流、持久播放历史、字幕/音轨切换、HLS/DASH、MKV、DRM 和原生 MPV。浏览器原生解码能力不足时必须给出分类错误并允许打开源站。

## 31. 《少女与战车》对照验收与本轮收敛（2026-09-02）

### 31.1 对照事实

使用相同作品《少女与战车》第 2 集进行 Animeko 与 Video Tagger 对照。Animeko 的 Bangumi 条目为 `40310`，第 2 集 ID 为 `198749`，最终使用稀饭动漫 `xfvod` 播放：

```text
https://play.xfvod.pro:8088/S/S-%E5%B0%91%E5%A5%B3%E4%B8%8E%E6%88%98%E8%BD%A6/TV/02.mp4
```

Animeko 搜索阶段尝试 `少女与战车`、`GIRLS`、`ガルパン`，再经过作品、线路、集号和视频地址多级筛选；其播放器使用 MPV/libmpv，确认 MP4、1080p、H.264 和约 24 分钟时长。

Video Tagger 原实现曾从第 2 集页面的多个 MP4 中直接取第一个地址，错误得到 `TV/03.mp4`；同时把剧场版、OVA、最终章和特典等衍生作品混入候选。根因是作品边界和页面集号到媒体地址的上下文丢失。

### 31.2 已收敛的行为

1. 查询携带作品/集外部 ID、全部作品标题、集标题、季度集号和系列集号。
2. 主条目查询排除 OVA、OAD、剧场版、最终章、特典、总集篇、番外篇和特别篇。
3. 作品通过后严格校验集号；同集号但作品不一致的候选拒绝进入可播放列表。
4. 播放页含多个媒体地址时，优先选择与页面集号一致的文件；第 2 集页面选择 `TV/02.mp4`，只有无法比较集号时才回退。
5. 线路按匹配质量、可播放状态、Provider 优先级、Animeko `channelTiers` 和清晰度排序，并展示匹配等级与原因。
6. 公开 MP4 通过会话绑定的受控中继播放，转发合法 Range、Referer 和浏览器型 User-Agent；不转发 Cookie、Authorization 或任意请求头。

### 31.3 仍不宣称已支持

Animeko 依赖 MPV、共享会话或原生解码器的 HLS/DASH、MKV、登录态、DRM、字幕/音轨切换、弹幕、评论和共同观看仍不属于 v0.23 完成范围。线路失败时 UI 应区分网络超时、429/重定向、防盗链、格式不兼容和鉴权失败，并允许跳转源站。
