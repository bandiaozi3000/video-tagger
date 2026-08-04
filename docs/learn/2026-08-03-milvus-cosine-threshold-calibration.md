# Video Tagger 向量相似度阈值校准复盘（乱搜过滤）

> 日期：2026-08-03
> 范围：Milvus 语义搜索的相似度下限（`min-cosine-score`）
> 结论先行：0.2 余弦阈值**形同虚设**——乱码查询的 cosine 全部 0.24~0.30，全被放行。根因是阈值按"随机向量命中 0.0079"拍定，而**真实 embedding 的无关文本 cosine 有模型 baseline（text-embedding-v4 约 0.2~0.4）**。实测分界约 0.45，已改为 0.45 并配置化。
> 关联：前序复盘 `2026-08-03-vector-search-troubleshooting.md` 第 3.3 节加的 0.2 阈值，本次校准。

---

## 1. 现象

搜索框输入乱码 `zxcvbnmasdfghjkl`（混合 / 片段维度），仍返回无关结果：

```
GET /api/search?q=zxcvbnmasdfghjkl&dim=clip
→ 3 条片段（乱马/杉浦），score = 0.016393 / 0.016129 / 0.015873（RRF 名次分 1/61、1/62、1/63）
```

前端页面同样展示「番剧 1 / 集 2 / 片段 3」无关结果，匹配分 0.02。

## 2. 排查过程

| 步骤 | 方法 | 结果 |
|---|---|---|
| ① 确认阈值代码存在 | 读 `MilvusVectorStore.doSearch` | `if (r.getScore() < MIN_COSINE_SCORE) continue;` 在，常量 0.2f |
| ② 排除旧代码 | 进程启动 22:53 vs class 编译 22:32（IDEA 本地跑） | 加载的是含阈值新类，阈值确实在跑 |
| ③ 排除 MySQL 关键词路 | docker exec 直查 `MATCH...AGAINST('zxcvbnm...')` | 返回空，ngram 全文干净 |
| ④ **决定性证据** | node 调 embedding API 生成乱码真实向量 → 直连 Milvus ANN | **全部 cosine 0.24~0.30，高于 0.2** |

结论：阈值逻辑没问题，是 **0.2 定得太低**，乱码查询全部越线。

## 3. 实测 cosine 分布（text-embedding-v4）

| 查询 | 性质 | top1 cosine | 是否该召回 |
|---|---|---|---|
| 乱马可爱 | 相关（C:30 真实标签） | 0.878 | ✅ |
| 杉浦 | 相关（C:29 真实标签） | 0.744 | ✅ |
| 可爱 | 相关（C:28 标签含"可爱"） | 0.545 | ✅ |
| 高燃战斗名场面 | 无关（库里无此内容） | 0.320 | ❌ |
| zxcvbnmasdfghjkl | 乱码 | 0.303 | ❌ |
| asdfghjklq | 乱码 | 0.315 | ❌ |
| 热血战斗 | 无关 | 0.396 | ❌ |
| 哈基米咩咩叫 | 无关 | 0.432 | ❌ |

**分界线约 0.45**：相关 top1 ≥0.545，无关 top1 ≤0.432。

## 4. 修复

- `MilvusProperties` 新增 `minCosineScore` 字段，默认 **0.45f**；
- `application.yml`：`videotagger.milvus.min-cosine-score: ${MIN_COSINE_SCORE:0.45}`；
- `MilvusVectorStore` 删硬编码常量，改用配置值。
- 乱码 5 条（0.24~0.30）→ 全过滤；相关查询（0.55+）→ 全保留。
- ⚠️ 改后需**重启 Spring Boot**：IDEA 运行中的 JVM 不热更新已加载类。

## 5. 知识点沉淀

1. **随机向量 ≠ 真实 embedding**：测向量库区分度用"随机向量 ANN 命中 0.0079"会误导。真实 embedding 的无关文本 cosine 有模型相关 baseline（text-embedding-v4 约 0.2~0.4），必须用真实 embedding 测。
2. **固定阈值必须按模型实测校准**：换 embedding 模型/供应商后，跑几组相关 + 无关查询，画 cosine 分布取分界。本项目分界 ≈0.45，0.2 挡不住乱搜，0.5+ 会漏弱相关（"可爱"搜出的 C:30 为 0.461）。
3. **阈值做成配置**：`MIN_COSINE_SCORE` 环境变量可覆盖，调参不动代码。
4. **向量覆盖越密检索越准**：本库仅 6 条向量（C:28/29/30 + A:5 + E:4/5），数据少时"什么都最近"、相关性虚高；数据增多后区分度会更好，阈值可再校准。
