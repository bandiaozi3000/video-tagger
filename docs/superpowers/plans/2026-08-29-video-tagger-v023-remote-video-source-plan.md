# v0.23 远程视频源与片段资产化实施计划

- **日期**：2026-08-29
- **版本**：v0.23.0
- **状态**：G1-G4 基础实现已完成，G5-G11 按本计划继续推进
- **主设计**：`docs/superpowers/specs/2026-08-29-video-tagger-v023-remote-video-source-design.md`

## 1. 实施目标

1. 从具体 `MediaEntry` 显式发现整部作品片源包，不因打开页面自动访问 Provider。
2. 以 Provider 稳定 package/item ID 建立逐集映射，临时解析 URL 只作为有期限缓存。
3. 统一远程、本地、下载、上传和生成资源为 `VideoAsset`，并明确主线路、备用线路和可解释状态。
4. Clip 绑定具体资产、来源 revision 和毫秒范围；下载、素材准备与换源校准均使用可恢复持久化任务。
5. MySQL 与 SQLite 同步演进，保留历史 Episode、Clip、URL、指纹和秒级字段兼容性。
6. 远程访问严格经过安全策略，不转发 Cookie/token，不绕过登录、付费、地区或 DRM 限制。

## 2. 执行原则

- 先契约和迁移，再 Provider、服务和 UI，避免界面先行后反复修改数据状态。
- 候选包默认不选；采用包默认只保存映射，不自动下载。
- 映射冲突阻断采用，缺少本地源不阻断；任何自动建议都必须展示原因和置信度。
- 播放、下载、探测失败保留稳定身份与历史状态，不静默换源、不破坏已下载资产。
- 新 Clip 同时写毫秒级资产引用和旧秒级兼容字段；旧 Clip 无法确定资产时保持可读。
- 每个阶段先跑最小定向测试，再进入跨模块验证；发现设计冲突时先更新主设计和本计划。

## 3. 阶段与门禁

### G1 文档与基础契约

- 完成唯一 v0.23 主设计、主计划和统一任务映射。
- 定义 Provider 能力、发现、包详情、源项、解析、探测和下载 DTO。
- 定义 package、mapping、asset、probe、task、material、time-mapping 等共享状态常量。
- 定义 `VideoSourceProvider`，首阶段不接入真实站点网络实现。

**完成门禁**：基础契约可独立编译；状态语义覆盖设计文档；接口不暴露任意请求头、脚本、shell 或原始 ffmpeg 参数。

### G2 双数据库基础

- 新增 MySQL `V26__remote_video_sources.sql`。
- 新增生产与测试 SQLite `v08.sql`，同步更新 `sqlite-schema.sql`。
- 新增片源包、源项、Episode 映射、解析缓存、资产、轨道、时间映射、锚点、任务和任务项表。
- 扩展 `clips`：`video_asset_id/start_ms/end_ms/source_revision/time_mapping_id/material_state`。
- 对旧 Clip 回填毫秒范围与兼容素材状态，不删除旧 URL、指纹和秒级字段。
- 更新 `SqliteSchemaMigrator`、迁移回归测试和 `MigrationTool`。

**完成门禁**：MySQL V26 可执行；SQLite 新库与 v07 升 v08 均通过；重复迁移安全；历史 Clip 数据不丢失。

**回滚边界**：V26/v08 仅新增表、索引、列和兼容回填；发布前可回退应用版本并忽略新增结构，不执行破坏性降级 SQL。

### G3 持久化模型

- 为片源包、源项、Episode 映射和解析缓存增加实体与 Mapper。
- 为 `VideoAsset`、`VideoAssetTrack` 增加实体、线路排序和可用性查询。
- 为时间映射、锚点、持久化任务和任务项增加实体与 Mapper。
- 扩展 Clip 实体、查询投影和保存逻辑。
- 覆盖稳定身份、唯一映射、主线路排序、引用保护和历史字段兼容测试。

