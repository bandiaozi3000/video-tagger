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
