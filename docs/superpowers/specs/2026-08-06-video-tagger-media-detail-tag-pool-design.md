# 详情页标签池（媒体/集/片段，v0.11）设计

> 需求：详情页标签展示不直观 → 标签池卡片形式 + 统计出现次数 + 每个标签颜色不一样，越高越明显。
> 媒体页拍板（ask 三问）：**三级聚合** / **替换现有标签区** / **按次数分级配色**。
> 集页拍板：**集内聚合**（新后端）；片段页拍板：**作品内热度**（零后端）。

## 现状

`renderDetailTags(d)`（app.js:1655）只渲染媒体**作品级**直接挂的标签（`d.tags`，media_tag 关联表），
统一灰色紫字 `.tag-chip` 一排，无次数、无主次、看不出热度分布。

## 方案

### 数据（零后端改动）
- 复用 `GET /api/tags/manage?mediaId={id}&page=1&size=1000` → `PageResult<TagUsage>`：
  `TagUsage.refCount` = 该媒体**三级聚合引用总数**（media_tag ∪ episode_tag ∪ clip_tag，v0.9 标签池
  `countByMedia` 口径），`id`/`name` 齐备。
- 合并作品级 `d.tags`：其 id 集合 → 标记「可删除」。
- 接口失败兜底：退回现状（只渲染作品级 d.tags），不让详情页因聚合挂掉。

### 渲染
- 聚合标签为主数据，**按 refCount 降序**排列。
- 每个标签一个 `tag-pool-chip`：
  - 标签名 + 次数徽标 `×N`
  - 作品级已挂载的标签带 × 删除按钮（`DELETE /api/media/{id}/tags/{tagId}`，删作品级关联；集/片段引用不动）
  - 纯片段/集引用（未挂作品级）的标签纯展示，无删除
- 保留「＋ 添加标签」输入框与补全（作品级添加），删除/添加后 `refreshMediaDetail` 全量重拉。

### 分级配色（次数越高越暖越明显，5 档）
| 档 | refCount | 样式 |
|---|---|---|
| stat-1 | 1 | 灰：淡灰底 + `#a3aec4` 字，常规 13px |
| stat-2 | 2–3 | 紫：`rgba(167,139,250,.15)` + `var(--violet)` |
| stat-3 | 4–6 | 粉：`rgba(255,77,141,.16)` + `var(--pink)` |
| stat-4 | 7–9 | 橙：`rgba(251,146,60,.2)` + `#fb923c`，字号 14px |
| stat-5 | 10+ | 金：`rgba(251,191,36,.22)` + `#fbbf24`，字号 15px + 柔和光晕 |

各档 hover 描边/发光延续现有 `.tag-chip` 动效语言。

### 交互闭环
- 排序稳定（count 降序，并列按 name）。
- 删除作品级标签后：该标签若有集/片段引用，次数不变仍展示（去掉 ×）；若彻底无引用，从池中消失。
- 添加标签后：新标签以 count=1 出现在池尾（排序最末，灰档）。

## 集标签池（用户追加：集标签也要改）

- **统计口径**（拍板）：**集内聚合**——集本身 `episode_tag` ∪ 其下片段 `clip_tag`，次数=集内引用总数（反映「这一集什么标签最热」）。
- **数据**：新增 `TagMapper.countByEpisode(episodeId)`（UNION 两表 + GROUP BY，同 countByMedia 模式）→ `TagAdminService.episodeStats` → `GET /api/tags/episode-stats?episodeId=` 返回 `List<TagUsage>`。
- **前端**：`renderEpisodeDetailTags(ep)` 改 async 拉 episode-stats + 合并 `ep.tags`（集标签可删 ×，`DELETE /api/episodes/{id}/tags/{tagId}`）+ 复用 `tag-pool-chip`/`tagStatTier`；保留添加输入框；接口失败兜底回集标签。标题「集标签」→「集标签池」。

## 片段标签池（用户追加：片段标签也要改）

- **统计口径**（拍板）：**作品内热度**——片段自身标签（`clip.tag` 拆词）+ 每个标签在整部作品里的引用次数（复用 `GET /api/tags/manage?mediaId=`，零后端）。
- **前端**：片段详情页新增「片段标签」区（`#clip-detail-tags`）；`renderClipTags(clip, mediaId)`：`clip.tag` 按逗号/中文逗号拆词 → 查作品内热度 Map → `tag-pool-chip` 渲染，count>0 带 ×N 徽标，count=0 灰档无徽标；纯展示（片段标签改动走片段编辑弹窗）。片段详情页原来无标签区，头部 meta 行的 `clip.tag` 文字保留。

## 范围
- 后端：新增 `countByEpisode`（TagMapper）+ `episodeStats`（TagAdminService）+ `/api/tags/episode-stats`（TagController）+ 2 例单测。
- 前端：`app.js`（renderDetailTags/renderEpisodeDetailTags 改造 + renderClipTags + tagStatTier 分档函数复用）、`app.css`（tag-pool-chip 五档，三处共用）、`index.html`（标题改标签池 + 片段标签区）。
- 分级配色五档（灰/紫/粉/橙/金）三处一致。
