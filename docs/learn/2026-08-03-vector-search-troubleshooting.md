# Video Tagger 向量检索有效性复盘

> 日期：2026-08-03
> 范围：仅向量检索（Milvus 向量层 + 语义搜索质量），不含前端/部署等其他问题
> 结论先行：向量检索机制本身在跑，但**形同虚设**——对任意查询都返回结果、无相关性保障。根因是"向量层初始化问题 + 检索逻辑缺相似度阈值"。已修复。

---

## 1. 现象

### 1.1 向量层无法正常工作（启动报错）

| 现象 | 错误 |
|---|---|
| 向量写入失败 | `Milvus upsert 失败（CLIP:28）：NumberFormatException: For input string: "C:28"`（ANIME/EPISODE 同理） |
| 向量库加载失败 | `LoadCollectionRequest failed, reason: index not found` |

### 1.2 语义搜索"形同虚设"（任意查询都返回结果）

- 乱敲 `zxcvbnmasdfghjkl` 查询，dim=clip 仍返回片段，score **0.01639**；
- `semanticEnabled: true`（embedding 调用成功，但召回的向量毫无相关性）；
- 用**随机 1024 维向量**直接 ANN：最近命中的余弦相似度仅 **0.0079**（≈0，纯噪声）。

---

## 2. 原因分析

### 2.1 向量层失效根因

**① Milvus collection schema 与代码版本错位。**
存量 collection `clip_embeddings` 是旧代码建的 **Int64 主键**（无 `entity_type` 字段）；新代码期望 **VarChar 组合主键** `"C:28"`（`entity_type:entity_id`）。`ensureCollection` 看到 collection 已存在就跳过重建，SDK 按 Int64 解析 `"C:28"` → NFE，全部 upsert 失败。

**② Milvus 生命周期不完整。**
`createCollection → createIndex → loadCollection → search`，代码只做了第一步，导致 load 报 `index not found`。

### 2.2 检索无效根因

**③ 无相似度阈值。**
`doSearch` 对 Milvus 返回的 topK 不做任何过滤。Milvus 对**任意查询都返回最近 K 条**（余弦 0.01 的无关结果也照返），阈值必须由应用层把关。

**④ 向量覆盖量太少 + 数据缺失。**
集合仅 4 个向量（A:5/C:30/E:4/E:5），"什么都最近"；且 CLIP 28/29 任务在旧 collection 时代 upsert 已失败，却被误标 DONE，**向量缺失**（upsert 内部 catch 吞异常，process 无法感知失败），修复后 sweep 只扫 PENDING，缺失永不被补。

**⑤ RRF 分数掩盖相关性。**
融合分数是名次分 `1/(60+rank)`（首条 0.01639），不反映真实相似度，把噪声结果包装得像正常结果，误导判断。

---

## 3. 修复

### 3.1 重建正确 schema 的向量库（非破坏性换新名）

- `application.yml` 与 `MilvusProperties` 默认值：collection → `clip_embeddings_v2`（VarChar 组合主键）。
- 换名而非删旧库，避免破坏性操作；旧 collection 弃用。

### 3.2 补全 Milvus 生命周期（`MilvusVectorStore.ensureCollection`）

```java
// 建向量索引：load 前必需；幂等，重复创建被 Milvus 忽略
c.createIndex(CreateIndexReq.builder().collectionName(name)
        .indexParams(List.of(IndexParam.builder().fieldName("vector")
                .indexType(IndexParam.IndexType.AUTOINDEX)
                .metricType(IndexParam.MetricType.COSINE).build())).build());
// 搜索/查询前必须 load
c.loadCollection(LoadCollectionReq.builder().collectionName(name).build());
```

### 3.3 加余弦阈值（`MilvusVectorStore.doSearch`）

```java
private static final float MIN_COSINE_SCORE = 0.2f;
// COSINE 指标下 score 即余弦相似度，低于阈值视为噪声召回，丢弃
if (r.getScore() < MIN_COSINE_SCORE) continue;
```

### 3.4 补嵌缺失向量

```sql
UPDATE embedding_tasks SET status='PENDING', retry_count=0, updated_at=0
WHERE entity_type='CLIP' AND entity_id IN (28,29);
```

sweep（60s 定时）自动补嵌，补齐后 DONE。

---

## 4. Milvus 知识点沉淀

- **单 collection 三层共享**：VarChar 组合主键 `A:5` / `E:2` / `C:3`（`entity_type:entity_id`）+ 标量字段 `entity_type` 做层过滤，一次 ANN 跨层召回。
- **COSINE 指标**：返回的 `distance` 即**余弦相似度**（越高越相关，范围 ≈ [-1,1]）；随机/无关查询 ≈ 0。可用随机向量 ANN 快速验证向量是否有区分度。
- **生命周期**：`createCollection → createIndex → loadCollection → search`。**search 前必须 load，load 前必须建索引**。
- **Milvus 对任何查询都返回 topK** —— 相似度阈值必须由应用层把关。
- **REST API 可直接探测**（免 SDK）：
  ```bash
  curl -X POST localhost:19530/v2/vectordb/collections/describe -d '{"collectionName":"clip_embeddings_v2"}'
  curl -X POST localhost:19530/v2/vectordb/entities/search -d '{"collectionName":"...","data":[[...]],"annsField":"vector","limit":10}'
  ```

---

## 5. 复盘经验

1. **检索必须设相似度下限**：向量库"总是返回最近 K 条"的语义，与用户"没有相似内容就返回空"的预期不一致，阈值要在应用层把关。
2. **RRF 分数不能当相关性展示**：`1/(60+rank)` 只是名次分，判断召回质量要看原始 cosine。
3. **写入失败必须显式冒泡**：`upsert` 吞异常 → 任务误标 DONE → 向量静默缺失。任务应"写入成功才置 DONE"，或启动时对账 DONE 与向量存在性。
4. **schema 与代码版本错位时，`ensureCollection` 的"存在即跳过"是隐患**：存量 collection 结构对不上时不会重建，排查先对 schema 再盯代码。
5. **向量覆盖量与检索质量强相关**：向量越密语义搜索越有效，数据太少时"什么都最近"，阈值 + 覆盖率缺一不可。
