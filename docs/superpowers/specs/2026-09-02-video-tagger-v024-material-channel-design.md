# v0.24 素材渠道化 + Animeko 互操作 — 主设计

- **日期**：2026-09-02（grill-me 会话逐项拍板后立项）
- **版本**：v0.24.0
- **状态**：设计定稿，实施按 plan 推进
- **配套**：`docs/superpowers/plans/2026-09-02-video-tagger-v024-material-channel-plan.md`
- **决策来源**：2026-09-02 grill-me 会话（对照 Animeko 源码逐项取证）

## 1. 背景与动机

video-tagger 的安身立命是**打标签 + 自然语言检索 + 回顾**；v0.23 自建的远程片源/播放子系统（Provider/QuickPlay/工作台）长期面对三个痛点：交互繁琐、源配置简陋、集号匹配不准（Animeko 对照修复即为缩影）。对照 Animeko（追番平台，源解析/匹配/播放成熟）后拍板：**播放前台移交 Animeko，video-tagger 专注"打标 + 片段资产 + 素材产出"**，通过互操作把 Animeko 的观看事实与本地文件回流成本项目资产。

## 2. 架构决策记录（ADR）

### D1 播放职能分层：Animeko 是可替换渠道，不是心脏
- video-tagger 资产（标签/片段/备注/成片）全部自持；对 Animeko 只有**两层薄依赖**：① 只读其本地 SQLite（playhead/已看/缓存 registry），② 定位其本地缓存/下载文件。
- Animeko 停更 → 失去"源解析 + 播放前台"（非核心），资产无损；v0.23 web-selector 代码**冻结为 B 计划兜底**（不删不维护）。
- v0.23 的**引擎层复用**为新渠道内核：VideoDownloadService（断点/校验）、VideoAsset/Clip 资产模型、受控中继、素材化/时间映射。

### D2 素材层与渠道解耦：Clip 引用 + 渠道线索
- Clip/素材 = `(媒体, 集, 入点, 出点) + 渠道线索[]`。
- 素材化管线按渠道优先级找"这集视频文件"，找到即 ffmpeg 剪出产物：
  - **C1 本地文件池**：`data/videos` + `videoFp` 指纹（v0.19 既有约定 + 精确裁剪）
  - **C2 Animeko**：`episodeId(Bangumi) → 本地缓存/文件`（Animeko registry；缺文件可由 fork CLI 批量预取，见 D7）
  - **C3 网页直链**：受限 URL + Referer/UA 中继 + 断点下载任务（v0.23 引擎）
  - **C4 录屏回退**：`getDisplayMedia`（低精度兜底）
  - 全无 → 只保留时间码引用，产物标记"缺素材"。
- **新老数据兼容**：老库 Clip 无渠道线索 → 走 C1/C3/C4，老库不迁移不重标；Animeko 新标带 C2 线索；未来其他播放器 = 新增适配器，模型与管线不动。

### D3 打标现场 = 暂停 + 全局热键 + playhead 读
- 源码取证（`RememberPlayProgressExtension`）：Animeko **暂停即落盘** playhead（`Ready && !playWhenReady` → 即时 save）；播放中每 60s 周期写；退出/切集/播完也写。
- 读侧注意：暂停→落盘存在几百 ms 异步窗口 → 热键处理器 sleep 300~500ms 或读两次取 `updatedAtMillis` 更大者。
- Animeko 无外部深链/API（main args 仅测试任务）→ **不做跳转 Animeko**；详情页"打开原视频"重构为本地文件区间回顾播放（C1/C2），缺失时回退原网页。

### D4 素材获取：即看即产优先，批量预取可选
- 主链路：看片时（BT 自动缓存整集已取证 `CacheOnBtPlayExtension`）→ 暂停打标 → 文件在场 → **当场剪出片段**；事后不再需要整集文件。
- "很久以前看过的集补剪"（缓存已被 Animeko 按留存清理）为低频场景 → 见 D7。
- Animeko `自动缓存`设置=播放缓存（仅 BT、会按 maxCount/mostRecent 修剪）≠ 存档；**显式缓存**（逐集按钮/`autoCached=false`）才持久 → 需要文件保证时走显式缓存路径。

### D5 版本与存量策略
- v0.22/v0.23 已提交封存（2026-09-02，5 个版本提交）。v0.24 在基线上立项。
- v0.23 处理=渐进归位：引擎复用 → 播放/片源 UI 冻结并从主入口隐藏 → 新链路验收稳定后按模块清理。**不做大爆炸重写。**

### D6 互操作验收模型：契约驱动 + 一次人工校准
- Animeko DB/文件读取隔离成 adapter；agent 自测用 **fixture（真实 DB 隔离副本）** 覆盖 video-tagger 侧全链路。
- 唯一需用户出手：一次真实 Animeko 播放 → 暂停 → dump 落盘格式比对 → 契约锁定；其后回归全自动。
- 端到端门禁（09-02 遗留：资料同步后复测快捷播放）并入 v0.24 验收。

### D7 Animeko fork CLI（可选加速器，非必须）
- 需要"按集号批量预取持久文件"时：在 Animeko 现成 `--test-task` 机制上加 `batch-cache --subject <id> --eps <list>`，进程内复用 `EpisodeCacheRequester`（显式缓存），落盘退出。patch <100 行，本地自用 AGPL 无问题。骨架见 plan 附录。
- 不用 UI 自动化点 Animeko（Compose 自绘窗口，UIA/坐标点击均不可靠）。

## 3. 数据契约（Animeko 侧只读快照）

桌面端 `ani_room_database_main.db`（Room SQLite，data 目录下）。M1 用到：
- `playback_history_record`：`episodeId INT PK`（Bangumi episode id）、`subjectId`、`positionMillis`、`durationMillis`、`updatedAtMillis`、`deletedAtMillis NULL`
- `episode_collection`：`episodeId PK`、`subjectId`、`episodeType`、`sort`、观看状态（M2 跟进）

桥键：**Bangumi subjectId/episodeId** ↔ video-tagger `external_work(provider='BANGUMI', external_id=subjectId)` → `external_episode.provider_episode_id=episodeId` → `episode_id`（本地 Episode）。

## 4. 边界与安全

- 不 fork Animeko 播放内核、不注入其 UI、不写其 DB（只读）；外部触发仅可选 fork CLI。
- 不绕过登录/付费/地区/DRM；防盗链直链经既有受控中继。
- 素材化渠道 C3/C4 遵循既有受控下载与录屏策略。
- UI 遵循现有霓虹毛玻璃风格与交互规范（规则 10/12），借鉴 Animeko 只取功能结构。