**完成门禁**：双库 CRUD 行为一致；Provider 稳定 ID 唯一；一个源项不能被静默映射到多个 Episode；受引用资产不能普通删除。

### G4 Provider 与远程安全

- 实现 Provider 注册表、能力发现和声明式配置校验。
- 实现 `MANUAL` Provider，支持用户自有本地文件和明确提供的公开资源。
- 实现 Fake Provider，覆盖 revision、过期、冲突和缺失源测试。
- 实现 `RemoteResourcePolicy`：协议、DNS/IP、重定向、超时、大小、MIME 和日志脱敏。

**完成门禁**：SSRF、私网地址、危险重定向、凭据日志和不安全配置测试通过；未显式操作时零 Provider 网络请求。

### G5 发现与逐集映射

- 实现 `MediaEntry` 范围的显式片源包发现、候选排序和详情读取。
- 校验稳定包关联，阻止同一 Provider 包直接绑定到其他条目。
- 生成逐集映射建议，展示证据、置信度、冲突、忽略和显式建集动作。
- 实现仅映射采用和非破坏 revision 刷新。

**完成门禁**：候选默认未选；冲突未解决不能采用；缺失本地源可采用；刷新不覆盖已确认 revision、映射或下载资产。

### G6 全屏片源工作区

- 在媒体详情每个 `MediaEntry` 外部资料卡显示独立片源状态与入口。
- 构建全屏工作区：缓存状态、显式查找、候选列表、详情抽屉、选择与逐集审核。
- 增加冲突阻断、忽略特别篇、确认摘要、revision diff 和缺失源视图。
- 支持宽屏多栏、窄屏分步、键盘焦点、分页/筛选/排序和清晰空态。

**完成门禁**：打开详情和工作区不联网；多个条目选择互不干扰；刷新后选择状态可解释；浏览器响应式黄金路径通过。

### G7 Episode 资产、探测与播放

- 实现资产创建、主/备用线路显式选择和轨道元数据服务。
- 实现解析缓存生命周期与结构化探测状态。
- 实现经安全策略守卫的短期播放会话。
- 在 Episode 详情展示资产列表、状态原因、显式 fallback 和来源页入口。

**完成门禁**：URL 过期可重新解析且不改变资产身份；登录/DRM/不兼容/危险重定向有明确状态；系统不静默切换线路。

### G8 持久化下载与校验

- 采用数据库 ID 生成 `data/video-assets/` 托管路径，下载使用 `.part` 临时文件。
- 实现磁盘预检、下载计划、暂停、恢复、重试、取消和重启恢复。
- 校验大小、MIME、指纹和媒体元信息，通过后原子提升为可用本地资产。
- 构建任务进度、单项错误、磁盘状态和明确重试 UI。

**完成门禁**：中断、坏响应、磁盘不足和部分失败均不产生伪 READY 资产；重启后任务状态可恢复。

**回滚边界**：数据库任务与 `.part` 文件可安全清理；已验证资产不因任务或包解绑自动删除。

### G9 Clip 资产绑定与素材准备

- 新 Clip 保存具体 `VideoAsset`、revision、毫秒范围和兼容旧字段。
- 支持播放器创建 `REFERENCE_ONLY` Clip。
- 从已验证本地整集、允许的范围下载或完整下载生成素材准备计划。
- 通过受控参数执行裁剪，失败只更新素材状态，不删除 Clip 元数据。

**完成门禁**：远程 Clip 可先保存后准备；失败保留标签、备注、封面和时间引用；历史 Clip 继续可读可编辑。

### G10 时间映射与换源校准

- 实现锚点、固定偏移、线性漂移、置信度和不兼容状态计算。
- 实现受影响 Clip 的旧/新范围预览和逐项阻断。
- 构建双播放器同步校准、帧级微调和锚点管理 UI。
- 确认后记录重映射血缘，保留旧资产和旧时间引用。

