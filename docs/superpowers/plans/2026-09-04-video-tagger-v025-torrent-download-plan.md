# v0.25 种子源下载 + 候选优选 实施计划

- **日期**：2026-09-04
- **版本**：v0.25.0
- **状态**：设计定稿，本计划为 v1 实施路线（未开工）
- **配套**：`docs/superpowers/specs/2026-09-04-video-tagger-v025-torrent-download-design.md`
- **决策来源**：2026-09-04 grill-me 会话（ADR D1-D8 见主设计 §2）

## 1. 实施目标

把 v0.23 视频源子系统留白的"真下载"补上：三家源（Nyaa 新增 + 蜜柑/dmhy 既有）搜候选 → **无字幕轨 > 字幕分离 > 硬烧** 级联优选（级内清晰度/编码/体积/组）→ qBittorrent 引擎下载 → ffprobe 自动登记 Episode 本地源资产。v1 只做**单集**与**手动触发**；合集包 / BD 升级 / 订阅自动整体挂账 v2。

## 2. 执行原则

- 纯后端 Java + 前端 v023 静态页改动；**不新造播放 UI**，登记后走既有本地源回顾/素材化链路。
- 排序与解析是**纯函数**：先写单测锁行为，再接 UI。
- 引擎层抽象接口先行，qBittorrent 实现可被 Fake 顶替——**自动化测试不真连网/真握手**；真实引擎一次人工验收。
- 降级开关存储落点（D7）与 UI 位置实现前单独确认，不擅自拍。

## 3. 阶段与门禁

### G1 文档与决策（✅ 本计划 + 主设计 = G1 完成）
- v0.25 主设计/主计划落盘；ADR D1-D8 记录（见主设计 §2）；v1/v2 切分与挂账明确。
- 遗留待定项（均已定 2026-09-04）：每番降级开关存储落点 = `media.allow_hardsub` 列（V32 / SQLite v14，见主设计 D7）；Nyaa 分类号已核实（主设计 D3：默认 c=1_0，1_1=AMV 需排除）。

### G2 候选模型 + 排序器（纯函数先行，无 IO）✅（2026-09-04 代码+测试已绿：16 单测）

目标：标题解析 → 候选特征；三态启发式分档；级联 + tiebreak 排序；精判缓存接口。

任务：
1. 标题解析器：从 RSS 标题抽 `group / resolution / codec / episodeNo / 语种线索`（正则，单测矩阵：Raw 组 / 字幕组 / BDrip / 合集包等样例）。
2. 三态启发式：Raw 组白名单 → RAW；字幕组 → SOFT/HARD（靠文件名规则细化：`[外挂]`/`.ass` 并列等）；未知标 `UNKNOWN`。
3. 排序器：D1 级联 + tiebreak 实现；输出带"分档依据来源"（title-parse / file-list / unknown）与排序理由。
4. 精判缓存：接口已建（`TorrentFileListCache`，providerItemId→文件清单）；内存/落库实现随 G4 引擎一起落。
门禁：解析/排序单测全绿（含中文组软字幕=软轨、硬烧=末档、RAW 720p vs 软字幕 1080p 的档位优先于清晰度等断言）。

### G3 Nyaa provider 接入（新增源）✅（2026-09-04 provider+配置+离线 fixture 测试已绿；真机拉取待用户网络）

任务：
1. `NyaaVideoSourceProvider extends AbstractRssVideoSourceProvider`：RSS 搜索 URL 模板 + 分类过滤参数（**分类号实测核对**，见 D3 遗留）。
2. 条目 → 候选特征接入 G2 解析（标题结构化），快照字段沿用 `torrentUrl` 惯例。
3. 蜜柑/dmhy 复用解析链路（同一解析器喂三家）。
4. `application.yml` 配置（含 enabled 开关，沿用既有 provider 惯例）。
门禁：三家源离线 fixture RSS 解析单测 + 隔离副本启动；Nyaa 真实 RSS 拉取一次人工确认分类号可用。

### G4 qBittorrent 引擎接入 ◐（2026-09-04 基础已落：引擎客户端+精判缓存+复核单测绿；真机联调/执行器接线待 qB 环境）

