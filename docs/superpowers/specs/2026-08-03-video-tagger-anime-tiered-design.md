# Video Tagger 番剧三层打标与检索 · 产品设计总结（v1）

- 日期：2026-08-03
- 状态：设计已确认，待实施
- 关联文档：需求讨论记录 `2026-08-03-video-tagger-anime-tiered-discussion.md` / 三期执行计划 `plans/2026-08-03-video-tagger-anime-tiered-phase1~3-plan.md`

## 1. 背景与定位

初版已实现「网页视频片段打标签 + 混合语义搜索 + 一键回看」的最小闭环，v0.2 完成功能深化（时间线 / 相似推荐 / 统计等）。本次需求把系统从**片段级**升级为 **「番剧 → 集 → 片段」三层结构**：

- 界面类似番剧网站（卡片墙、详情页、追番状态、收藏夹）
- 记录最近看番 / 电影（打过标记即算）
- 三层均可打标（番剧级概括 / 集级评价 / 片段级场景）
- 三层均可语义搜索（维度可选、可混合）

定位延续"工具 + 练手"双重属性：日常使用顺手可靠，同时保留 Milvus 向量检索等 RAG 练手价值。

## 2. 与 Bangumi 的重合度与核心差异

### 2.1 重合（管理 / 发现层，约七成）

| 功能 | Bangumi | 本项目 |
|---|---|---|
| 条目档案（标题 / 封面） | ✅ | ✅ |
| 追番状态 | ✅ | ✅ |
| 评分 | ✅ | ✅ |
| 作品级标签 | ✅ | ✅ |
| 收藏夹 / 目录 | ✅ | ✅ |

### 2.2 独有核心（Bangumi 完全没有）

| 能力 | 说明 |
|---|---|
| 时基定位 | 精确到秒，标记点沿时间轴排布 |
| 片段语义检索 | 自然语言召回具体场景 |
| 一键跳回 | 点击回到原视频对应秒数 |
| 三层打标 | 作品级概括 + 集级评价 + 场景级细节 |
| 相似片段顺藤摸瓜 | 找素材工作流 |
| 本地私有 | 数据完全自持 |

**一句话定性**：Bangumi 是"我看过什么"的社区档案（向外）；本项目是"我在哪里看到了值得回看的东西"的个人检索库（向内）。管理 / 发现层与 Bangumi 重合是为了让**打标核心有落脚点**，不可本末倒置。

## 3. 三层结构总览

```
番剧(anime)  ─┬─ 集(episode, 含季) ─┬─ 片段(clip, 精确到秒)
              │   season 可空        │   timestamp_sec
              │   episode_no         │
              └─ 电影 = 单集番剧 (type=MOVIE)
```

- **番剧级打标**：作品概括（热血 / 治愈 / 慢热…）
- **集级打标**：单集评价（神回 / 作画崩坏…）
- **片段级打标**：具体场景（高燃战斗 / 名场面…）
- 现有数据映射：`clips + video_fp` ≈ 「片段 + 集」；`title` 上移到集 / 番剧。

## 4. 数据模型

```sql
anime (
  id BIGINT PK, title VARCHAR(512) NOT NULL, aliases TEXT,
  type VARCHAR(16) NOT NULL,              -- ANIME / MOVIE
  status VARCHAR(16) NOT NULL,            -- WANT / WATCHING / DONE / PAUSED / DROPPED
  rating DECIMAL(2,1) NULL,               -- 手动评分
  cover_path VARCHAR(512) NULL,           -- 本地封面路径
  confirmed TINYINT NOT NULL DEFAULT 0,   -- 待确认标记
  created_at BIGINT NOT NULL
)
episode (
  id BIGINT PK, anime_id BIGINT NOT NULL,
  season INT NULL, episode_no INT NULL,
  title VARCHAR(512), url VARCHAR(2048) NOT NULL,
  video_fp VARCHAR(64) NOT NULL, created_at BIGINT NOT NULL,
  UNIQUE KEY (video_fp)
)
clip (
  id BIGINT PK, episode_id BIGINT NOT NULL,
  timestamp_sec DOUBLE NOT NULL, note TEXT,
  video_duration DOUBLE NULL, created_at BIGINT NOT NULL
)
collection ( id BIGINT PK, name VARCHAR(64) NOT NULL )
anime_collection ( anime_id BIGINT, collection_id BIGINT, PRIMARY KEY(anime_id, collection_id) )
tag ( id BIGINT PK, name VARCHAR(100) NOT NULL UNIQUE, created_at BIGINT NOT NULL )
anime_tag ( anime_id BIGINT, tag_id BIGINT )
episode_tag ( episode_id BIGINT, tag_id BIGINT )
clip_tag ( clip_id BIGINT, tag_id BIGINT )
```

