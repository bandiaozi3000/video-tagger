# v0.25 种子源下载 + 候选优选 — 主设计

- **日期**：2026-09-04（grill-me 会话逐项拍板后立项）
- **版本**：v0.25.0
- **状态**：设计定稿，实施按 plan 推进（尚未开工）
- **配套**：`docs/superpowers/plans/2026-09-04-video-tagger-v025-torrent-download-plan.md`
- **决策来源**：2026-09-04 grill-me 会话（对照 v0.23 视频源子系统逐项取证）

## 1. 背景与动机

v0.23 视频源子系统已具备 **RSS 源发现能力**：Mikan（蜜柑）与 AnimeGarden（动漫花园 dmhy）两个 `AbstractRssVideoSourceProvider` 能把站点 RSS 拉成"有哪些版本可选"的候选条目（标题/详情页/`torrentUrl`）。但 RSS 只有元数据——`planDownload` 目前抛 `TORRENT_ENGINE_REQUIRED`（"Torrent download engine is not installed"），**真下载闭环是故意留白的**。

用户的素材库场景（剪辑/产出，画面干净优先）需要：**从 Nyaa / 蜜柑 / 动漫花园下载集级资源，并按「无字幕 → 字幕分离 → 清晰度」的偏好从候选里挑版本**。v0.25 填的就是这两块空缺：BT 下载引擎接入 + 候选排序策略。

## 2. 架构决策记录（ADR）

### D1 候选排序模型：字幕三态级联 + 级内 tiebreak
- 版本分三档（**级联**，按顺序取第一档有候选者）：
  1. **RAW**：完全无字幕轨（画面最干净，剪辑首选）
  2. **字幕分离**：软字幕（mkv 内封可关字幕轨，或外挂 `.ass/.srt` 文件）——画面不被烧录
  3. **硬烧内嵌**：字幕组烧进画面的版本（最后兜底档）
- **级内 tiebreak**：清晰度 → 编码（**x264 优先于 HEVC**，素材导出链路省事）→ 体积小 → 组信誉。
- **字幕语言不参与排序**（素材模式只看 无轨/软轨/硬烧 三态；中文组软字幕与英字软字幕等权）。
- 候选特征来自 **RSS 标题解析 + 组语义启发式**（Raw 组白名单＝默认无轨；字幕组＝软/硬）。启发式只能给"疑似档"，胜负难分时用 D4 精判。

### D2 精判：swarm 文件清单抽查（top N=2，缓存 7 天）
- 只对**启发式分档结果会决定胜负的 top 2 候选**，经 qBittorrent 连 swarm 拉**种子文件清单**（不下完即可拿）。
- 判定规则：清单含 `.ass/.srt` 外挂 → 确认为"字幕分离"；纯 `.mkv/.mp4` → 维持启发式档（**内封轨需下载后 ffprobe 才能确认**，属已知局限，记入候选"疑似"标记）。
- 清单结果按候选身份缓存 7 天，避免重复握手。

### D3 站点策略：Nyaa 新增 + 蜜柑/dmhy 既有，Anime Tosho 排除
- **Nyaa（新增 provider，主源）**：RAW / 国际组资源最全；RSS 搜索 + 分类过滤。分类号已核实（2026-09-04）：`1_0` Anime 全部 / `1_4` Raw / `1_2` English-translated / `1_3` Non-English（含中文翻译）；`1_1` 实为 AMV（老印象“1_1=中文”是错的）。v1 默认搜 `1_0`（RSS 的 c 参数单值），AMV/无关噪音由解析器以“无集号且非合集”兜底丢弃；English-translated（1_2）多为软字幕版，正好补 tier2。Nyaa 直连常需代理 → base-url/模板做成可配镜像（本机实测直连超时）。
- **Mikan / dmhy（既有 provider，兜底）**：中文字幕组资源，配合 D1 级联正好互补（无字幕缺位时提供 软/硬 字幕版本）。
- **Anime Tosho 排除**：2026-05 停更冻结，纳入无意义。
- 加站成本 ≈ 新增 provider 子类 + 配 URL 模板（v0.23 已证明）；难点在标题解析与排序，不在接站。

### D4 采纳规则（全局一条）：有 BD 全集直接终局，否则当期 Web 单集
- 候选来源里出现 **BD 全集包 → 直接采纳为终局**（不重复下 Web）。
- **没有 BD → 收当期 Web 单集即时追**；日后 BD 全集出现再升级（升级机制在 v2，见 §7 挂账）。
- 补老番自然走"有 BD 就吃 BD"分支，无需特判。
- v1 **只做单集候选**；合集包（MULTI_EPISODE）标灰排除（v2 拆集）。

### D5 引擎与拓扑：本机 qBittorrent WebUI RPC
- 工具 ⇄ qBittorrent（本机）走 WebUI RPC：提交 `.torrent` 文件 / 磁力 → 轮询进度 → 下载完成。
- **缺引擎**：沿用 `TORRENT_ENGINE_REQUIRED` 提示语义（UI 标红，装好重试），不退回"出磁力清单手抄"。
- 精判（D2）与下载复用**同一个引擎会话**；文件清单即种子文件列表 API。
- 上传/保种策略由 qBittorrent 自身管理，工具不强改、不做保种调度。