任务：
1. `EngineClient` 接口（`isOnline / addTorrent / pollStatus / listFiles / delete`）+ **Fake 实现**（测试用）+ qBittorrent WebUI 实现（basic auth，配置走 yml/env）。
2. `AbstractRssVideoSourceProvider.planDownload` 由抛错改为：引擎在线 → 真下载计划；离线 → `TORRENT_ENGINE_REQUIRED`（沿用语义）。
3. 精判实现：`listFiles` → `.ass/.srt` 外挂判定 → 写 G2 缓存。
4. Task 队列接入：下载任务状态（提交/进度/完成/失败/取消）映射到既有 Task 语义。
门禁：Fake 引擎全链路单测（提交→轮询→完成→失败路径）；真实 qBittorrent **一次人工验收**（本机装好 WebUI，下一个小种子走通）。

### G5 下载 → 登记闭环（单集）✅（2026-09-04 真机 E2E：qB 下载→移动→指纹登记→资产 AVAILABLE，见 worklog）

任务：
1. 下载完成 → ffprobe 探测（视频轨/时长/编码）→ 按既有资产模型登记为 Episode 本地源资产（文件落 `data/`，`videoFp` 指纹）。
2. 完成校验（复用 verify 语义）；失败/缺集 → 状态标记 + 重试入口（缺集非终态，D7-A）。
3. 候选采纳 → 下载请求携带档位/排序依据（供 UI 展示与后续 v2 升级换源复用）。
门禁：真实小种子端到端（下载→登记→媒体详情"本地源/本地回顾"可见）一次人工验收；失败路径自动回归。

### G6 UI（v023 源管理 + 媒体详情）✅（2026-09-04：allow_hardsub 迁移 + 集行「BT 下载」弹窗 + 候选档位徽标 + 引擎灯，隔离副本真机验收通过）

任务：
1. 候选卡显示：排序徽标（RAW/软字幕/硬烧 · 1080p · x264 · 疑似标识）+ 排序理由/依据来源。
2. 「收新集」手动触发（拉 RSS → 优选 → 采纳下载）；缺集状态与"重试"。
3. 引擎在线灯 + 缺引擎提示（沿用 `TORRENT_ENGINE_REQUIRED` 文案）。
4. 降级开关（D7）UI 与存储落点——**实现前与用户确认**。
门禁：agent-browser 真实浏览器验收候选展示/触发/状态流转；风格与既有面板一致。

### G7 收尾 ✅ 后端/前端/隔离副本端到端（待用户重启 8080 后用真实库做最终 agent-browser 验收 + CHANGELOG）
- CHANGELOG 0.25.0、worklog、rules 无冲突项复查；静态资源同步 target/classes。
- 端到端门禁：真实 qBittorrent 下载一集 → 登记 → 本地回顾可播 →（如已有 clip）素材化可用。
- v2 挂账清单同步回主设计 §7（合集拆集 / BD 升级+clip 重校准 / 订阅自动 / 精判放宽）。

## 4. 测试基建（先行）

1. **解析/排序单测矩阵**：Raw 组、字幕组（软/硬）、BDrip、合集包、多季/SP 等标题样例；档位优先于清晰度、tiebreak 全序断言。
2. **Fake 引擎**：G4 起所有下载链路测试不真连 swarm/不真下种；qBittorrent 真实联调仅人工验收步骤。
3. **人工验收剧本**：① Nyaa 分类号核对（搜一已知番，RAW 候选落在预期分类）；② 真实 qB 下小种子走通 提交→完成→登记；③ agent-browser 过 UI 黄金路径。

## 5. 附录：Nyaa RSS 形态（参考，实现时核对）

- 搜索 RSS：`https://nyaa.si/?page=rss&q={关键字}&c={分类}`；条目含标题/link/enclosure(.torrent)。
- 分类号（2026-09-04 核实）：`1_0` Anime 全部（v1 默认）/ `1_4` Raw / `1_2` English-translated / `1_3` Non-English；`1_1`=AMV 不搜。RSS 的 `c` 为单值 → 多分类需多次请求（v1 不做，用 1_0 + 解析兜底）。
- 蜜柑/dmhy 的 RSS URL 模板沿用 v0.23 既有 provider 配置，不加新约定。