**完成门禁**：未经确认不修改 Clip；低置信度和非线性差异不能批量确认；旧资产受引用时禁止普通删除。

### G11 发布验证与文档

- 跑双库迁移、Provider、安全策略、任务恢复、下载、Clip 和重映射测试。
- 验证 Web/Electron 的发现、映射、播放、下载、素材准备和换源黄金路径。
- 更新 README、API 文档、CHANGELOG、story 和 `docs/worklog/2026-08-29.md`。
- 使用授权真实 Provider 验证公开能力，并记录登录、DRM、HLS/DASH 等不支持边界。

**完成门禁**：所有主设计验收条件通过，且真实远程能力未越过安全和授权边界，才标记 v0.23 完成。

## 4. 推荐实施顺序

```text
G1 契约
→ G2 双库迁移
→ G3 持久化模型
→ G4 Provider/安全层
→ G5 发现与映射
→ G6 全屏工作区
→ G7 播放
→ G8 下载
→ G9 Clip 素材准备
→ G10 换源校准
→ G11 发布验证
```

G6 不能早于 G5，因为分页、选择、冲突和 revision 状态必须由稳定后端模型驱动。G8 不能早于 G7，因为下载与播放共用解析缓存、安全策略和资产身份。G10 最后实施，以已稳定的资产引用和 Clip 毫秒模型为基础。

## 5. 关键文件范围

```text
backend/src/main/java/com/videotagger/videosource/**
backend/src/main/java/com/videotagger/entity/{VideoSource*,VideoAsset*,VideoTimeMapping*}.java
backend/src/main/java/com/videotagger/mapper/{VideoSource*,VideoAsset*,VideoTimeMapping*}Mapper.java
backend/src/main/java/com/videotagger/controller/*VideoSource*.java
backend/src/main/java/com/videotagger/service/*VideoSource*.java
backend/src/main/resources/db/migration/V26__remote_video_sources.sql
backend/src/main/resources/db/migration-sqlite/v08.sql
backend/src/main/resources/db/sqlite-schema.sql
backend/src/main/resources/static/v023-video-sources.*
backend/src/test/java/com/videotagger/videosource/**
```

实际文件按现有包结构保持最小改动；不为追求目录统一移动 v0.22 已有代码。

## 6. 测试矩阵

### 数据与迁移

- MySQL 空库 V1→V26、现有 V25→V26。
- SQLite 空库 baseline、v07→v08、重复启动。
- Clip 秒转毫秒、空结束时间、未知资产、旧 URL/指纹保留。
- MigrationTool 新表、外键顺序、新 Clip 列复制。

### Provider 与安全

- 显式发现、打开页面零联网、能力缺失。
- revision 更新、临时 URL 过期、源项消失和新增。
- `http/https/file` 允许范围、私网/IP/DNS 重绑定、重定向链。
- 超时、大小、MIME、日志脱敏、Cookie/token 拒绝。

### 映射与资产

- 稳定 Provider ID、唯一集号、标题证据和已有确认映射。
- 一对多、多对一、错误条目、特别篇和手动创建 Episode。
- 主/备用排序、缺失、过期、登录、DRM、不兼容和来源页 fallback。
- 资产被 Clip、时间映射、任务或高光项目引用时删除保护。

### 任务、Clip 与换源

- 下载暂停/恢复/重试/取消/重启恢复。
- 磁盘不足、无效载荷、部分批次失败和原子提升。
- `REFERENCE_ONLY`、素材准备成功/失败和历史 Clip 兼容。
- 单锚点偏移、多锚点漂移、非线性不兼容、低置信度和旧引用保护。

### 前端

- 多 `MediaEntry` 独立入口与状态。
- 候选默认不选、分页/筛选/排序、详情抽屉和确认摘要。
- 冲突阻断、忽略特别篇、缺失源不阻断和 revision diff。
- Episode 明确换线、来源页 fallback、任务进度、校准预览和窄屏布局。