### D6 落地与登记：自动注册 Episode 本地源资产
- 下载完成 → **ffprobe 探测**（视频轨 + 轨道元数据）→ 登记为该 Episode 的**本地源资产**（文件落 `data/` 统一目录，走既有 Asset/播放/本地回顾/剪辑素材化通道）。
- 沿用 v0.19 的 `videoFp` 指纹与既有 VideoDownloadService（断点/校验）语义；不新造播放 UI。
- 字幕文件（外挂）随包落地为相邻文件即可；**不做字幕资产登记**（素材模式不消费字幕轨，见 D1）。

### D7 降级策略（可配，默认宁缺毋滥）
- **默认 A**：候选不足时不降级收硬烧版 → 该集标记"缺集"。**缺集不是终态**：追番期每次轮询/手动重试，直到 RAW/软字幕/BD 出现。
- **可每番开 B**：允许收硬烧版兜底。
- 存储落点（已定 2026-09-04）：`media` 新列 `allow_hardsub`（布尔，默认 0=宁缺毋滥；1=该番允许硬烧兜底）——双库同步：Flyway V32 + SQLite v14 + `sqlite-schema.sql` 基线 + `SqliteSchemaMigratorTest` 版本断言。UI 落点：媒体详情“下载设置”区（随 G6 落地），全局默认走配置常量。

### D8 触发：v1 手动，v2 订阅自动
- v1：UI 手动触发（媒体详情/源管理"收新集"→ 拉 RSS → 级联优选 → 采纳下载）。
- v2：订阅自动（打"追"标记 → 后台轮询 RSS 新集自动收 + BD 出现自动升级），涉及任务调度与重试，不塞进 v1。

## 3. 候选模型与排序契约（草案）

```
Candidate { providerId, itemId, revision, title, episodeNo,
            group, resolution(1080p/720p/...), codec(x264/HEVC/...),
            subTier(RAW|SOFT|HARD|UNKNOWN), bytes?, torrentUrl/magnet }
排序 = sort by (subTier asc) then (resolution desc) then (codec: x264 前)
      then (bytes asc) then (groupRank desc)
精判钩子：当 top2 的 subTier 为 UNKNOWN/疑似 且档位决定胜负 → 引擎文件清单核实
```

- 档位字段来源标注：`title-parse`（启发式）/ `file-list`（精判确认）/ `unknown`。
- 候选采纳后进入既有下载请求：`providerItemId + revision + 档位记录` 落 Task；排序结果**不落库**（每次搜索现算，精判结果缓存除外）。

## 4. 引擎接口契约（与 v0.23 对接点）

- `AbstractRssVideoSourceProvider.planDownload`：由抛错改为返回**真下载计划**（引擎可用时）；引擎缺失仍抛 `TORRENT_ENGINE_REQUIRED`。
- 新增引擎适配层（EngineClient）：`addTorrent(url|magnet)` / `pollStatus(id)` / `listFiles(id)`（精判用）/ `delete(id, deleteFiles)` / `isOnline()`。
- 下载任务复用现有 Task 队列语义（`DOWNLOAD_EPISODE` 等枚举已存在）；完成校验走既有 verify/资产状态。
- `resolve/probe`（播放解析）对 RSS 源维持 `PLAYBACK_UNSUPPORTED`：RSS 源只喂下载，不喂在线播放。

## 5. 数据与配置

- `application.yml`（可被 env 覆盖）：qBittorrent WebUI（base-url / 用户名 / 密码）、Nyaa provider（RSS 搜索 URL 模板 / 分类过滤 / timeout / max-results）、排序默认常量。
- 蜜柑/dmhy provider 既有配置复用，无需改动数据模型。
- 每番降级开关存储：**待实现前确认落点**（§D7）。

## 6. 边界与安全

- 只做"拉取合法来源、用户自担合规"的资源管理闭环；不绕过任何站的登录/付费/DRM。
- 站点 RSS 偶发 502/证书异常：沿用 provider 现有失败语义（源标红、不崩溃）。
- 标题解析与启发式是**启发而非保证**：档位可能误判，UI 展示"疑似"标识 + 精判依据，用户可手动改选。
- UI 遵循现有霓虹毛玻璃风格与交互规范；候选卡排序徽标与现有 tag-pool/资产面板风格一致。

## 7. v1 / v2 切分与挂账

**v1（本版本范围）**：Nyaa provider 新增 + 候选解析与级联排序 + 启发式粗筛 + top2 精判 + qBittorrent 引擎接入 + **单集**下载闭环 + ffprobe 自动登记 + 手动触发 UI + 降级/精判配置开关。

**v2 挂账（不入 v1）**：
- 合集包（MULTI_EPISODE）拆集：种子内文件清单 → 逐集映射登记（复用 D2 同一文件清单基建）
- BD 全集出现后的**升级替换**（换源 + 删旧 Web 文件默认自动）；**升级后既有 clip 时间轴重校准**（走现成 `CALIBRATE` / time-mapping 基建）
- 订阅自动追番（轮询 RSS 收新集 / 盯 BD）
- 精判 top N 放宽、内封轨下载后 ffprobe 复核档位
