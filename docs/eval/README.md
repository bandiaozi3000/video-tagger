# 语义检索质量评估

对当前 `/api/search`（MySQL 关键词 + Milvus 向量 + RRF 融合 + 0.45 阈值）做量化评估，作为 v0.9 检索质量优化的基线。

> 📖 **完整方法论 + 基线结果 + 缺口分析见 [EVALUATION.md](EVALUATION.md)**（先读这篇）。
> 基线存档：`results/2026-08-06-baseline.txt`（Recall@10 73.3%，近义/语义召回是主要缺口）。

## 前置

- 后端已启动，且**已配 `EMBEDDING_*` 环境变量**（未配则 `semanticEnabled=false`，评估会警告，结果仅供参考）。
- Milvus 向量层 healthy（`clip_embeddings_v2` Loaded）。
- 建议向量数据量 ≥ 几十条（太少则语义类目结论不稳）。

## 文件

| 文件 | 作用 |
|---|---|
| `search-golden-set.json` | 评测集：`{query, dim, expected[], shouldEmpty, category}` |
| `run-search-eval.js` | 评测脚本：逐条打 `/api/search`，算 Recall@K / MRR / 空返回率 |

## 用法

```bash
node docs/eval/run-search-eval.js              # 默认 golden set + localhost:8080 + K=10
BASE_URL=http://localhost:8080 K=5 node docs/eval/run-search-eval.js
```

## golden set 说明

- `expected`：应出现在 top-K 结果的 **title / mediaTitle / tag / note** 任一字段的子串数组（大小写不敏感）。命中任一即算该条召回。
- `shouldEmpty: true`：负样本（乱搜），校验 0.45 阈值能否正确挡掉无关查询。
- 类别建议（各 5~8 条，总量 30~40）：
  1. **字面/标签命中**：query=已有标签 → 检验关键词精确召回
  2. **近义/语义召回**：query=近义词（如「热血」→ 标「高燃」的片段）→ 检验向量语义能力（**核心**）
  3. **描述性查询**：query=自然语言描述 → 检验备注/长文本向量
  4. **媒体级**：query=媒体标题/别名
  5. **集级**：query=集标题
  6. **乱搜拒绝**：无意义串 → 应返回空

## 指标口径

- **Recall@K**：`期望命中数 ÷ 期望总数`（K 为返回上限；正常条目平均）
- **MRR**：首个期望命中的 `1/rank`（排序质量；正常条目平均）
- **空返回正确率**：负样本中正确返回空的占比
- 逐条明细含 top5，可肉眼复查"为什么没搜到" → 直接指导 v0.9 改哪里

## 流程建议

1. 用户按真实数据填充 `search-golden-set.json`
2. 起后端（配好 embedding）跑一轮 → 记录基线（可存 `results/` 下）
3. 数据量增长后复跑，对比优化前后