## 7. 明确不做

- Torrent、磁力链接、BT 客户端或自动整季下载。
- Cookie/token 保存或转发、登录态抓取、付费墙/地区/DRM 绕过。
- 通用开放代理、任意脚本、shell、外部命令模板或原始 ffmpeg 参数。
- 静默主线路切换、自动采用片源包、自动改写已有 Clip 时间码。
- 首版自动修复非线性剪辑差异、硬字幕 OCR 或复杂合集章节拆分。

## 8. 版本完成定义

v0.23.0 只有在以下条件全部满足时才完成：双库迁移可回归；打开页面零 Provider 网络；片源包显式选择与冲突审核可用；资产状态可解释且不静默换线；下载和素材任务可恢复；Clip 绑定与换源预览非破坏；安全边界测试通过；Web/Electron 黄金路径完成；主设计、主计划、CHANGELOG、story 和 worklog 状态一致。

## 9. 当前执行状态

- 产品版本继续为 v0.23；此前误标为 v0.24 的真实 Provider 工作已合并回本计划。
- 追加 Animeko 兼容订阅、数据源实例管理、分步测试、快捷播放候选和延迟资产化工作。

- **Superpowers 唯一基准**：主设计、主计划、README、CHANGELOG、story 和 worklog 已统一；重复变更目录、技能和依赖文字已清理。
- **实现完成**：G1-G10 的数据、Provider、安全、发现、映射、资产、播放、下载任务、Clip 素材化与换源校准已落地。
- **自动验证**：编译、JavaScript 语法、定向测试、隔离 SQLite 启动与基础 HTTP 路径通过；最终全量 Maven 275 项测试通过。
- **外部验收**：本机 `agent-browser` Chrome CDP 自动启动失败，Web 响应式细节和 Electron 黄金路径由用户统一验收；真实授权 Provider 尚未内置，MANUAL/Fake 边界已文档化。
## 附录 A：详细执行清单（已并入 Superpowers）

## 1. Version Documentation and Contracts

- [x] 1.1 Create the unique v0.23 master design document from the approved grilling decisions and 需求要求
- [x] 1.2 Create the unique v0.23 implementation plan with gates, sequencing and rollback boundaries
- [x] 1.3 Define shared status constants, Provider DTOs and the `VideoSourceProvider` capability contract

## 2. Dual-Database Foundation

- [x] 2.1 Add MySQL V26 tables for source packages, source items, Episode mappings, resolution cache, VideoAssets and tracks
- [x] 2.2 Add MySQL V26 tables for time mappings, anchors, persistent source tasks and task items, and extend `clips`
- [x] 2.3 Add equivalent SQLite v08 production and test migrations with legacy Clip millisecond backfill
- [x] 2.4 Update SQLite baseline schema, schema migrator versioning and migration regression tests
- [x] 2.5 Extend MigrationTool to copy all v0.23 tables and new Clip fields

## 3. Persistence Model

- [x] 3.1 Add entities and Mappers for source package, item, Episode mapping and resolution cache
- [x] 3.2 Add entities and Mappers for VideoAsset and VideoAssetTrack with explicit role and availability queries
- [x] 3.3 Add entities and Mappers for time mapping, anchors, source task and task item
- [x] 3.4 Extend Clip entity and mapper projections for asset identity, millisecond ranges, revision and material state
- [x] 3.5 Add persistence tests covering stable identity, primary ordering, mapping uniqueness and protected references

## 4. Provider and Security Layer

- [x] 4.1 Implement Provider registry, capabilities and declarative configuration validation
- [x] 4.2 Implement MANUAL Provider for user-owned local files and explicitly supplied public resources
- [x] 4.3 Implement Fake Provider fixtures for discovery, revision, expiry and conflict tests
- [x] 4.4 Implement shared RemoteResourcePolicy for protocol, DNS/IP, redirects, timeout, size, MIME and log redaction
- [x] 4.5 Add SSRF, redirect, credential-redaction and unsafe Provider configuration tests

