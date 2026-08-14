# 技术文档（按日记录）

> 本清单沉淀**技术方案 / 技术复盘**（功能强技术弱业务的场景，如渲染管线、向量检索、异步任务等），按日期每日记录：每日一段、往底部追加，顶部有目录索引可快速定位日期。
>
> **机制**：
> - **目录**：`docs/learn/` 下通用命名单文件，按日期分组。
> - **记录内容**：**业务场景 / 痛点 / 怎么解决 / 原理 / 涉及技术** 等必要信息。
> - **触发方式**：牵扯**特定技术**的、或**偏技术需求**的场景 → 先问用户「要不要记技术文档」；拿捏不准也问；**先问再写，不擅自创建**。
> - **归档合并**：旧复盘内容重叠时，可合并提炼到最新日期段并删除旧件。
>
> 相邻文档：问题清单（bug）→ `docs/testing/issues.md`；功能需求 → `docs/testing/feature-requests.md`；疑问与解答 → `docs/testing/test-qa.md`。

## 目录（按日期）

- [2026-08-10](#2026-08-10)
- [2026-08-13](#2026-08-13)

---

## 记录模板（新内容按此追加）

```
### 一句话标题
- **日期**：YYYY-MM-DD
- **业务场景**：xxx
- **痛点**：xxx
- **怎么解决**：xxx（根因→修复）
- **原理**：xxx
- **涉及技术**：xxx
```

---

## 2026-08-10

### 向量检索排障与阈值校准

- **日期**：2026-08-10
- **业务场景**：本地私有视频打标工具，媒体/集/片段三层向量化，语义搜索 = MySQL 关键词(ngram) + Milvus 向量(Embedding + 余弦) + RRF 融合（`1/(60+rank)` 名次分）。检索链路：`SearchService → RrfFusion → MilvusVectorStore.doSearch(ANN topK)`。
- **痛点**：
  1. 向量层启动即废：`upsert 失败 NumberFormatException: "C:28"`（CLIP/ANIME/EPISODE 同理）、`LoadCollectionRequest failed, index not found`。
  2. 语义搜索"形同虚设"：乱敲 `zxcvbnmasdfghjkl` 仍返回片段，score 0.016（RRF 名次分，不反映相关性）。
  3. 加阈值后仍挡不住乱搜：`MIN_COSINE_SCORE=0.2` 形同虚设，乱码查询 cosine 全在 0.24~0.30 越线放行。
- **怎么解决**（根因 4 个逐一对应）：
  | 根因 | 说明 | 修复 |
  |---|---|---|
  | ① schema 版本错位 | 存量 collection `clip_embeddings` 是 Int64 主键，新代码期望 VarChar 组合主键 `entity_type:entity_id`；`ensureCollection` 见集合存在就跳过重建 | **换新库名 `clip_embeddings_v2`**（非破坏性），组合主键 `A:5/E:2/C:3` |
  | ② 生命周期不完整 | 只建 collection，未建索引 + load | `ensureCollection` 补全 `createCollection → createIndex → loadCollection`，search 前必须 load |
  | ③ 无相似度阈值 | Milvus 对任意查询都返回 topK，阈值须应用层把关 | `doSearch` 加 `if (score < minCosine) continue` 过滤 |
  | ④ 向量覆盖少 + 缺失 | 集合仅几条向量"什么都最近"；upsert 吞异常 → 任务误标 DONE → 向量静默缺失，sweep 只扫 PENDING 补不上 | SQL 手工把缺失任务复位 PENDING 补嵌；**原则：写入成功才置 DONE / 启动对账** |

  **阈值校准（0.2 → 0.45 配置化）**：排查链——读码确认阈值在 → 进程时间戳排除旧 class → docker 直查确认 MySQL 关键词路干净 → **决定性证据**：node 调 embedding 生成乱码真实向量直连 Milvus ANN，cosine 全 0.24~0.30 越线 → 是 **0.2 定太低**，非逻辑问题。实测 text-embedding-v4 分布：相关 top1 ≥0.545，无关/乱码 ≤0.432，**分界 ≈0.45**。修复：`MilvusProperties.minCosineScore` 默认 0.45f + `application.yml` `${MIN_COSINE_SCORE:0.45}` 环境变量可覆盖，删硬编码常量；改后需**重启 Spring Boot**（JVM 不热更类）。
- **原理**（Milvus 知识点）：
  - 单 collection 三层共享：VarChar 组合主键 `entity_type:entity_id` + 标量字段 `entity_type` 做层过滤，一次 ANN 跨层召回。
  - COSINE 指标：返回 distance 即余弦相似度（越高越相关 ≈[-1,1]）；随机/无关 ≈0。
  - 生命周期铁律：`createCollection → createIndex → loadCollection → search`，顺序缺一不可。
  - Milvus 对任何查询都返回 topK —— 相似度阈值必须应用层把关。
  - REST API 免 SDK 探测：`curl POST localhost:19530/v2/vectordb/collections/describe` / `entities/search`。
  - 随机向量 ≠ 真实 embedding：真实 embedding 无关文本 cosine 有模型 baseline（v4 约 0.2~0.4），用随机向量 0.0079 测区分度会严重低估，**固定阈值必须按模型实测校准**。
- **涉及技术**：Spring Boot 3.3.4 / MyBatis / Milvus 2.4（COSINE + VarChar 组合主键）/ text-embedding-v4 / RRF 融合 / Docker Compose（milvus+etcd+minio）。

### 片段媒体识别（归一化 + 相似度 + URL 指纹）【持续更新：本场景后续迭代在此段追加】

- **日期**：2026-08-10
- **业务场景**：浏览器扩展打标签保存片段（`POST /api/clips`），需判断片段是否属于**已有媒体**（库里已存在则不新建、归入已有），避免重复建档 + 每次手动合并。触发场景：库里已有「我爱你BABY」，打标解析到「爱你宝贝」——中英混写 + 词序/虚词差异导致纯包含匹配认不出。
- **痛点**：
  1. 标题匹配用**纯 LIKE 包含**（`title LIKE %q%`）——「爱你宝贝」对「我爱你BABY」不包含、词序不同 → 匹配不上 → 无法识别已存在 → 每次手动合并。
  2. 保存时**未按 URL 判断**：`ensureEpisode` 虽用 `videoFp` 复用已有集，但 `ensureMedia` 先按标题新建了媒体 → 同视频可能重复建档、集挂错媒体。
- **怎么解决**（两层，都是**纯 Java 应用层**，不依赖 MySQL 特殊能力/向量库）：

  **① 候选匹配（归一化 + 相似度）**
  - 新增 `util/MediaTitleNormalizer`，两步：
    - **归一化 `normalize()`**（消除结构性差异）：`toLowerCase` → 去括号内容 `[（(][^（()）]*[)）]` → 去标点空格 `[\s·,，。.!！?？:：;；'"“”‘’\-—_/\\|]` → **中英等价** `(?i)baby→宝贝`（可扩展表：剧场版/ova 等后缀删）→ **去单字虚词** `[我的之你和与及于在对于们]`（保留核心名词/动词）。
    - **相似度 `similarity()`**（优先级）：
      ```
      归一化相等                     → 1.0
      一方包含另一方（na.contains(nb) 或反向） → 0.9
      Levenshtein 编辑距离 ≤ 3      → 0.85 - 距离×0.15
      否则                           → 0
      ```
      候选阈值 **≥ 0.6**。
  - 例：「我爱你BABY」归一化 →（去「我」+ baby→宝贝）→「爱你宝贝」；「爱你宝贝」→「爱你宝贝」→ 相等 → **1.0**。
  - `MediaService.matchCandidates(title, limit)`：MyBatis-Plus `selectList`（`isNull(deleted_at)`）把全库媒体标题拉到 Java → 逐个算相似度 → ≥0.6 收集 → 按相似度降序 → 取前 limit。返回 `MediaMatchCandidate(id,title,year,subcategory,clipCount,score)`。
  - 接口 `GET /api/media/match?title=&limit=`（MediaController）。扩展 `content.js` 候选区改用该接口，**提示候选、用户勾选才归入**（`candMediaId` 初始 null，不自动归入）。

  **② URL 指纹归入**
  - `ClipService.save` 媒体归属顺序改为：**用户勾选 `mediaId` > URL `videoFp` 命中已有集的 `mediaId` > 标题匹配新建**：
    ```java
    Long preferMediaId = req.mediaId();
    if (preferMediaId == null) {
        Episode urlEp = episodeMapper.selectByFp(VideoFingerprint.fingerprint(req.url()));
        if (urlEp != null) preferMediaId = urlEp.getMediaId();
    }
    Media media = ensureMedia(parsed, detectFormat(req.url()), now, preferMediaId);
    ```
    同 URL（同视频）永远归同一媒体，不重复建档。

- **原理**：① 归一化在 Java 层消除「虚词 / 中英混写 / 词序」这类**结构性差异**（直接拉平成相等）；Levenshtein 编辑距离兜底「打错字 / 差一两个字」这类**轻微差异**（最少插入/删除/替换次数衡量）。② `videoFp` 是视频 URL 的唯一指纹（`util/VideoFingerprint`），同 URL 物理上是同一视频，应归同一媒体。
- **技术选型（为什么纯 Java，不用 MySQL/Milvus）**：
  - MySQL `LIKE`/全文：只会包含匹配，做不了归一化和编辑距离（「BABY→宝贝」「去虚词」SQL 干不了）。
  - Milvus 向量：语义检索太重，标题匹配用不上向量，且依赖 embedding 服务在线。
  - 好处：纯 Java **可单测 / 规则可扩展（等价表/虚词表改 Java 即可）/ 不绑数据库**。
  - 代价：候选池全量拉 title（5615 部）到内存算，title 串小 + 打标签低频，可接受；量大可先用 `LIKE` 粗筛缩小候选池再精算。
- **Levenshtein 编辑距离（动态规划）**：`dp[i][j]` = 把 `a[0..i]` 变 `b[0..j]` 的最少操作（插入/删除/替换各计 1）；滚动数组省内存。例「爱你宝贝」→「爱你贝贝」：替换「宝→贝」= 距离 1 → 相似度 0.7。
- **涉及技术**：Java 归一化 / Levenshtein 动态规划、`videoFp` 指纹、MyBatis-Plus、Chrome 扩展（content.js 候选确认）、Spring Boot。
- **文件位置**：`util/MediaTitleNormalizer.java`、`service/MediaMatchCandidate.java`、`service/MediaService.matchCandidates`、`controller/MediaController`（`/match`）、`service/ClipService.save`（URL 归入）。
- **后续迭代约定**：本场景（媒体识别）后续有调整/优化，**在此段追加**，不另开新段。

---

## 2026-08-13

### Chapter 推荐视频导出：多 BGM 场景的时长漂移分析与音画解耦方案

- **日期**：2026-08-13
- **业务场景**：推荐向导使用 `chapter` 模板生成带章节转场、媒体详情、结尾回顾墙和 BGM 进度条的推荐视频。普通页面预览由浏览器直接播放自包含 HTML；视频导出由 `RecommendService` 生成录制 HTML，`render.js` 使用 Headless Chrome + CDP Screencast 抓取页面帧，再由 FFmpeg 编码视频并混入 BGM。本次只分析和规划 `recommend-chapter.html`，`stream` / `overview` 暂不处理。
- **问题现象**：
  1. 相同媒体、相同时长参数下，带 BGM 的导出视频比无 BGM 的导出视频播放节奏慢，且不是单纯在结尾多停留。
  2. 一首 BGM 时延迟较轻；三首 BGM 时差异显著，可出现接近数分钟的累计偏差。
  3. 进一步逐段对比发现：每播放完一首歌，带 BGM 成片相对无 BGM 成片可累计落后约 **20 秒**。这更像持续性的速率漂移或逐曲阻塞累积，而不是单次起点偏移。
  4. 产品逻辑仍要求“视觉内容结束后，当前歌曲播放完再结束整个视频”；这里的“歌曲播放完再收尾”指**最终视频结束点对齐当前曲目结尾**，不能简单删除该需求来掩盖问题。

- **现有导出链路**：
  ```text
  前端选择媒体 + BGM 文件
        │
        ├─ BGM 以 base64 放入 POST /api/recommend/video
        ▼
  RecommendController
        ├─ base64 解码为临时音频文件
        └─ 创建异步导出任务
        ▼
  RecommendVideoService
        ├─ RecommendService.buildHtml：生成包含封面和 BGM base64 的自包含 HTML
        ├─ ffprobe/ffmpeg：探测每首 BGM 时长
        ├─ 多曲使用 FFmpeg concat 拼成 bgm-concat.m4a
        └─ 调用 node render.js --html ... --bgm ...
        ▼
  render.js
        ├─ Page.startScreencast 抓取 Chapter 页面 JPEG 帧
        ├─ 等待页面 data-tour-ended=1
        └─ FFmpeg：JPEG 序列 + 循环 BGM → MP4/WebM
  ```

- **排查过程与推理**：

  **① 首先排除“多曲拼接本身让成片变慢”**
  - 多首 BGM 的 concat 在页面录制之前同步完成：输入音频统一 `aresample=44100`、`aformat=channel_layouts=stereo`，再用 `concat=n=N:v=0:a=1` 输出 `bgm-concat.m4a`。
  - 这一步可能增加导出任务的等待时间，但发生在 Chrome 抓帧前，不会直接增加最终视频播放时长。

  **② 区分起点偏移与速率漂移**
  - 当前 `render.js` 已通过 `recordStartMs`、首帧页面时钟和 FFmpeg `adelay` 处理音频起点偏移。
  - `adelay` 只能把音频整体前后移动，无法解释“每播完一首累计落后约 20 秒”的长期增长。
  - 项目工作日志 `docs/worklog/2026-08-12.md` 已记录：短视频基本正常，长视频逐渐漂移，属于速率差而非单纯起点差。

  **③ 发现录制页面存在冗余的真实音频加载**
  - 视频最终音轨实际由 FFmpeg 从临时 BGM 文件混入；Headless Chrome 无需播放真实音频。
  - 但 `RecommendService.buildBgmTracksJson()` 仍把每首 BGM 完整注入录制 HTML：
    ```javascript
    const BGM_TRACKS = [
      { name: 'song-1.mp3', src: 'data:audio/mpeg;base64,...' },
      { name: 'song-2.mp3', src: 'data:audio/mpeg;base64,...' },
      { name: 'song-3.mp3', src: 'data:audio/mpeg;base64,...' }
    ];
    ```
  - 单首文件允许 ≤50MB，总 base64 允许 ≤100MB；录制 HTML 可能因此非常大，增加文件读取、HTML/JS 解析、V8 内存和 GC 压力。
  - `chapter` 录制模式虽然不调用 `audio.play()`，但 `loadTrack(false)` 仍执行：
    ```javascript
    bgmAudio.src = t.src;
    bgmAudio.load();
    ```
  - 每次模拟切歌都会再次切换大型 Data URI 并让 Chrome 建立媒体解析/解码管线，而最终声音根本不使用该 `<audio>`，属于重复且高成本的工作。

  **④ 逐曲阻塞如何变成“整段视频越来越慢”**
  - `chapter` 自动导览依赖 `setTimeout`、`setInterval`、`requestAnimationFrame` 和滚动动画；大型音频 Data URI 的解析、媒体加载或 GC 若阻塞页面主线程，会让这些计时器延迟执行。
  - 假设每次换曲造成约 20 秒阻塞，三首歌可累计约 60 秒的页面墙钟延迟；再叠加“当前歌曲播放完再结束”的正常尾部等待，总差异可能扩大到数分钟。
  - `render.js` 当前不保存每帧独立间隔，而是用全部帧数量和首尾墙钟跨度计算一个平均 FPS：
    ```javascript
    const fps = frameCount / (lastTs - firstTs);
    ```
  - 如果局部切歌发生长时间阻塞，`lastTs - firstTs` 增大而有效动画帧未同比增加，计算出的平均 FPS 降低。FFmpeg 再按这个较低 FPS 播放全部图片序列，就会把原本集中在换歌点的停顿**平均摊到整段视频**，最终观看感受是全程略慢、越往后累计偏差越大，而不一定能看到清晰的单点卡顿。

  **⑤ “歌曲播完再结束”是另一条独立逻辑**
  - `chapter.finishAuto()` 在录制模式下调用 `window.__bgmRemainSec()`，视觉导览完成后等待当前曲目剩余时间，再设置 `data-tour-ended=1`。
  - 该逻辑会让视频结尾定格到当前歌曲结束，是明确的产品需求，应保留。
  - 但它只决定最终尾部等待，不应导致正文动画每首累计慢约 20 秒。排查和修复必须把“正常尾部对齐”和“异常速率漂移”分开处理。

- **当前结论分级**：

  | 级别 | 结论 |
  |---|---|
  | 已确认事实 | 录制 HTML 内嵌完整 BGM base64；录制模式仍执行 `audio.src` + `audio.load()`；最终音轨同时又由 FFmpeg 独立混入，存在重复音频处理。 |
  | 已确认事实 | `render.js` 使用首尾时间跨度计算单一平均 FPS；局部停顿会影响整段输出速度。 |
  | 已确认事实 | “当前歌曲播放完再结束”通过 `__bgmRemainSec()` 延迟 `tourEnded`，它解释尾部停留，但不足以单独解释正文逐曲累计变慢。 |
  | 高概率推断 | 每次录制页面切换大型 Base64 音频触发媒体解析/GC/主线程阻塞，使 Chapter 导览定时器逐曲延迟。 |
  | 高概率推断 | 平均 FPS 编码进一步把局部阻塞摊到整段，形成持续速率漂移的观看感受。 |
  | 待实测确认 | 每首约 20 秒是否准确发生在 `audio.load()`/换曲边界；需增加分段墙钟日志和有无 `audio.load()` 的 A/B 导出验证。 |

- **拟采用解决方案：视频渲染与 BGM 音轨彻底解耦**

  **目标架构**：
  ```text
  ① Chapter 页面 ──渲染──> 带 BGM 曲名/进度条的静音视频
  ② 原始 BGM ──标准化/拼接──> 独立 BGM 音轨
  ③ 静音视频 + BGM 音轨 ──无损混流──> 最终完整视频
  ```

  **阶段 1：只渲染带进度条的静音视频**
  - 录制版 `chapter` HTML 只注入曲名和曲长：
    ```javascript
    const BGM_TRACKS = [
      { name: 'song-1.mp3' },
      { name: 'song-2.mp3' },
      { name: 'song-3.mp3' }
    ];
    const BGM_TRACK_DURS = [245.32, 287.64, 263.18];
    ```
  - 不注入 BGM Base64，不设置 `<audio>.src`，不调用 `<audio>.load()` / `<audio>.play()`。
  - BGM 条的曲名、当前时间、总时间、进度和“即将播放下一首”全部由 `performance.now()` + `BGM_TRACK_DURS` 推算。
  - `render.js` 只负责页面抓帧和静音视频编码，FFmpeg 明确使用 `-an`，不接收 `--bgm`。

  **阶段 2：独立准备 BGM 音轨**
  - 单曲：可直接作为待混入音轨，必要时先统一采样率和声道。
  - 多曲：沿用当前 FFmpeg concat 逻辑，统一为 44100Hz、stereo，输出 `bgm-playlist.m4a`。
  - 继续使用 `ffprobe`/`ffmpeg -i` 探测每首真实时长，曲长同时用于页面进度条和最终结束点计算。

  **阶段 3：静音视频与 BGM 最终混流**
  - MP4 示例：
    ```powershell
    ffmpeg -i silent-video.mp4 -stream_loop -1 -i bgm-playlist.m4a `
      -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest final-video.mp4
    ```
  - `-c:v copy`：不重新编码视频，不改变帧率/视频时间戳，不产生二次画质损失，也避免“加入音频后画面速度发生变化”。
  - BGM 输入循环以保证长度足够；最终以静音视频时长为硬边界，`-shortest` 只负责裁掉超出的循环音频。
  - WebM 对应使用 `-c:v copy -c:a libopus`；若容器/编码格式不兼容，再单独评估转码策略。

- **如何保留“当前歌曲播放完再结束”**：
  - 页面视觉主内容结束时间记为 `Tvisual`。
  - 根据 `BGM_TRACK_DURS` 和统一起点，计算 `Tvisual` 时正在播放的曲目及其结束边界 `TtrackEnd`。
  - Chapter 结尾页继续停留到 `TtrackEnd`，再设置 `data-tour-ended=1`；静音视频本身因此已包含完整尾部等待。
  - 最终混流时音频从与页面 BGM 墙钟一致的 `t=0` 开始，播放到静音视频结束，正好在当前歌曲边界结束。
  - 这保留产品效果，但整个过程中 Headless Chrome 不接触真实音频。

- **统一时间基设计**：
  - 当前模板在脚本解析时记录 `recordStartTs`，而 CDP 首帧稍后出现，曾需要 `adelay` 补偿起点。
  - 新方案建议增加显式启动协议：
    ```text
    页面加载、封面准备完成 → data-record-ready=1
    render.js 等待 ready → 启动 Screencast
    render.js 调 window.__startRecordingTimeline()
    Chapter 同时启动视觉导览和 BGM 模拟墙钟
    最终音轨从静音视频 0 秒开始混入
    ```
  - 页面动画、进度条和最终音频共用同一个 `t=0`，可删除或大幅简化现有 `recordStartMs/pageNowFirst/audioDelayMs/adelay` 补偿链。

- **模块职责调整**：

  | 模块 | 调整后职责 |
  |---|---|
  | `RecommendService` | 区分普通 HTML 与录制 HTML；普通预览可内嵌音频，录制 HTML 只注入曲名和曲长。 |
  | `recommend-chapter.html` | 录制模式使用墙钟模拟 BGM UI；不加载真实音频；保留当前歌曲结束边界计算。 |
  | `RecommendVideoService` | 准备/拼接 BGM、生成录制 HTML、调用静音渲染、最终音视频混流、清理临时文件。 |
  | `render.js` | 单一职责：Headless Chrome 抓帧并输出静音视频；不解析、不延迟、不编码音频。 |
  | FFmpeg 最终混流 | 使用 `-c:v copy` 将独立音轨封装进静音视频，以视频时长为最终边界。 |

- **建议实施步骤**：
  1. 先在 `recommend-chapter.html` 增加保护：`IS_RECORD` 时 `loadTrack()` 不设置 `audio.src`、不调用 `audio.load()`，做最小 A/B 验证。
  2. 为 `RecommendService.buildHtml()` 增加录制用 BGM 元数据模式：仅输出名称，曲长由 `RecommendVideoService` 探测后注入。
  3. 重写 Chapter 录制模式 BGM 条：删除 `fakeT` 和 `audio.duration` 依赖，完全按墙钟 + 曲长数组更新，刷新频率可由 100ms 降为 250ms。
  4. 将 `render.js` 改为只输出静音视频，删除 `--bgm`、`adelay`、音频编码和 `-shortest` 分支。
  5. 在 `RecommendVideoService` 增加最终 mux 阶段：静音视频 + 拼接 BGM → 最终文件，视频流 `copy`。
  6. 增加录制 ready/start 协议，统一视觉与 BGM 的时间起点。
  7. 最后再评估 `render.js` 平均 FPS 方案：至少修正为 `(frameCount - 1) / (lastTs - firstTs)`；如仍有局部掉帧被全局摊平，再考虑保存逐帧时间戳或固定受控输出帧率。

- **验证方案**：
  - 固定同一批媒体、同一 Chapter 配置和同一机器负载，分别导出：无 BGM、1 首 BGM、3 首 BGM。
  - 记录以下指标：
    ```text
    页面 ready 时间
    录制 timeline 起点
    每次 goto 的 autoIndex/type/performance.now()
    每个曲目边界时间
    tourEnded 时间
    frameCount
    firstTs / lastTs / captureDuration
    计算 FPS
    静音视频实际时长
    最终文件 video/audio/format duration
    ```
  - 第一轮只禁用录制模式 `audio.load()`：若逐曲约 20 秒漂移消失，可直接确认主要阻塞源。
  - 第二轮使用不含 BGM Base64 的录制 HTML：确认 HTML 体积、页面加载时间、GC/主线程抖动进一步下降。
  - 最终方案验收应比较相同画面事件时间点，而不只比较文件总时长：开场结束、每章开始、指定媒体详情出现、结尾开始等关键帧在无 BGM/1 曲/3 曲版本中的时间差应保持在允许误差内。

- **验收标准**：
  1. 无 BGM、1 首 BGM、3 首 BGM 的 Chapter 主视觉时间线一致，关键节点累计误差不再随曲目数线性增长。
  2. 三首 BGM 不再出现“每首约慢 20 秒”的正文速率漂移。
  3. 最终视频仍在视觉内容结束后等待当前歌曲自然结束，并在曲目边界收尾。
  4. 页面中的曲名、进度条、下一首提示与最终音轨保持同步。
  5. 最终混流使用视频流 copy，加入 BGM 不改变静音视频帧率、时长和画质。
  6. 普通 HTML 预览/下载仍可真实播放 BGM；仅视频录制 HTML 去除音频 Base64 和媒体加载。

- **风险与回滚**：
  - `-c:v copy` 需要最终容器支持静音视频已有编码；MP4/H.264、WebM/VP9 分别处理，不跨容器直接 copy。
  - 多一份静音中间文件会增加临时磁盘占用，任务完成/失败均需在 `finally` 中清理。
  - 曲长探测失败时不能使用不可靠的默认 180 秒决定结束点；应记录警告并回退为“不等待曲尾”或拒绝导出，由产品规则明确。
  - 新时间基协议如出现问题，可回滚到现有 `recordStartMs + adelay`，静音渲染和最终 mux 仍可单独保留。
  - 首阶段可仅修改 Chapter 的 `IS_RECORD` 音频加载逻辑，改动小、易回滚，`stream` / `overview` 不受影响。

- **涉及技术**：Spring Boot / Java ProcessBuilder / Headless Chrome / Puppeteer Core / Chrome DevTools Protocol `Page.startScreencast` / 浏览器事件循环与主线程阻塞 / Base64 Data URI / HTMLMediaElement / `performance.now()` / FFmpeg concat filter / FFprobe / H.264、VP9、AAC、Opus / FFmpeg stream mapping、`-c:v copy`、`-stream_loop`、`-shortest` / CFR 与时间戳。
- **关键文件**：`backend/src/main/resources/templates/recommend-chapter.html`、`backend/src/main/java/com/videotagger/service/RecommendService.java`、`backend/src/main/java/com/videotagger/service/RecommendVideoService.java`、`backend/scripts/render.js`、`backend/src/main/resources/static/app.js`、`docs/worklog/2026-08-12.md`。
- **当前状态**：完成现象整理、代码链路分析和方案设计，**尚未实施代码修改**；主要根因仍需通过禁用录制模式 `audio.load()` 和增加分段日志进行最终实测确认。
