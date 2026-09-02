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

- [2026-08-26](#2026-08-26)
- [2026-08-24](#2026-08-24)
- [2026-08-17](#2026-08-17)
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

## 2026-08-24

### 风格包驱动的可扩展高光混剪

- **日期**：2026-08-24
- **业务场景**：将同一媒体下选中的片段制作成可配置风格的高光混剪，而不是固定的“视频拼接 + BGM 混入”。
- **核心链路**：
  ```text
  项目时间线 → 风格包解析/能力校验 → Scene Plan
  → 视觉卡片渲染 → 真实片段标准化 → 转场/音频处理 → ffmpeg 合成
  ```
- **核心设计**：时间线只保存片段、顺序、入出点、剧透、短标题和原声音量；风格包保存颜色、字体、画幅、片头/标题卡/片尾、转场和音频策略；Renderer/Strategy 将配置翻译为 HTML/CSS、ffmpeg filter graph 和音频计划。
- **可扩展边界**：组合已有能力只需增加配置；新效果通过注册 `CanvasRenderer`、`SceneRenderer`、`ClipRenderer`、`TransitionRenderer` 或 `AudioStrategy` 扩展；外部风格仅允许受控 HTML/CSS 卡片模板和资源，禁止任意 JavaScript、shell 或 ffmpeg 命令。
- **推荐导出复用边界**：复用推荐导出的视觉语言、封面/标题卡、BGM 处理、媒体探测、任务管理和产物保护；不把真实视频放入浏览器截帧链路，推荐导出只生成视觉卡片，真实片段由 ffmpeg 处理后统一合成。
- **关键取舍**：所有中间片段先统一画幅、编码、帧率和音频轨；有声保留原声、无声补静音；不支持的必需能力在导出前明确报错；复杂转场、侧链 ducking 和 HLS/DASH 作为后续扩展。
- **涉及技术**：Spring Boot / Java `ProcessBuilder` / JSON 配置 / Renderer Registry / HTML/CSS 卡片 / Puppeteer / FFmpeg / FFprobe。

---


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

---

## 2026-08-17

### omofuna 同步完整流程与卡死加固

- **日期**：2026-08-17
- **业务场景**：补充 AniList 日文原名的**中文标题缺口**，从 omofuna 站按年份批量导入番剧（中文标题 + 年份 + 封面）到媒体库。v0.15 交付，2026-08-17 因他人机器卡死加固。
- **完整流程**（端到端链路）：
  1. 前端「⇄ 同步番剧」弹层选来源 omofuna + 年份 → `POST /api/media/sync-omofuna {years, types}`（types 可过滤分类 1日漫/5动画/24剧场）→ `OmofunaSyncController` → `OmofunaSyncTaskService.create` 校验并建 RUNNING 任务，**秒回 taskId**。
  2. `@Async("syncExecutor")` `execute`：`ProcessBuilder` 跑 `node omofuna.js --years <years> --out <tmp>/omofuna.json --chrome <探测到的Chrome路径> [--types ...]`，工作目录 = scripts-dir。
  3. `omofuna.js`（puppeteer-core 连系统 Chrome，headless new）：
     - URL 结构 `show/{分类ID}--------{页码}---{年份}.html`——**第 1 段是分类 ID**（1日漫/5动画/24剧场），页码在第 8 段、年份在末段；顶部「共检索到 N 条」是静态假计数不可信。
     - 反爬 MaccMS「系统安全验证」页 → 自动点 `input.verify_submit`「继续访问」→ AJAX + `location.reload()` 放行，同会话后续页不再验证；reload 中 evaluate 抛「Execution context destroyed」属正常（`countCards` try/catch 返回 -1 容错）。
     - 每页提取卡片 `a.lazyload[href^="/anime/"]`（`title` 中文名 / `data-original` 封面 webp / `[0-9a-f]{24}` 的 hash），`Set<hash>` 去重；页间限速 `--delay`。
     - 每页 stdout 进度行 `[omofuna] page=<year>/<cat>/<page> items=N total=M`；每 5 页覆写 checkpoint `omofuna.json`；三类终止：0 卡片/全重复 hash/`MAX_PAGES`。
  4. 后端 reader 线程逐行读 stdout，`PROGRESS` 正则（`\[omofuna\] page=\d+/\d+/\d+ items=\d+ total=(\d+)`）解析 → 更新任务 `processedPages`/`itemsFound`；前端 2s 轮询 `GET /api/media/sync-omofuna/{taskId}` 显示进度条。
  5. `exit 0` → `OmofunaSyncService.importFromJson(omofuna.json)` 逐条 upsert（`title` 命中库中已有→跳过；否则建媒体 `original_title` 留空 + 异步下载封面）；`exit≠0`/产物缺失 → 任务 ERROR。
  6. `finally` 递归删临时目录 `vt-omofuna-*`（OS 兜底）。
- **omofuna.json 中间产物**（`--out` 输出，`writeCheckpoint` 生成）：
  ```json
  { "generatedAt": "<ISO>", "years": [2026],
    "items": [{ "title": "中文标题", "coverUrl": "<webp>", "hash": "<24位hex>", "year": 2026, "categoryId": 1 }],
    "stats": { "pages": 14, "items": 355, "failedPages": 0 } }
  ```
  作用三合一：**抓取暂存**（脚本与导入的交棒文件）/ **崩溃 checkpoint**（每 5 页覆写防全丢，但 exit≠0 不导入）/ **导入数据源**（`importFromJson` 只消费 `title`/`year`/`coverUrl`；`hash` 仅供脚本内部去重、`categoryId` 是抓取范围标记）。
- **痛点与加固**（2026-08-17，问题 #9）：
  - **现象**：分享桌面版给他人机器，同步前端进度条不动，后端日志停在「启动 omofuna 抓取」后无输出，任务 RUNNING 卡满 60min 才被强杀；**本机网络好无法复现**。
  - **根因**（读码验证）：
    1. `page.evaluate`（`isVerifyPage`/`countCards`/`extractCards`）**无超时保护**——puppeteer 对页面**同步 JS 阻塞/死循环无法中断**（CDP 只对 `awaitPromise` 生效），他人机器网络不稳/渲染差异（Edge 回退/老 Chrome）触发站点 JS 异常 → evaluate 无限挂起 → `fetchPage` 不返回 → node 无进度输出卡死。
    2. `puppeteer.launch` 无显式超时（低配机/profile 锁/老版本可能卡启动）。
    3. 后端 reader 只解析进度正则、**丢弃 node 其余输出** → Java 日志看不到抓取过程（诊断盲区，误判「无日志=卡死」）。
    4. 后端 `p.waitFor(3600s)` 总超时太长。
  - **修复**（纯加固，不动抓取逻辑）：
    - **omofuna.js 进程级 watchdog**：3 分钟无新进度行 → `console.error` + `process.exit(1)`。关键原理：evaluate 挂起**不阻塞 node 事件循环**，`setInterval` 仍触发 → 卡死自爆，任务变 ERROR 而非永远 RUNNING。
    - **`puppeteer.launch` 包 `Promise.race` 60s 超时**（`t.unref()` 防阻塞退出）。
    - **fetchPage 每步打 `[omofuna] dbg` 阶段日志**（goto/verify/passVerification/cards/extract）——卡住时最后一条日志即卡点。
    - **后端 reader 把非进度行转发到 Java 日志**（`[omofuna-node]` 前缀）——消除诊断盲区。
    - **后端「无进度超时」**：`AtomicLong lastProgressAt` 跟踪最后进度，超 5 分钟 → `destroyForcibly` + ERROR（不再空等 60min）。
- **原理**：异步长任务范式（`@Async` 单线程 syncExecutor + 内存 ConcurrentHashMap 任务表 + ProcessBuilder + reader 线程解析进度 + 前端轮询；`@Async` 自调用失效须经 controller 代理）；puppeteer `page.evaluate` 对同步 JS 阻塞无超时；node 进程级 watchdog 利用「evaluate 挂起不阻塞事件循环」。
- **涉及技术**：Node / puppeteer-core（headless new）、Java `ProcessBuilder` + `redirectErrorStream(true)`、`@Async`、正则解析、JSON checkpoint、`AtomicLong` 无进度检测、`p.destroyForcibly`。
- **关键文件**：`backend/scripts/omofuna.js`、`backend/src/main/java/com/videotagger/service/OmofunaSyncTaskService.java`、`OmofunaSyncService.java`、`OmofunaSyncController.java`、`AsyncConfig.java`、`backend/src/main/resources/static/app.js`（前端轮询）。
- **当前状态**：加固已实施（2026-08-17），`node --check` + `mvn compile` 通过，已打新 jar 重新打包桌面版；**待他人机器跑一次**，靠 `[omofuna-node]` dbg 日志确认卡点（evaluate vs launch）。

## 2026-08-18

### 桌面版内置 Chrome for Testing——根治「依赖用户机器浏览器」的连环坑（0.1.1）

- **日期**：2026-08-18
- **业务场景**：桌面版（Electron 壳 + Spring Boot 子进程）的 omofuna 番剧同步 + 推荐视频导出都走 puppeteer-core 连**用户机器上的 Chrome/Edge**。分享给非技术用户后连续踩坑：①用户从 Bandizip 临时目录直接运行 exe → 同步报 `CreateProcess error=2 系统找不到指定的文件`；②他人机器同步报 `Chrome 启动超时（60s）`（新 watchdog 定位到 puppeteer.launch 卡住）。
- **痛点**：机器环境一台一个样——探测路径错位、老版本 Chrome 不支持 `--headless=new`、商店 stub / 精简系统删 Edge、杀毒拦截、temp 目录运行。逐个排查对非技术用户不可接受，治标不治本。
- **根因**（读码验证）：
  1. **temp 目录运行**：Bandizip 解压到 `%TEMP%\BNZ.xxx` 后运行 exe，`process.resourcesPath` = temp 目录；解压完 temp 被删 → 按需 spawn 的 `resources\node\node.exe`（及 Chrome）不存在 → `CreateProcess error=2`。exe 已加载进内存仍能跑，node 是按需启动所以同步才炸。
  2. **Chrome 启动超时**：`resolveBrowserPath()` 只返回 `fs.existsSync` 为真的路径（desktop/main.js），故**不是文件缺失**，是进程起来了但 CDP 起不来（老版本 headless / stub / 杀毒 / 低配）。60s 超时来自 omofuna.js 的 `Promise.race(launch, 60s watchdog)`。
- **方案**：**打包内置固定版本 Chrome for Testing 131.0.6778.204 完整版**（win64 155MB），程序永远用自己的浏览器——路径确定、版本确定、headless 必支持、与打包的 puppeteer-core 23.11.1 匹配，与机器环境彻底解耦。用户拍板选完整版（+155MB）而非 headless-shell（+100MB），保留 `--headed` 有头调试兜底。
- **实现**：
  - **pack.bat** 新增步骤下载 `chrome-win64.zip`（npmmirror 镜像 `https://npmmirror.com/mirrors/chrome-for-testing/{ver}/win64/chrome-win64.zip` → 官方 googleapis 兜底），解压平铺到 `desktop/resources/chrome/chrome.exe`（与 node 同套路，`if not exist` 跳过已下载）。
  - **package.json** `extraResources` 加 `resources/chrome → chrome`；version 0.1.0 → 0.1.1。
  - **main.js** `bundledChromePath()`（打包态 = `resources/chrome/chrome.exe`，开发态 null）+ `resolveBrowserPath()` 优先级改为 **env → 内置 → 手动存档 → 自动探测 → 手动选择弹窗 → 兜底默认**。
  - **后端零改动**：`application.yml` 的 `chrome-path: ${RENDER_CHROME_PATH:...}` 环境变量注入；omofuna.js / render.js 均 `headless:'new'`，Chrome 131 原生支持。
- **关键链路全打日志**（精确排查，5 处）：omofuna.js / render.js launch 前后 `[omofuna]/[render] dbg`（chrome 路径、`launching` / `launched ok` / `browserVersion=`）；两个后端服务启动日志加 `node=, chrome=, scripts=` 实际路径；main.js `[browser]` 逐分支。后端日志落盘 `data/logs/video-tagger.log`，用户整文件提供即可定位卡点。
- **重要洞察（用户提问：视频导出成功但同步超时，差异在哪）**：两者 launch 机制完全相同（同 chrome、同 `headless:'new'`、同 `--no-sandbox`）。**差异 = 超时 watchdog 不对称**：omofuna launch 有独立 **60s 硬超时**（`LAUNCH_TIMEOUT_MS=60_000`）；视频导出**无 launch 级 watchdog**，只有总渲染超时 **40min**（`RENDER_TIMEOUT_SECONDS=40*60`）。慢机器 launch 61~90s → 同步 60s 就放弃报「Chrome 启动超时」，视频导出会等到成功 → 两者同时成立。次要差异：同步 launch 后 `goto` 外网 + 反爬验证页（卡住报「无进度超时」），导出 `goto` 本地 `file://`（秒开）。内置 Chrome 后 launch 实测秒开，基本消除。
- **原理**：Electron `process.resourcesPath` 随 exe 运行目录；puppeteer-core 对 `executablePath` 指定浏览器 spawn 后等 CDP 就绪（`headless:'new'`）；Spring 环境变量注入 `application.yml` 占位符；npmmirror 完整镜像 google chrome-for-testing。
- **冒烟验证**：最小 puppeteer launch `Chrome/131.0.6778.204` ✅；真实 omofuna.js 用内置 chrome 抓 2026 日漫 **205 条**（自动过 MaccMS 验证页、失败页 0、exit 0）✅。坑：裸跑 `chrome.exe --version` 卡死（sandbox 拒绝访问 + GPU 崩溃）是假象，不影响 puppeteer 的 `--no-sandbox --headless=new` 场景。
- **打包踩坑**（git-bash 跑 pack.bat）：`cmd //c pack.bat` 找不到文件（非交互 cwd 不生效）；`cmd /c "cd /d X && ..."` 的 `/d` 被 MSYS 路径转换搞坏。**正确姿势** `MSYS_NO_PATHCONV=1 cmd /c "绝对路径" < /dev/null`（pack.bat 靠 `%~dp0` 定位；`< /dev/null` 防结尾 `pause` 阻塞）。另：pack.bat 的 `ZIP_NAME` 与头注释**硬编码版本**，升版必须同步；加/删步骤要前后统一 echo 编号。
- **涉及技术**：Electron（`process.resourcesPath`）、puppeteer-core 23.11.1、Chrome for Testing / `headless:'new'`、npmmirror 镜像、PowerShell `Expand-Archive`、MSYS 路径转换、Spring `@Value` 环境变量注入。
- **关键文件**：`desktop/pack.bat`、`desktop/package.json`、`desktop/main.js`、`backend/scripts/omofuna.js`、`backend/scripts/render.js`、`OmofunaSyncTaskService.java`、`RecommendVideoService.java`、`backend/src/main/resources/application.yml`。
- **当前状态**：0.1.1 已打包交付（`release/video-tagger-desktop-0.1.1.zip` 672MB），zip 内 `resources\chrome\chrome.exe` 已确认；待无 Chrome / 精简 / 老版本机器实测。

### 后端双库方言兼容（SQLite / MySQL）

- **日期**：2026-08-18
- **业务场景**：桌面版（SQLite）与 Web 版（MySQL）共用同一套后端 jar 与 mapper（mysql profile + DatabaseIdProvider）。用户 IDEA + mysql profile 跑 web 时，**标签添加报 `SQLSyntaxErrorException`、标题搜索无效**。
- **痛点**：代码库从 MySQL 切 SQLite（桌面化）时，mapper SQL 落入了 SQLite 方言，Web 跑 MySQL 就炸；且 MySQL 路径长期被标为"迁移专用"没被真正维护。
- **根因**（读码 + 字节码 + git 历史三层验证）：
  1. **`INSERT OR IGNORE`（SQLite 语法，MySQL 不认）**：Tag/ClipTag/MediaTag/EpisodeTag/MediaCollection 5 个 mapper 共 9 处 → 标签添加执行即抛 SQL 语法错。
  2. **`||` 字符串拼接（SQLite=拼接，MySQL=逻辑 OR）**：Clip/Media/Tag/Episode 4 个 mapper 共 25 处，`LIKE '%' || #{q} || '%'` 在 MySQL 变成 `LIKE ('%' OR q OR '%')` → 搜索条件失效返回空。
  3. **`@MapperScan` 在 commit `0e61af8`（2026-07-21）被误删**：mybatis-plus 3.5.7 自动扫描**只认 `@Mapper` 注解**（反编译字节码实锤字符串 "Searching for mappers annotated with @Mapper"），本项目 mapper 无 @Mapper，靠自动扫描注册一直悬着——某次构建后彻底不注册 → **应用直接起不来**（`No qualifying bean ... ClipMapper`）。恢复 `@MapperScan("com.videotagger.mapper")` 后秒好（测试 `HealthIT` 注释也印证主类本该有）。
- **修复**：
  - **`VideoTaggerApplication` 恢复 `@MapperScan("com.videotagger.mapper")`**。
  - 新增 **`config/MybatisConfig.java`**：`VendorDatabaseIdProvider`（`SQLite→sqlite` / `MySQL→mysql`）；mybatis-plus 3.5.7 auto-config 反编译确认构造注入 `ObjectProvider<DatabaseIdProvider>` 并 `setDatabaseIdProvider`，bean 会被应用。
  - 5 个标签 mapper 的 `INSERT OR IGNORE` 改 **`@Insert(value=..., databaseId="sqlite")` + `@Insert(value=..., databaseId="mysql")` 双语句**（SQLite=INSERT OR IGNORE / MySQL=INSERT IGNORE）。**不用 `<script>`+`_databaseId`**——实测曾破坏 mapper 注册；`databaseId` 属性最干净。
  - `||` 改 **`CONCAT('%', #{q}, '%')`**（sqlite-jdbc 3.45 内置 SQLite 3.45 支持 CONCAT，MySQL 8 支持，无损替换 25 处；含 URL host 提取的 `substr`+`instr`，两库语义一致）。
- **原理**：MyBatis `DatabaseIdProvider` 按 `DatabaseMetaData.getDatabaseProductName()` 探测库 → `_databaseId` / `databaseId` 属性选语句；`VendorDatabaseIdProvider` 需 bean 注册且被 mybatis-plus 拾取；SQLite 3.44+ 与 MySQL 均支持 `CONCAT()` 使 LIKE 拼接可移植；`INSERT OR IGNORE`（SQLite）↔ `INSERT IGNORE`（MySQL）无单一语法，须按库分支。
- **验证**（双库端到端，全绿）：
  - SQLite（scratch 库，8800）：标签添加 `{"id":1}`、重复幂等 400、搜索无报错 ✅
  - MySQL（docker `vt-mysql` 隔离库 `video_tagger_test`，8801，Flyway V1~V19 迁移）：标签添加 `{"id":1}`、重复幂等、**标题搜索 `q=方言` 命中「方言测试番剧2」** ✅
  - 测试库已删、后端已停、临时文件已清。
- **跨库 SQL 约定（写新 SQL 必看）**：字符串拼接一律 `CONCAT()`；幂等插入用 `@Insert(databaseId=sqlite/mysql)` 双语句；`IFNULL/substr/instr` 两库通用；`GROUP BY` 只选 PK 依赖列（MySQL ONLY_FULL_GROUP_BY）。**勿删 @MapperScan**。
- **顺带发现**：`POST /api/media` 不传 `status` 会 NPE（`STATUSES.contains(null)`，MediaService.apply）——测试请求问题，UI 总会带 status，未修。
- **涉及技术**：MyBatis `DatabaseIdProvider` / `@Insert(databaseId=)`、mybatis-plus 3.5.7 auto-config、`CONCAT()` 跨库可移植、SQLite 3.45 / MySQL 8、Flyway V1~V19、`@MapperScan`。
- **关键文件**：`VideoTaggerApplication.java`、`config/MybatisConfig.java`、`mapper/{Tag,ClipTag,MediaTag,EpisodeTag,MediaCollection,Clip,Media,Episode}Mapper.java`、`application.yml`（mysql profile）。
- **当前状态**：已修复并双库验证（2026-08-18），已提交（commit `63df261`）；Web 连 MySQL 的标签/搜索功能恢复正常；待用户在真实环境（IDEA/docker）重跑确认。

---

## 2026-08-26

### Docker MySQL 数据卷损坏与数据恢复完整复盘

- **日期**：2026-08-26
- **业务场景**：video-tagger 的 MySQL 数据（Docker 卷 `video-tagger_mysql_data`，MySQL 8.0.45，库 `video_tagger`）因 Docker 异常退出而"看起来全丢"，且 Docker Desktop 自身也无法启动。目标：**最大程度恢复数据 + 修复 Docker**。
- **事故链**（怎么发生的）：
  1. Docker 异常退出 → 数据盘（ext4 文件系统）损坏；
  2. 当日曾执行 `e2fsck -fy` 强制修复 → 清掉了 Docker 的目录结构（inode 索引）；
  3. Docker Desktop 重建新数据盘时**清零了旧盘 VHDX 的 BAT（块分配表）元数据** → 旧盘 `docker_data.vhdx.old-20260826`（123G）无法再作为虚拟磁盘挂载；
  4. 雪上加霜：`D:\learn\docker\DockerDesktopWSL\main` 目录损坏（D 盘 exFAT 被标 dirty），Docker Desktop 彻底起不来。
- **怎么解决**（完整时间线，桌面项目三个连续会话）：
  | 阶段 | 本地时间 | 做了什么 | 结果 |
  |---|---|---|---|
  | ① 发现 | 14:55 | 用户发现 `D:\learn\docker` 下有两个 DockerDesktopWSL 目录，`docker_data.vhdx` 被截断（新 1G vs 旧 123G） | 锁定旧数据盘 |
  | ② 诊断 | 15:00 | 旧盘挂载失败 `0x80070570`（目录损坏）；文件头 `vhdxfile` 签名仍在 → 物理数据可能还在 | 放弃虚拟层挂载，转字节级捞 |
  | ③ 二进制定位 | 15:20 | 直接对 123G 物理文件扫内容特征：`video_tagger` 字符串命中 12986 次、binlog 魔数 `fe 62 69 6e`、InnoDB infimum/supremum 页特征 | 定位到 28 个 binlog（覆盖 8/12~8/25） |
  | ④ 环境重建 | 15:30 | Docker 起不来 → 安装 Ubuntu-24.04 WSL + MySQL 8.0.46 作恢复沙箱 | 恢复环境就绪 |
  | ⑤ binlog 提取+重放 | 15:59 | 从物理文件按偏移区间提取 28 个 binlog（2.8G）到 `D:/recovery/binlogs/`；mysqlbinlog 解析 + 顺序重放 | 单独重放有限（DML 依赖前置状态，报 ERROR 1032/1050） |
  | ⑥ 备份+binlog 补齐 ★ | 16:25 | 发现用户备份 `data/backup/video_tagger_20260813.sql`（8/13，44.7M）→ 导入备份 → 重放 binlog_13~28（8/13 之后）补齐 | **恢复 8367 行**，导出 `D:/recovery/video_tagger_final.sql`（45M 完整库） |
  | ⑦ 修 Docker | 16:44 | 根因 `main` 目录损坏 + D 盘 exFAT dirty → 用户拍板 `chkdsk D: /f`（UAC，跑较久）→ "Windows made corrections" / NOT Dirty → 删 main 目录 → Docker Desktop 重启 | 引擎 29.7.2 就绪 |
  | ⑧ 导入验证 | 17:17 | `docker compose up` 拉起 mysql，导入 final.sql | 行数核对一致（media 5528 等） |
- **恢复结果**（数据源 = 8/13 完整备份 + 8/13 之后 binlog 补齐）：
  | 表 | 行数 | 表 | 行数 |
  |---|---|---|---|
  | media | 5528 | media_collection | 2148 |
  | tag | 140 | media_tag | 108 |
  | embedding_tasks | 348 | clips / episode / episode_tag / clip_tag | 各 10 |
  | media_subcategory | 15 | collection | 5 |
  | title_mapping | 4 | recommend_draft / template | 1 / 3 |
  | site_setting | 1 | highlight_export / project / project_item | 各 1 |

  导出文件：`D:/recovery/video_tagger_final.sql`（45M，完整 schema + 数据）。
- **原理**（排障中学到的硬知识）：
  - **VHDX 双层结构**：header（`vhdxfile` 魔数）+ **BAT（Block Allocation Table）**。BAT 是"虚拟块 → 物理块"映射表，被清零后物理数据块仍在磁盘上，但**无法通过虚拟层定位**——"数据看着没了，字节其实还在"，所以要字节级扫内容特征。
  - **binlog 可做地毯式恢复**：MySQL 8 binlog 文件头魔数 `fe 62 69 6e`（".bin"），物理文件里按魔数 + 事件链（FORMAT_DESCRIPTION_EVENT 开头）可定位整段 binlog 区间，用 `dd` 按偏移提取即得完整文件；事件类型有 QUERY_EVENT（DDL/语句）、TABLE_MAP + ROWS_EVENT（行变更）。
  - **InnoDB 页恢复优先级低**：页特征（FSP_HDR 页类型 0x0008、infimum/supremum 固定字节）能定位页头，但页内聚簇记录文本段大多已损坏，重组成功率低，**优先级低于 binlog/备份**。
  - **binlog 默认只留约 2 周**：只能覆盖近期增量，**全量备份才是唯一保险**。
  - **MySQL 客户端"乱码"假象**：数据本身是 utf8mb4 正确存储，但 `mysql` 客户端默认会话字符集是 **latin1** → 中文 SELECT 显示成 `?`/乱码；用 `--default-character-set=utf8mb4` 连接即正常。**判断"数据真乱码"前先查 `SHOW CREATE TABLE` 确认列字符集 + 用正确字符集连接验证，再下结论。**
- **关键教训 / 行动项**：
  1. **Docker 数据卷必须定期备份**（本次全靠 8/13 的偶然备份兜底）——定时 `mysqldump` 或 `docker run --rm -v <vol>:/data -v D:/backup:/backup alpine tar czf /backup/mysql_$(date +%F).tar.gz -C /data .`。
  2. **故障时先停写、少折腾**：`e2fsck -fy` 强制修复 + Docker 重建数据盘的双重打击，把本可挽救的盘彻底变成只能"字节级捞"。
  3. **备份 + binlog 双保险**：备份管全量、binlog 管近 2 周增量，结合才是完整恢复路径。
  4. **恢复后 schema 会落后**：备份是旧时间点快照，恢复后需 Flyway 补跑到最新（本案例缺 V20/V23，需 `SPRING_FLYWAY_OUT_OF_ORDER=true` 补跑中间版本）。
- **涉及技术**：MySQL 8.0.45 / 8.0.46、binlog（`.bin` 魔数 + 事件链）、mysqlbinlog、InnoDB 页结构（FSP_HDR / infimum/supremum）、VHDX（BAT 映射表）、WSL2（Ubuntu-24.04 恢复沙箱 + 旧盘挂载）、chkdsk（exFAT 脏盘）、Docker Desktop、Flyway。
- **遗留 / 后续**：恢复数据已导入新卷；V20/V23 迁移补跑与应用层验证见当日工作日志；旧 123G 数据盘已删除。

---

### Docker MySQL 数据卷事故后的自动备份监控落地

#### 1. 起因：一次存储层事故暴露了“手工备份不等于备份机制”

本次工作的直接起因，是当天发生的 Docker MySQL 数据卷损坏事故。事故链不是已证实的业务 SQL 写错数据，而是存储层连续受损：

```text
Docker 异常退出
→ Docker 数据盘 ext4 文件系统损坏
→ 对现场执行 e2fsck -fy，Docker 目录结构被清理
→ Docker Desktop 重建数据盘，旧 VHDX 的 BAT 元数据被清零
→ MySQL 数据卷无法正常挂载，数据库看起来像“全丢”
```

恢复过程曾尝试从 123G 旧盘进行字节级扫描，找到 28 个 binlog（覆盖 8/12~8/25，共约 2.8G），但 binlog 单独重放受前置状态依赖影响，出现 `ERROR 1032/1050`，无法独立构成完整恢复来源。最终能够恢复，依赖的是：

1. 找到 8/13 的完整 `data/backup/video_tagger_20260813.sql`；
2. 导入该全量快照；
3. 按顺序重放 8/13 之后的 binlog；
4. 恢复 8367 行并导出完整 `D:/recovery/video_tagger_final.sql`。

这次事故形成了三个直接结论：

- **全量 SQL 快照是基础保险**，不能把希望寄托在损坏后的 InnoDB 页恢复上；
- **binlog 不能替代全量备份**，且默认保留窗口有限（复盘中观察到约两周）；
- **偶然手工做过一次备份，不等于系统具备备份能力**：没有自动触发、固定副本、旧版本保护和持续监控，下一次仍可能从头救火。

项目规划原本也记录过“当前完全没有备份/恢复机制”的缺口，但本次实际需求被明确收窄为先把 MySQL 数据定期保存下来，不扩展到完整灾备平台。

#### 2. 需求如何收敛

本次讨论经历了从大范围数据安全建议到最小可用备份机制的收敛过程：

1. **初始建议范围较大**：曾考虑数据库约束、数据一致性、同步幂等、恢复演练、Milvus 和本地资产等治理事项；复盘后确认这超出了当前诉求。
2. **用户明确目标**：只需要备份 MySQL，不处理 SQLite、Milvus、MinIO、etcd、封面、导出文件和恢复功能。
3. **曾考虑 MySQL → SQLite 作为第二副本**：项目已有 `MigrationTool`，可以按依赖顺序迁移 MySQL 全表到 SQLite，并做行数比对；但它会先删除目标 SQLite 再重建（`MigrationTool.java` 的 `Files.deleteIfExists`），是迁移工具而不是备份工具。同步失败可能留下不完整数据库，且把备份问题扩大成双数据库维护问题，因此最终排除。
4. **最终数据范围**：只导出 MySQL 数据库 `video_tagger`，不改 Java 业务写入路径，不改 SQLite 迁移工具。
5. **最终保存位置**：每份 SQL 保存两份——项目目录 `data/backup/` 和 C 盘 `%LOCALAPPDATA%/VideoTagger/backup/`。当前机器实际为 `C:\\Users\\86132\\AppData\\Local\\VideoTagger\\backup\\`。
6. **物理风险边界**：C 盘副本和项目所在 D 盘副本可以防目录误删或部分单盘逻辑问题，但如果 C、D 属于同一块物理盘，整盘损坏时仍可能一起丢失；本次按用户指定的“双目录备份”先落地，不额外引入异机/云端方案。

#### 3. 备份频率与旧文件策略讨论

##### 3.1 旧备份是否删除

不能在新备份开始前删除旧文件，否则新一轮 dump 中途断电、Docker 退出或复制失败时，可能连上一份可用快照都没有。最终采用“双副本成功后再轮转”：

```text
生成新的临时 SQL
→ 项目目录临时副本成功且非空
→ C 盘临时副本成功且大小一致
→ 两处临时文件改名为正式时间戳文件
→ 再清理超过保留数量的旧成对备份
```

默认保留最近 **3 轮**。只有项目目录和 C 盘都存在的成对 SQL 才参与轮转；如果新备份失败，旧正式文件不删除。当前数据库约 45 MB，两个位置保留 3 轮约占 270 MB，保留少量历史版本还能避免“误删后立即备份”覆盖唯一快照。

##### 3.2 每小时全量 dump 与 binlog 变更检测

讨论过两种策略：

| 策略 | 优点 | 代价 | 结论 |
|---|---|---|---|
| 开启 binlog，比较位点，有变化才 dump | 数据库空闲时少做重复读写；不依赖业务 Service，人工 SQL 也能被识别 | 要修改 Compose 的 MySQL 参数，维护 `server-id`、binlog、过期策略和位点状态，还要处理重启/轮转 | 当前不采用 |
| 每小时无条件完整 mysqldump | 实现简单；每份都是独立完整快照；不需要改 MySQL 配置和维护状态文件 | 即使无变化也会读取和写入约 45 MB | **最终采用** |

以当前约 45 MB 数据估算，每小时一次、两处落盘的写入量约为：

```text
45 MB × 24 次 × 2 个位置 ≈ 2.1 GB/天
```

对当前个人项目和普通磁盘而言可接受，换来的却是更简单、更直观、故障面更小的备份链路。binlog 更适合后续的时间点恢复、增量备份或主从复制；当前既不要求这些能力，也不需要为了“判断是否变化”额外启用它。

##### 3.3 监控周期与 Docker 状态

最终采用长期运行的 PowerShell watcher，而不是 Docker 退出后直接结束的脚本：

```text
Windows 用户登录
→ watcher 常驻
→ 每 30 秒检查 Docker / vt-mysql
→ healthy 后立即备份
→ 后续每 60 分钟备份一次
→ Docker/MySQL 不可用时暂停备份，继续等待
→ 恢复 healthy 后立即备份，不等待下一个整点
```

只检查 Docker Desktop 进程不够，因为 Docker 引擎可用不代表 MySQL 已完成初始化；只检查容器 `running` 也不够，因为容器可能仍未接受连接。项目的 `docker-compose.yml` 已有 MySQL healthcheck，因此脚本使用三层条件：Docker CLI 存在、`docker info` 成功、`vt-mysql` 的状态为 `running` 且 health 为 `healthy`。

Docker 退出时的行为明确为：不执行 dump、不删除已有备份、不操作数据卷；Docker 恢复后重新检查并立即做一份当前快照。若 Docker 在 dump 过程中退出，本轮使用临时文件，失败后清理临时文件，上一份正式备份继续保留。

#### 4. 最终技术方案

新增两个独立 PowerShell 文件：

##### 4.1 `scripts/backup-mysql-watch.ps1`

- 默认容器名 `vt-mysql`，数据库名 `video_tagger`；数据库名限制为字母、数字和下划线，避免拼接 SQL 命令时引入 shell 参数风险；
- 启动时创建项目备份目录和 C 盘备份目录；
- 通过 `Get-Command docker.exe/docker` 定位 Docker CLI；如果开机阶段 PATH 尚未准备好，不退出，而是在后续扫描中重新查找；
- 用 `docker info` 判断 Docker daemon 是否可用，用 `docker inspect` 读取容器运行状态和 healthcheck 状态；
- 使用命名 Mutex `Global\\VideoTagger-MySqlBackupWatcher` 防止用户重复启动多个 watcher，避免同时写同一批备份；
- 首次 healthy 时立即导出，此后默认每 60 分钟导出一次；失败时 5 分钟后重试；
- 使用 `mysqldump` 参数：
  - `--single-transaction`：对 InnoDB 做在线一致性快照，不需要停库；
  - `--routines --events --triggers`：保留数据库对象定义；
  - `--hex-blob`：避免二进制字段在文本导出中产生歧义；
  - `--default-character-set=utf8mb4`：与项目 MySQL 字符集约定一致，避免中文导出问题；
  - `--set-gtid-purged=OFF`：避免恢复到不同实例时写入不必要的 GTID 信息；
  - `--no-tablespaces`：降低导出所需额外权限和环境要求；
  - `--databases video_tagger`：只导出项目业务库，不导出 MySQL 系统库；
- 密码不写入 PowerShell 命令参数，而是在容器内将已有 `MYSQL_ROOT_PASSWORD` 赋给 `MYSQL_PWD`，再调用 `mysqldump`；这样避免密码参数泄露，也避免 MySQL 客户端 warning 被脚本误判；
- SQL 先写到容器 `/tmp` 的随机文件，再通过 `docker cp` 复制到项目目录临时文件；复制到 C 盘临时文件后比较大小，两个临时文件都成功后才改名为 `video_tagger_yyyyMMdd_HHmmss.sql`；
- 旧备份只按成对文件轮转，默认保留 3 轮；
- 日志写入 C 盘 `backup-watcher.log`；
- `-OneShot` 参数仅用于手动执行一次测试，正式计划任务不带此参数。

##### 4.2 `scripts/install-backup-watcher.ps1`

- 检查 watcher 文件存在并创建 C 盘备份目录；
- 注册任务名 `VideoTagger MySQL Backup Watcher`；
- 使用当前用户登录触发（不是无用户会话的系统底层启动），因为任务以 `InteractiveToken`、普通权限运行，需要访问当前用户 `%LOCALAPPDATA%` 和 Docker CLI；
- 配置 `StartWhenAvailable`、失败后每 5 分钟最多重启 3 次、无限执行时间；
- 注册后立即启动任务；watcher 使用 `-WindowStyle Hidden` 在后台运行，不弹出常驻 PowerShell 窗口；
- 不自动替用户执行系统任务注册，需手动运行安装脚本。

这里对“开机启动”作了准确化：实际是**Windows 启动后用户登录时自动启动**，不是用户尚未登录时就运行。对当前 Docker Desktop 和用户目录场景，这比无交互系统任务更可靠。

#### 5. 实施过程中的问题与修正

##### 5.1 相对路径导致“文件不存在”

用户首次执行 `./scripts/install-backup-watcher.ps1` 时报告文件不存在。排查后确认仓库中的两个脚本均存在，原因是当时 PowerShell 当前工作目录不是项目根目录，相对路径自然无法解析。使用绝对路径：

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass `
  -File "D:\\learn\\myLearn\\video-tagger\\scripts\\install-backup-watcher.ps1"
```

后注册成功。后续使用相对路径时必须先切换到项目根目录。

##### 5.2 `mysqldump` warning 被误当成失败

第一次 `-OneShot` 测试时，容器内 `mysqldump` 已经执行并生成 SQL，但日志显示失败，错误内容只有：

```text
mysqldump: [Warning] Using a password on the command line interface can be insecure.
```

根因是 PowerShell 严格错误模式下把 `docker exec` 合并输出中的 stderr warning 当成异常路径信息。随后直接在容器内复现，确认命令能生成约 47 MB 文件；脚本改为：

1. 使用容器已有环境变量设置 `MYSQL_PWD`，不再使用 `--password=...`；
2. 屏蔽已知 stderr warning；
3. 只根据 `docker exec` 和 `docker cp` 的退出码判断成功；
4. 仍检查最终文件非空和双副本大小一致。

修正后测试通过。

##### 5.3 Docker 状态竞态

验证过程中曾观察到 `vt-mysql` 为 `exited|starting`。脚本没有尝试操作数据卷，而是按设计等待；容器恢复为 `running|healthy` 后才执行 dump。这验证了“容器启动”和“数据库可用”必须区分。

##### 5.4 Docker CLI 开机时 PATH 不完整

Windows 计划任务启动阶段可能早于 Docker CLI PATH 完全准备好。脚本不把一次 `Get-Command` 失败当作永久故障；它会记录 `docker-cli-missing` 并在每轮扫描重新寻找 Docker CLI，避免开机顺序导致 watcher 永久失效。

#### 6. 实际验证结果

验证分为静态验证、容器内命令验证、真实双副本验证和计划任务验证：

1. 两个 PowerShell 脚本通过 PowerShell AST 语法解析；
2. `git diff --check` 通过；
3. Docker 引擎版本为 `29.7.2`；
4. `vt-mysql` 恢复到 `running|healthy` 后，容器内 `mysqldump` 成功生成 `47,498,933` 字节 SQL；
5. 一次性脚本真实执行成功，生成：
   - `data/backup/video_tagger_20260826_232708.sql`；
   - `C:\\Users\\86132\\AppData\\Local\\VideoTagger\\backup\\video_tagger_20260826_232708.sql`；
6. 两份文件大小均为 `47,498,933` 字节，SHA-256 均为：

```text
7067361E0ED2D2E2419613D647C2F5B9080C80F3F9F12D5F9FAF31557A724BB2
```

7. 临时文件数量为 0；
8. 使用绝对路径注册计划任务成功，任务名为 `VideoTagger MySQL Backup Watcher`，状态为 `Running`；
9. 计划任务启动后的日志记录了 23:45:51 发现 MySQL healthy，并于 23:45:52 完成新的 `video_tagger_20260826_234551.sql` 备份；
10. 最终再次检查两处最新 SQL，文件名、大小和 SHA-256 一致。

这次只验证了“导出成功并形成两个一致副本”，**没有执行恢复导入验证**，符合本次明确的需求边界。

#### 7. 最终使用方式

安装或重新注册常驻监控：

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass `
  -File "D:\\learn\\myLearn\\video-tagger\\scripts\\install-backup-watcher.ps1"
```

手动只执行一次备份测试：

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass `
  -File "D:\\learn\\myLearn\\video-tagger\\scripts\\backup-mysql-watch.ps1" -OneShot
```

查看任务：

```powershell
Get-ScheduledTask -TaskName 'VideoTagger MySQL Backup Watcher' |
  Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'VideoTagger MySQL Backup Watcher' |
  Format-List
```

查看日志：

```powershell
Get-Content "$env:LOCALAPPDATA\\VideoTagger\\backup\\backup-watcher.log" -Tail 30
```

卸载计划任务：

```powershell
Unregister-ScheduledTask -TaskName 'VideoTagger MySQL Backup Watcher' -Confirm:$false
```

#### 8. 最终敲定版本与边界

本次最终敲定的是一个**轻量版 MySQL 自动全量备份 v1**，不是生产级主从或灾备平台：

```text
只备份 MySQL video_tagger
+ Windows 用户登录后常驻监控
+ 每 30 秒检查 Docker/MySQL healthy
+ healthy 后立即备份
+ 每 60 分钟完整 mysqldump
+ 项目目录和 C 盘各保存一份
+ 保留最近 3 轮成对备份
+ Docker 退出时暂停，恢复后立即继续
+ 不开启 binlog
+ 不备份 SQLite/其他资产
+ 不实现恢复和恢复演练
```

不选择主从的原因是：主从主要解决高可用和故障切换，不是独立备份；误删和错误 SQL 也可能同步到从库。当前数据库只有约 45 MB，部署主从的维护成本明显高于每小时全量 dump 的成本。

不选择“每次业务写操作后立即 dump”的原因是：当前写入口分散在多个 Service/Mapper，人工 SQL、Flyway 和其他工具也可能绕过业务入口；每次事务都生成完整 45 MB 文件会造成不必要的 I/O 和并发复杂度。每小时快照将理论备份缺口控制在约 1 小时，符合当前目标。

后续若数据量明显增长或需要时间点恢复，再考虑启用 binlog 并做异盘归档；若要求主机/磁盘级灾难保护，则需要把副本放到另一块物理盘、NAS 或云端。本次不扩展这些范围，也不升级业务版本。