## 5. Discovery and Episode Mapping

- [x] 5.1 Implement explicit MediaEntry-scoped package discovery without automatic page-load networking
- [x] 5.2 Implement candidate ranking, stable association checks and package detail retrieval
- [x] 5.3 Implement Episode mapping suggestions, conflict states, manual decisions and explicit Episode creation
- [x] 5.4 Implement mapping-only package adoption and non-destructive revision refresh
- [x] 5.5 Add discovery, conflict blocking, missing-source and manual-mapping service tests

## 6. Source Workspace UI

- [x] 6.1 Add per-MediaEntry source status and entry actions to the media detail external archive card
- [x] 6.2 Build the full-screen source workspace with discovery, explicit package selection and detail drawer
- [x] 6.3 Build Episode mapping review with blocking conflicts, ignored specials and confirmation summary
- [x] 6.4 Build cached package management, revision diff and missing-source views
- [ ] 6.5 Validate no-network-on-open, independent selection, conflict resolution and responsive layouts in browser

## 7. Episode Assets, Probe and Playback

- [x] 7.1 Implement VideoAsset creation, explicit primary/fallback selection and track metadata services
- [x] 7.2 Implement resolution cache lifecycle and structured probe states
- [x] 7.3 Implement short-lived play sessions guarded by RemoteResourcePolicy
- [x] 7.4 Add Episode detail asset UI, source-state explanations, explicit fallback and source-page actions
- [x] 7.5 Add playback compatibility, expiry, login, DRM, unsafe redirect and fallback tests

## 8. Persistent Download and Verification

- [x] 8.1 Implement managed asset paths, temporary files, free-space preflight and download planning
- [x] 8.2 Implement persistent source task executor with pause, resume, retry, cancellation and restart recovery
- [x] 8.3 Implement safe download verification, fingerprinting, metadata extraction and atomic promotion
- [x] 8.4 Build download task UI with progress, item errors, disk status and explicit retry actions
- [x] 8.5 Add interrupted download, invalid payload, insufficient disk and partial batch failure tests

## 9. Clip Asset Binding and Materialization

- [x] 9.1 Write new Clip saves with VideoAsset identity, millisecond ranges, source revision and legacy field compatibility
- [x] 9.2 Implement reference-only Clip creation from the Episode player
- [x] 9.3 Implement materialization planning from verified local asset, allowed range download or full Episode download
- [x] 9.4 Implement controlled trim execution and non-destructive failure states
- [x] 9.5 Add Clip detail provenance, material-state and prepare-material interactions with regression tests

## 10. Time Mapping and Source Remap

- [x] 10.1 Implement time mapping anchors, fixed offset, linear drift and incompatible-state calculation
- [x] 10.2 Implement Clip remap preview with confidence, protected history and per-item blocking
- [x] 10.3 Build synchronized dual-player calibration UI with frame adjustment and anchor management
- [x] 10.4 Implement confirmed remap lineage while preserving old asset and time references
- [x] 10.5 Add offset, drift, incompatible edit, low-confidence and deletion-protection tests

## 11. Release Validation and Documentation

- [x] 11.1 Run MySQL/SQLite migration, Provider, task recovery, download, Clip and remap test suites
- [ ] 11.2 Validate Web and Electron golden paths for discovery, mapping, playback, download, Clip preparation and remap
- [x] 11.3 Update README, API documentation, CHANGELOG, story and daily worklog
- [x] 11.4 Verify real authorized Provider behavior and document unsupported login, DRM and HLS/DASH boundaries

## 12. Real Providers（v0.23 追加）

