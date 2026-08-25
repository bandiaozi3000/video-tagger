# v0.20 单媒体高光混剪实施计划

- **日期**：2026-08-24
- **版本**：v0.20.0
- **状态**：可扩展混剪链路完成，待 Web/Electron 人工验收与高级能力演进
- **设计文档**：`docs/superpowers/specs/2026-08-24-video-tagger-v020-highlight-mix-design.md`
- **主计划约定**：本文件是 v0.20 的唯一实施计划。后续同版本范围、设计、实际文件、验收和变更均直接更新本文件，不另建漂移子计划。

## 1. 实施原则

1. v0.20 是 v0.19 的上游工作流，不重写或删除 v0.19 的单片段导出、截图和浏览器录制回退。
2. 先完成本地素材闭环，再加受限 URL 探测/下载和上传；不能为“全部支持”承诺任意网页下载。
3. 项目段保存非破坏性覆盖，永不因制作调整回写原始 Clip 时间。
4. 素材必须在导出前 READY；不可用段必须修复、上传或移除，禁止静默漏片。
5. 数据库双迁移、受控路径、ProcessBuilder 参数数组、临时产物成功后替换和明确错误反馈均为硬约束。
6. 新混剪器独立于现有 RecommendVideoService 的 HTML 截帧渲染器；仅复用视觉配置/资源与任务经验。
7. 所有 UI 遵守现有深色霓虹、毛玻璃、16:9 宽屏工作区、toast/confirm 规范。

## 2. Phase 0：文档与边界（已完成）

- [x] 核对当前推荐导出、媒体详情、Clip 导出和 v0.19 素材能力；
- [x] 进行产品 grilling 并确认高光混剪、分层素材、声音、剧透、时间线、草稿和画幅决策；
- [x] 判定应开 v0.20 而不是迭代进 v0.19；
- [x] 确认 v0.19 浏览器录制回退继续保留；
- [x] 创建唯一 v0.20 主设计文档和本计划。

## 3. Phase 1：项目与时间线数据模型

### 3.1 MySQL / SQLite schema

1. MySQL 新增 `V21__highlight_project.sql`：`highlight_project`、`highlight_project_item`、`highlight_export` 表、外键查询索引。
2. SQLite 新增 `db/migration-sqlite/v03.sql`，语义与 MySQL 相同；更新 `sqlite-schema.sql` 新库基线。
3. 项目、项目段和成片快照使用 JSON 文本存配置/快照；不为每一个视觉参数扩列。
4. 索引至少覆盖 `media_id`、`project_id`、`sort_order`、`status`。

### 3.2 Java 模型与 Mapper

1. 新增 `HighlightProject`、`HighlightProjectItem`、`HighlightExport` 实体及 Mapper。
2. DTO 明确暴露给前端的字段，不把 `source_path` 等本地路径透出。
3. Mapper 所有查询显式按 project/media 限定，删除/更新以 project ID + item ID 双重约束。
4. 增加项目配置 JSON 的安全大小限制与字段归一化。

**测试**：MySQL 迁移 SQL 核对、SQLite 迁移测试、映射/排序/项目隔离测试。

## 4. Phase 2：高光项目服务与媒体入口

1. 新增 `HighlightProjectService`：按媒体获取或创建单一活动草稿，读写项目配置，新增/更新/删除/重排项目段。
2. 从同一媒体下 Clip 创建项目段；默认时间继承 Clip 有效区间，继承失败时创建 PENDING 但明确提示需补终点。
3. 项目段支持非破坏性 `inSec/outSec`、短标题、原声音量、`PENDING/SAFE/SPOILER` 状态。
4. 规则校验：时间合法、段属于项目媒体、排序无重复、状态白名单、JSON/文案长度限制。
5. 补 `HighlightProjectController` 和媒体详情创建/读取入口。
6. 集/媒体/Clip 删除时使关联项目段进入不可用状态，不能悄悄改变历史导出快照。