标签语义：**无则建、有则关联**；三层关联表各自挂载，同名标签跨维度共享同一词条。

## 5. 番剧识别与归组机制

1. **打标主链路（快）**：标题**前缀 + 正则**提取番剧名 / 季 / 集号 → 匹配 / 创建番剧与集；**不调用 LLM**。
2. **LLM 后台归组（可开关）**：新保存的集标题进队列，后台判定别名一致性、修正归属、维护 `aliases`。
3. **手工确认兜底**：浮层小字展示识别结果（可改）；番剧列表「待确认」标记批量审核。
4. **改名 / 合并** 功能：纠正自动识别的错误归档。
5. 不同季归同一部番（`episode.season` 区分，可空）。

## 6. 分类体系

| 维度 | 模型 | 用途 |
|---|---|---|
| 追番状态 | `anime.status` 单选字段 | 筛选 |
| 内容类型 | `anime.type` 枚举（ANIME / MOVIE） | 筛选 |
| 收藏夹 | `collection` + `anime_collection` 多对多 | 筛选 / 清单整体浏览 |

**边界原则**：能枚举、用来筛选的进字段 / 收藏夹；自由文本、用来语义搜索的进标签。

## 7. 标签与搜索

- **标签词库**：全局 `tag` 表，三层关联；打标时无则建、有则关联。
- **向量化**：三层全向量化（番剧 = title + aliases + 标签；集 = title + 标签；片段 = tag + note），Milvus 为 RAG 练手核心。
- **搜索**：`GET /api/search?q=&dim=anime|episode|clip|mixed`；集为**独立搜索对象**；mixed 跨层融合（各维度 RRF 内排序 + 跨层排序）。

## 8. 封面与评分

- **封面**：扩展打标携带 `og:image` → 后端异步下载落盘 + `/covers/**` 静态映射；Web UI 手动上传 / 粘贴兜底；不上 minio。
- **评分**：`rating` 手动录入（十分制），无社区聚合。

## 9. 剩余风险

1. **Milvus 三层向量化实现**：三层共用需把主键从 `clip_id`(Int64) 改为组合主键 `(entity_type, entity_id)`，涉及 `MilvusVectorStore` 重构与旧向量迁移（方案已定，见 §12）。
2. **季 / 集号解析鲁棒性**：大量标题无季号，`season` 常为 null，属预期非 bug。
3. **混合搜索分栏效果**：分栏为初版形态，按实际体验再定是否调整（§12）。

## 10. 分三期规划

- **Phase 1 · 地基 + 番剧档案**：三层 schema + 迁移 + 标签词库/关联 + 番剧列表/详情页 + 手动创建/编辑/合并/改名 + 状态/评分/封面 + 最近观看 + 扩展保存链路改造。
- **Phase 2 · 检索升级**：三层搜索（维度 / 混合）+ 三层向量化 + Milvus 结构改造。
- **Phase 3 · 分类 + 智能**：收藏夹 + 筛选器 + 待确认批量审核 + LLM 后台归组 + 看完自动弹。

## 11. 范围界定（YAGNI）

本期不做：多用户 / 云同步 / 账号体系、评论讨论版、社区评分聚合、图片 / 音频内容 AI 分析、前端框架与构建链、局域网多端同步。

## 12. 已确认事项（原待确认）

- **Milvus 三层向量化**：单 collection + 组合主键 `(entity_type, entity_id)`（如 `A:1` / `E:2` / `C:3`），`entity_type` 为标量字段可按层过滤；三层共享同一 embedding 模型与维度。
- **历史数据**：无历史数据，不做迁移回填。
- **混合搜索展示**：分栏展示（番剧 / 集 / 片段各一栏），先看效果再定夺。