- [x] 12.1 Add bounded same-origin Provider HTTP client and stable source identity helpers
- [x] 12.2 Add opt-in Jellyfin metadata Provider with credential redaction
- [x] 12.3 Add Mikan and AnimeGarden RSS torrent Providers
- [x] 12.4 Add declarative Web Selector Provider for public direct media
- [x] 12.5 Add capability API, Provider selector UI and security tests

## 13. Subscription and Source Management（v0.23 追加）

- [x] 13.1 Add dual-database subscription, definition and user-instance persistence
- [x] 13.2 Add Animeko subscription envelope importer for `rss/v1` and `web-selector/v2`
- [x] 13.3 Add bounded conditional refresh, snapshots, compatibility status and non-destructive diffing
- [x] 13.4 Add source management API for subscriptions, instances, enablement, ordering and health tests
- [x] 13.5 Build subscription preview, source list, template creation and advanced test UI

## 14. Quick Play and Candidate Selection（v0.23 追加）

- [x] 14.1 Add Episode media query, candidate, attempt and playable-media contracts
- [x] 14.2 Query enabled Providers concurrently with per-source timeout and incremental status
- [x] 14.3 Add deterministic selector using source order, tier, playability and prior preference
- [x] 14.4 Add short-lived quick-play sessions and safe pre-play fallback
- [x] 14.5 Add Episode play action, progress panel and manual source drawer
- [x] 14.6 Lazily materialize selected candidates only for pin, download or Clip workflows

## 15. Subscription and Quick-Play Validation（v0.23 追加）

- [x] 15.1 Add importer, refresh, identity, removal and rollback tests
- [x] 15.2 Add concurrent query, timeout isolation, sorting and fallback tests
- [x] 15.3 Add API/controller and JavaScript syntax tests
- [x] 15.4 Update README, CHANGELOG, story and 2026-08-31 worklog
- [x] 15.5 Run focused and full Maven validation plus diff checks

## 16. Animeko Web Playback Completion（v0.23 追加）

- [x] 16.1 Preserve executable selectors while stripping Cookie and custom-header overrides
- [x] 16.2 Execute Animeko `web-selector/v2` search, subject, channel and episode selectors
- [x] 16.3 Add per-source configuration, save and step-test interaction
- [x] 16.4 Add direct-play and source-page fallback candidate modes
- [x] 16.5 Validate configuration-to-Episode-to-source-selection flow against a real subscribed site
- [x] 16.6 Confirm Clip-first playback scope excludes danmaku, comments and watch-together

## 17. Clip-first Player Workbench（v0.23 追加，2026-09-01）

- [x] 17.1 Confirm product boundary: retain playback, source selection, Clip marking and maintenance; exclude danmaku, comments and watch-together
- [x] 17.2 Extend the v0.23 master design with the stable player lifecycle, Clip Dock and acceptance criteria
- [x] 17.3 Refactor Episode quick play so candidate polling does not recreate an active video element
- [x] 17.4 Add an in-player Clip Dock with current-point, A/B range, title, tag and note inputs
- [x] 17.5 Lazily materialize the selected candidate on the first Clip save and reuse the resulting VideoAsset
- [x] 17.6 Refresh Episode Clip data after save while preserving playback position and unsaved input on failure
- [x] 17.7 Add keyboard-accessible seek and mark controls plus responsive player layout consistent with the current website
- [x] 17.8 Add focused service/controller tests for materialize-and-save behavior and JavaScript syntax validation
- [ ] 17.9 Run a real browser golden path with a deterministic direct MP4 Provider fixture

### Execution gates

1. `17.3-17.6` form the first deliverable and SHALL NOT add persistent playback history, danmaku or native MPV integration.
2. A selected direct candidate must be user-visible before asset materialization; opening the player alone must not persist a VideoAsset.
3. Candidate polling must stop or become non-destructive once playback starts.
4. Clip creation failure must not discard the current source, player position, A/B range or entered metadata.
5. Electron native playback, subtitle/audio switching and frame preview require a separate follow-up decision after the HTML5 golden path passes.