**测试**：创建恢复、同媒体隔离、排序、非破坏性时间、剧透规则、删除失效。

## 5. Phase 3：素材准备与预览

### 5.1 本地素材

1. 新增 `HighlightSourceService`，专属目录 `data/highlight-projects/{projectId}/sources/`。
2. 优先复用有效片段产物，未命中则安全解析 v0.19 本地视频库并以项目段时间精确裁剪。
3. 准备任务更新 `PENDING/PREPARING/READY/UNAVAILABLE/FAILED`，支持重试和取消。
4. 不接受任意客户端路径；所有输出按项目/item ID 推导，使用临时文件和原子替换。
5. 提供受控单段预览/Range 静态映射。

### 5.2 直链/公开流探测骨架

1. 定义 URL 源类型、拒绝理由和严格 downloader 边界；首期只允许经服务端校验的 HTTP(S) 直链与公开 manifest。
2. DNS/IP 解析拒绝私网、loopback、link-local、multicast/unspecified；重定向逐跳重检、限次数/大小/超时。
3. 不传 Cookie/token，不处理 `blob:`、DRM 或认证流；先返回可理解的 UNAVAILABLE 原因。
4. 上传入口采用 multipart 白名单校验、大小/文件头/ffprobe 基础校验，并写受控目录。

**测试**：本地命中、时间覆盖、临时替换、失败保留、路径越界、URL 协议/IP/重定向拒绝、上传校验。

## 6. Phase 4：ffmpeg 高光混剪与导出快照

1. 新增 `HighlightMixService` 与独立 `highlightExportExecutor` / 任务服务，避免阻塞现有推荐 HTML 导出队列。
2. 导出前预检：项目段、素材 READY、时间合法、剧透过滤、总时长/片段数/磁盘阈值、ffmpeg 工具可用性。
3. 每段标准化为 16:9 H.264/AAC 中间件，保持原画面居中并加模糊背景填充。
4. 生成媒体片头/片尾短视频段，复用推荐视觉语言但不把真实视频放进 Puppeteer 截帧主链。
5. 使用 filter_complex / concat 编排段间淡变、BGM 铺底和原声段 BGM 压低；全程 ProcessBuilder 参数数组。
6. 导出时保存不可变 `snapshot_json`，成功后写入专属 `exports/`；失败/取消保留旧成片。
7. 支持导出任务轮询、取消、产物列表、打开/下载和删除。

**测试**：预检、SAFE/FULL 过滤、快照冻结、命令构建、失败不覆盖、取消、真实短片有/无音频冒烟。

## 7. Phase 5：高光制作工作台

1. 媒体详情为视频媒体新增“制作推荐视频”入口。
2. 新增独立工作台视图：左栏季/集/Clip 素材树，中栏时间线，右栏项目概览与导出设置。
3. 支持选片、状态徽标、准备/重试/上传、拖拽排序、入出点、短标题、剧透、原声开关/音量、移除。
4. 支持单段预览和总时长/空间/导出成本估算；超软阈值走既有毛玻璃确认弹层。
5. 导出面板支持 FULL/SAFE、720P/1080P/4K、BGM 配置和任务状态；未 READY 或 SAFE 为空时给出可操作反馈。
6. 保持 Web/桌面双布局，静态资源同步 target 并更新 cache-bust。

**验证**：Node 语法、浏览器手工黄金路径、窄屏退化、空项目、失败态、草稿恢复、拖拽排序、导出状态。

## 7.1 后续增强：风格包与渲染扩展