## 18. Standalone Player and Animeko Query Compatibility（v0.23 追加，2026-09-01）

- [x] 18.1 Compare Animeko 6.0.0 official selector, title filtering, shared session and native playback behavior with the current implementation
- [x] 18.2 Move the Clip-first workbench into a standalone Web/Electron player window with inline fallback
- [x] 18.3 Search MediaEntry titles, media title and aliases with normalized ranking and URL deduplication
- [x] 18.4 Recognize numeric-only episode labels and increase per-source query time for multi-title lookup
- [x] 18.5 Add a session-bound public-media relay forwarding safe Range, Referer and browser User-Agent headers
- [x] 18.6 Add regression tests for title normalization, alias retry, numeric episode parsing and relay headers
- [ ] 18.7 Validate failing real-world lines through the standalone window and classify CORS/Referer, HLS, codec, login or source-expiry failures
- [ ] 18.8 Decide whether HLS support or Electron native MPV is justified after real-line classification

### Execution gates

1. The relay must accept only a candidate already resolved inside a live quick-play session; no arbitrary URL parameter is allowed.
2. Redirect targets remain subject to public-network validation, and Cookie/Authorization forwarding remains forbidden.
3. The standalone player follows the current Video Tagger visual system even when its layout references Animeko.
4. HLS/DASH/MKV capability must remain reported as unsupported until a real decoder path is implemented and validated.

## 19. 精确匹配与沉浸式播放器补充执行

- [x] 19.1 扩展 `VideoSourceDiscoveryQuery`，携带作品/集外部 ID、集标题、季度集号和系列集号
- [x] 19.2 从 `external_work` 与 `external_episode` 读取已同步关联，构造 Episode 级查询上下文
- [x] 19.3 实现外部 ID 优先、作品标题先验过滤、集号严格校验和集标题兜底匹配
- [x] 19.4 为候选返回匹配等级/原因，并将匹配质量纳入排序；补充跨作品同集号回归测试
- [x] 19.5 在 Web Selector 详情抓取前过滤低置信搜索结果，并保留详情页标题参与二次校验
- [x] 19.6 重构播放器为沉浸式视频、底部时间轴和右侧 Clip/来源/诊断分层面板
- [x] 19.7 增加自定义播放控制、Clip 标记、已保存 Clip 定位/循环回看和错误分类提示
- [ ] 19.8 使用真实可公开直链逐条验收线路，并记录 CORS/Referer、HLS、编码、登录、过期分类

**本轮完成门禁**：错误作品不能仅凭集号进入候选；匹配原因可见；播放器不加入弹幕、评论或共同观看；旧站点 CSS 变量和窗口入口保持兼容。

## 20. 2026-09-02 对照修复执行清单

- [x] 20.1 用 Animeko 实测《少女与战车》第 2 集的作品 ID、集 ID、搜索词、线路和最终 MP4 地址
- [x] 20.2 复现当前项目把第 2 集解析为 `TV/03.mp4` 的页面多地址选择错误
- [x] 20.3 增加页面集号与媒体文件集号一致性选择，并为无集号页面保留受限回退
- [x] 20.4 排除 OVA、OAD、剧场版、最终章、特典、总集篇、番外篇和特别篇衍生条目
- [x] 20.5 把 Animeko `channelTiers` 接入候选排序，并继续保留匹配等级/原因可见性
- [x] 20.6 修复 SQLite 初始化索引早于迁移导致旧 `clips` 表启动失败的问题
- [x] 20.7 为 `user_version=0` 遗留库增加结构推断，并避免新版任务表再次触发破坏性清理
- [x] 20.8 运行 SQLite、标题匹配、网页源、快捷播放和中继定向测试
- [ ] 20.9 在用户当前媒体库重新执行 Episode 229 的端到端接口验收；若该库没有该 Episode，先完成一次资料同步