1. **Phase A 基础导出修复**：统一有声/无声片段为视频轨 + AAC 双声道音频轨；中间文件按 `exportId/itemId` 隔离；保存导出阶段、场景标识和 ffmpeg 最后错误行。
2. **Phase B 风格编译骨架**：增加受控 Style Pack 解析/默认值/枚举与范围校验、Renderer Registry、能力检查和最小 `ScenePlan`；把风格配置冻结进导出快照。
3. **Phase C 推荐导出复用**：抽取可共享的媒体探测、BGM 处理、卡片视觉和导出工作区；推荐导出继续负责 HTML 视觉卡，高光真实视频不进入浏览器截帧链路。
4. **Phase D 场景渲染**：接入片头/标题卡/片尾卡和 `none/crossfade/fade-black` 基础转场；首期 BGM 采用按场景固定音量策略，后续再做 sidechain ducking。
5. **Phase E 外部风格扩展**：支持声明 Renderer API 版本的受控 HTML/CSS 卡片包；缺必需能力时导出前阻止，禁止任意脚本和 ffmpeg 命令。

**本轮代码任务范围**：历史首批实现已完成；最终版收口计划已归档到本主 plan，后续按 A→B→C→D 连续执行，直到代码门禁通过，再交用户进行 Web/Electron 人工验收。

## 7.2 最终版收口计划（已归档，待继续执行）

### A. 可靠性门禁

- 持久化项目段 `originalVolume`，修复导出取消竞态、短场景转场时长、BGM ducking 正序时间线。
- FFmpeg/Card/source 探测使用可超时的输出 drain；卡片文本严格转义并固定字体策略；直链/BGM READY 前完成可解码校验。
- 按 `exportId/itemId` 清理 normalized/cards/part/source 临时物；导出前校验时长、磁盘和工具能力；失败不覆盖旧成片。

### B. 风格与共享 Renderer

- canonical Style Pack 记录预设/外部包、版本和哈希；未知字段/Renderer/危险脚本在导出前拒绝。
- 从推荐链路只抽取视觉 token、封面安全读取、媒体探测、BGM/临时工作区机制；不复用推荐番剧 HTML、record 状态机或任意模板脚本。
- 内置三套风格和三种转场保持可执行；外部包支持声明式 JSON，HTML/CSS/资源仅在白名单协议内扩展。

### C. 音频与流媒体

- fixed scene ducking 作为默认；sidechain 仅在明确本地原声轨和 FFmpeg 能力满足时启用，参数白名单化，能力不足须显示拒绝/fallback。
- HLS/DASH 仅做安全探测或受控 VOD 解析：逐跳 SSRF、大小/时长/segment/超时限制，拒绝 DRM、密钥、鉴权、动态/直播/无界 manifest；FFmpeg 不直接访问网络。

### D. 测试与发布门禁

- 增加 Export/Card/Source/Project/URL/StylePack 测试与 SQLite 迁移测试，覆盖取消、清理、文本安全、音频模式、流媒体拒绝和能力 fallback。
- 真实 FFmpeg 矩阵覆盖有/无音频、横/竖画幅、none/crossfade/fade-black、fixed/sidechain、旧/新 FFmpeg，并执行最终解码、SAR、PTS、时长检查。
- Web/Electron 黄金路径和打包环境作为用户最终人工验收门禁，未验收不能标记生产封版。


1. 离线 Maven compile 与指定服务/迁移单测；不混跑 Testcontainers IT。
2. 真实短视频验证：本地准备、原声+BGM、不同画幅、取消、失败保留、成片播放。
3. 对 URL 层只验证安全拒绝与公开直链样本；不把未授权的第三方内容下载当作验收项。
4. 回归 v0.19：本地精确导出、单帧、连续截图、浏览器录制回退保持可用。
5. 同步设计文档、计划、工作日志、CHANGELOG、story、项目记忆正文/frontmatter/MEMORY.md。

## 9. 预计文件范围

```text
backend/src/main/java/com/videotagger/entity/Highlight*.java
backend/src/main/java/com/videotagger/mapper/Highlight*.java
backend/src/main/java/com/videotagger/service/Highlight*.java
backend/src/main/java/com/videotagger/controller/Highlight*.java
backend/src/main/java/com/videotagger/config/AsyncConfig.java
backend/src/main/java/com/videotagger/service/{Media,Episode,Clip}Service.java
backend/src/main/resources/db/migration/V21__highlight_project.sql
backend/src/main/resources/db/migration-sqlite/v03.sql
backend/src/main/resources/db/sqlite-schema.sql
backend/src/main/resources/application.yml
backend/src/main/resources/static/{index.html,app.js,app.css}
backend/src/test/java/com/videotagger/...Highlight*Test.java
docs/superpowers/specs/2026-08-24-video-tagger-v020-highlight-mix-design.md
docs/superpowers/plans/2026-08-24-video-tagger-v020-highlight-mix-plan.md
docs/worklog/2026-08-24.md
CHANGELOG.md
docs/story.md
memory/video-tagger-v020-highlight-mix.md
memory/MEMORY.md
```

## 10. 实施结果与验收状态

### 已完成

- Phase 1：MySQL `V21`、SQLite `v03` 与全新 SQLite 基线新增高光项目、项目段、导出快照三表；补充真实 `v03` 迁移回归，覆盖基线先建表的 v2 旧库升级不重复失败。
- Phase 2：项目单媒体唯一草稿、选 Clip、非破坏性入出点/剧透/短标题/原声、排序、草稿配置恢复；Clip、集、媒体永久删除会使关联段不可导出，已删除媒体草稿拒绝再编辑，旧导出快照独立保留。
- Phase 3：本地 Clip 成片仅在区间与项目段一致时复用，否则按项目段精确裁剪；受控直链下载、私网拒绝、上传大小/MIME/扩展名/可解码性校验、失败来源保留、受控单段预览均已接通。
- Phase 4：异步导出读取创建时的不可变快照，支持 FULL/SAFE、720P/1080P/4K、无音轨补静音、原声音量、16:9 完整前景+模糊背景、BGM 混音、取消、原子替换与受控成片读取/删除。
- Phase 5：媒体详情入口、三栏工作台、片段选择/拖拽/修改/准备/上传/直链、BGM 与导出设置草稿恢复、单段预览、导出轮询、取消与删除均已实现；静态资源 cache-bust 已更新。

### 本轮完成（Phase C/D 基础版）

- ScenePlan 已真正执行：片头卡、标题卡、真实片段、转场标记、片尾卡按计划生成并进入最终合成。
- 新增受控 `HighlightCardRenderer`，使用 FFmpeg 生成统一 H.264/AAC 卡片；推荐导出的视觉系统边界保留为后续共享模板抽取点。
- 新增基础场景式 BGM ducking：真实片段区间按配置音量的 20% 播放 BGM，卡片区间恢复用户音量；不做语音识别/sidechain。
- 新版 FFmpeg 支持 `xfade/acrossfade` 时使用真实转场；旧版缺少 `xfade` 时自动使用卡片/concat filter graph fallback，不再直接失败。
- 统一中间片段视频轨→音频轨顺序、`setsar=1`、Windows 相对 concat 路径和 filter graph 重新编码，避免旧 FFmpeg 的盘符、DTS、SAR 和 bitstream 兼容问题。

### 验证结果

- 离线编译、Style Pack/SQLite/高光及 v0.19 定向测试通过；Node 语法和 `git diff --check` 通过。
- 真实隔离短片验证通过：有声/无声片段、卡片、BGM、场景 concat filter graph 和最终 H.264/AAC 解码均成功；本机旧 FFmpeg 自动走 fallback。

### 仍待继续

- 最终版收口计划 A/B/C/D 尚未执行完；当前已有本地混剪闭环和 ScenePlan 骨架。
- Web/Electron 实际工作台点击、真实用户媒体和打包环境仍需人工验收。


## 11. 变更记录

| 日期 | 状态 | 变更 |
|---|---|---|
| 2026-08-25 | Phase A/B 首批完成 | 技术记录精简落盘；修复统一音轨与中间文件隔离；增加导出阶段/场景/ffmpeg 尾日志；新增受控 Style Pack 校验与 ScenePlan 最小编译骨架、MySQL V22/SQLite v04 迁移及测试。 |
