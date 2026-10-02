# 标签功能重做 设计规格（v0.31）

- **日期**：2026-10-02
- **关联版本**：**v0.31**（`v0.30` 已被 2026-09-19 起的未归档批次占用；当前已归档版本为 **0.29.0**）
- **Flyway**：**V44**
- **状态**：**待用户审阅**（本文件批准前不写执行计划、不改代码）
- **前置文档**（本规格替代的设计，保留作过程存档）：
  - `docs/superpowers/specs/2026-08-03-video-tagger-anime-tiered-design.md`（三级打标的数据模型来源）
  - `docs/superpowers/specs/2026-08-06-video-tagger-tag-pool-design.md`（标签池：通用池 + 补全上下文化 + 管理页）
  - `docs/superpowers/specs/2026-08-06-video-tagger-media-detail-tag-pool-design.md`（媒体详情标签池）
- **关联执行计划**：待写（规格批准后）

---

## 1. 目标

把现有标签功能**当成一个新功能重做**，解决三个已实测的问题：

| 问题 | 实测证据（真库 `video_tagger`，2026-10-02） |
|---|---|
| **可用性低**：媒体级标签被收藏夹取代 | 有收藏的媒体 **1695**，有标签的媒体 **86**，且 **86/86 全部也进了收藏夹**（零独占） |
| **数据差**：词条爆炸 + 孤儿 | 词条 **171**，其中孤儿 **62（36%）**、只用过 1 次的 **84（49%）**、含 `，` 的非法词条 **12**（11 个是孤儿） |
| **口径分裂**：同一"标签"三套数 | 统计页 = **11**（数 `clips.tag` 字符串列）、标签管理页 = **171**（数 `tag` 表）、片段详情 = 按 `，` 切字符串（与词库口径不同） |

**具体成因**（实测）：`2026-08-07 01:18–02:57` 的 45 分钟里创建了 **15 个「X恋爱」变体**（恋爱番 / 治愈恋爱 / 校园恋爱 / 机甲恋爱 / 特摄恋爱 / 治愈音乐恋爱 / 校园青春恋爱 / 奇幻架空恋爱 / 恋爱神作 / 搞笑恋爱 / 喜剧恋爱 / 推理恋爱 / 恋爱，机械 …），最终只有「恋爱」留下并用了 9 部。**问题不是"选错词"，是"允许随手造词" + "同一概念双写"。**

**本版要拿到的东西**（不只是清数据）：

1. **受控词表**：打标只能从词库选 → 从源头消灭同义分裂。
2. **单一真源**：删掉 `clips.tag` 字符串列，`clip_tag` 成为唯一真源 → 改名/合并改一处即全链路生效，相似检索从子串匹配变精确。
3. **口径合一**：统计页 / 标签页 / 详情页数同一份数据。
4. **筛选可用**：多标签 AND/OR + 三级命中（媒体/集/片段任一层有即算）。
5. **规模化入口**：媒体页批量打标（沿用已有勾选模式）。

---

## 2. 已确认决策（用户 2026-10-02 逐条拍板）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 词表张数 | **1 张** `tag` 表，三层共用 |
| D2 | 准入 | **三层全部受控**：只能选已建词条；打标框内提供「＋新建词条并打上」 |
| D3 | 三级关系 | **写入不互通**（取消落库同步，`TagSyncService` 退役）；**读取按视角**（见 §4） |
| D4 | 筛选语义 | 多标签 **AND / OR**；**每个标签各自三级命中**（媒体/集/片段任一层有即算） |
| D5 | 筛选维度 | 媒体墙「标签」维度**保留**；NOT（不含）本版不做 |
| D6 | 老数据 | **5 处全清**（`tag` / `media_tag` / `episode_tag` / `clip_tag` / `clips.tag`），清除前单独备份 |
| D7 | `clips.tag` 列 | **删除**（`clip_tag` 成唯一真源） |
| D8 | 批量打标 | **做**：位置 = 媒体页勾选模式；支持**添加 / 移除**；后端**单端点**（不让前端循环） |
| D9 | UI 组件 | 一个 `TagPicker` 组件，**五个打标入口**复用 |
| D10 | 定位（标签 vs 收藏夹） | **边界先不定**：收藏夹管粗（大方向），标签管细；**允许部分重复**，看实际操作再议 |
| D11 | 删除范围下限 | 本版**不做**"停用/归档"、**不做**标签颜色/图标/嵌套、**不做**自动打标 |

---

## 3. 数据模型

### 3.1 现状（保留不动）

```
tag(id, name UNIQUE uk_tag_name, created_at)   ← 词表，唯一真源
media_tag(media_id, tag_id)   PK(media_id, tag_id)
episode_tag(episode_id, tag_id) PK(episode_id, tag_id)
clip_tag(clip_id, tag_id)     PK(clip_id, tag_id)
```

`tag.name` 的排序规则是 `utf8mb4_0900_ai_ci` → **大小写不敏感**已经被数据库兜住（`INSERT IGNORE` + `selectByName` 天然合并大小写变体），不需要应用层归一化。

### 3.2 本版改动（仅一处 DDL）

```sql
-- V44__tag_rework.sql
DELETE FROM clip_tag;
DELETE FROM episode_tag;
DELETE FROM media_tag;
DELETE FROM tag;
ALTER TABLE clips DROP COLUMN tag;
```

**为什么删列**（不是"留着不写"）：

1. 它已经是第二份真源，**且已经漏过一次**：`VideoSourceRemapService.confirm` 复制片段时抄了 `clips.tag` 字符串、**没抄 `clip_tag` 关联** → 重映射出来的片段"详情看得见标签、词库里查不到"（实测代码确认）。
2. 受控词表下**名字是词条的属性，不是片段的属性**。
3. 保留它 → 改名/合并还得靠 `TagAdminService.rewriteClipTags`（按空白分词精确替换、防子串误伤的 hack）去回写，纯白工。

**⚠️ 上线顺序（必须遵守，否则后端启动即报错）**

1. **先改代码**：删 `Clip.tag` 字段、把 4 处依赖该列的 SQL 改为查 `clip_tag`（此时列还在，改动对新旧库都安全）。
2. **再跑 V44**：清数据 + 删列。
3. 反序会失败：MyBatis-Plus 仍按 entity 生成含 `tag` 的 SQL → `Unknown column`。

### 3.3 清空前的备份（不可逆操作）

```bash
# 4 张标签表（含关联）
mysqldump -uroot -p --no-create-info --skip-add-locks video_tagger tag media_tag episode_tag clip_tag \
  > data/backup/tags-before-0.31.sql
# clips.tag 列（27 行）单独导出 CSV
mysql -uroot -p -D video_tagger --batch -e \
  "SELECT id, tag FROM clips WHERE tag IS NOT NULL AND tag <> ''" > data/backup/clips-tag-before-0.31.tsv
```

**注意**：备份监工只留 **3 代滚动**，约 2–3 小时就被覆盖 → 这次必须单独存一份。
**禁止**整库 dump 后随手灌回（`docs/rules.md` §14：dump 带 `USE video_tagger`，会写进真库，2026-09-20 真踩过）。

---

## 4. 读取规则：两个视角（本版语义核心）

D3 定了"各算各的"，但**筛选要求"命中一条就算"** —— 两者靠"写入不互通 + 读取分视角"同时满足：**并集只发生在查询期，不再落库**。

| 视角 | 数据范围 | 用在哪 |
|---|---|---|
| **媒体视角** —— 查询期三级并集 | 媒体自己有 ∪ 其下集有 ∪ 其下片段有 | ① 媒体墙**筛选**<br>② **筛选面板的标签选项字典**<br>③ **推荐视频资料卡标签行**<br>④ **导出清单**标签列 |
| **实体视角** —— 只看本级 | 只读自己的关联表 | 媒体 / 集 / 片段**详情页的标签池** |

**为什么选项字典也必须改成三级并集**：字典现在只读 `media_tag`。筛选改成三级命中后，若字典不跟着改，"只挂在片段上的标签"在面板里根本列不出来 → 用户以为筛不了。这与 2026-09-25 那次"只列真挂在媒体上的标签，避免 0 结果死选项"是同一判据，只是口径跟着筛选语义走。

**媒体视角的并集子查询**（抽成 `MediaMapper.TAG_UNION`，与既有 `GENRE_FILTER`/`SEASON_FILTER` 同套路）：

```sql
-- 一部媒体是否命中某标签（三级任一层有即算）
a.id IN (
  SELECT media_id FROM media_tag WHERE tag_id = #{tagId}
  UNION
  SELECT e.media_id FROM episode_tag et JOIN episode e ON e.id = et.episode_id WHERE et.tag_id = #{tagId}
  UNION
  SELECT e.media_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id
    JOIN episode e ON e.id = c.episode_id WHERE ct.tag_id = #{tagId}
)
```

**多标签语义**：
- **OR**：各标签的上述子查询用 `OR` 连接。
- **AND**：每个标签的上述子查询用 `AND` 连接（= 每个标签**各自**三级命中），
  **不要求**"同一条片段同时带这两个标签"。
  - 例：选 `名场面 AND 治愈` → A 片段的「名场面」+ B 集的「治愈」，同一个媒体下 → **算命中**。
- 性能：本库 `media_tag` 173 行 / `episode_tag` 37 行 / `clip_tag` 25 行，量级上无所谓；索引 `idx_clips_episode` 已在。

**纪律（§19 教训）**：`TAG_UNION` 谓词必须**同时**加到 5 条 SQL（`listFiltered` / `countFiltered` / `listByLatest` / `countLatest` / `listByCollection`）**+ `listExportRows`**。只加一部分 → "切到最近观看就静默忽略条件" = 静默错结果。

---

## 5. 打标入口：`TagPicker`（唯一交互）

### 5.1 行为契约

| 行为 | 说明 |
|---|---|
| 候选来源 | 前端缓存的全量词表（复用现有 `ensureTagPool()`，`GET /api/tags/manage?size=10000`）+ 输入时的后端前缀搜（`GET /api/tags?prefix=`） |
| 候选行 | **词条名 + 引用数**（引用数是"该复用还是该新建"的决策依据） |
| 键盘 | `↑↓` 选择、`Enter` 选中、`Backspace` 退格删最后一个 chip、`Esc` 关面板 |
| 无匹配 | 末行「**＋ 新建词条『xxx』并打上**」→ 调 `POST /api/tags` 拿 id 后立即打上（**一次交互完成两跳**，这是受控可用的关键） |
| 已选 | chip 呈现，`×` 移除 |
| 落库时机 | 弹窗场景：**保存时**落库；详情页池场景：**点选即落库** |
| 多选 | 一次可加多个 |
| **受控的硬保证** | **后端**：打标接口只收 `tagIds`，不在词表的名字一律 `400`。前端不给自由文本提交入口（双保险） |

### 5.2 五个入口（全部替换现有自由文本输入）

| # | 入口 | 现状 | 改造 |
|---|---|---|---|
| 1 | Web 片段创建/编辑弹窗 | `#edit-tag` 自由文本 + datalist | 换 `TagPicker` |
| 2 | 集打标弹窗 | `#episode-tag-input` 自由文本 | 换 `TagPicker` |
| 3 | 媒体 / 集详情「＋添加标签」池 | 自由文本（集池连补全都没有） | 换 `TagPicker` |
| 4 | **浏览器扩展**：浮层 + 快捷位 `Ctrl+Shift+1~9` | `quickTags[1..9]` 存自由文本（`extension/options.js:31`） | **快捷位改绑 `tagId`**（选择器选词条）；浮层换简化版 `TagPicker`。**不改就是绕过受控的后门** |
| 5 | Animeko 现场打标 / 本地回顾弹窗 | 自由文本 | 换 `TagPicker` |

### 5.3 接口改造（受控的直接体现）

| 端点 | 现在 | 改为 |
|---|---|---|
| `POST /api/clips`（body.tag） | 收字符串，自动建词条 | 收 `tagIds: number[]`；不再建词条 |
| `POST /api/episodes/{id}/tags` | `{tag: "名字"}` | `{tagIds: [..]}` |
| `POST /api/media/{id}/tags` | `{tag: "名字"}` | `{tagIds: [..]}` |
| `POST /api/episodes/by-url/tags` | `{url, tag}` | `{url, tagIds}` |
| `AnimekoTagService.tag` | `TagRequest.tag` 字符串 | `tagIds` |
| `POST /api/tags` | 建词条（沿用） | 不变，但成为**新建词条的唯一边** |

**连带清理**（受控后没有存在意义）：

- `removeTag` 之外的"打标即建词条"逻辑（`MediaService.ensureTag` / `EpisodeService.addTag` 的 `insertIgnore` / `ClipService.linkClipTags` 的建词条）
- `TagSyncService` 全部（`syncFromClip` / `syncFromEpisode` / `syncAll`）→ **删除**
- `POST /api/tags/sync-all` 端点 + 标签页「⇄ 同步历史标签」按钮 → **删除**
- `TagAdminService.rewriteClipTags`（字符串列回写）→ **删除**
- 新增：`tagIds` 写入用统一入口 `TagLinkService.link(entityType, id, tagIds)`（含受控校验 + 重嵌入队），五个入口全走它

---

## 6. 多标签混合筛选

### 6.1 交互

- **两处共用一套语义**：媒体墙「标签」维度 + 推荐编辑器候选库「标签」维度（判据同 2026-09-25 重构：语言与后端参数必须同源）。
- 右栏「标签」区：搜索框 + **带计数**的可点条目，**点选即时生效、面板不关**（沿用现有手感），可连点加多个。
- 面板顶部一个分段控件 **`全部匹配 / 任一匹配`**，**默认「全部匹配」（AND）**（多标签的直觉是"越点越窄"）。
- chip 文案把模式写出来，别让用户猜：`标签：名场面 且 治愈` / `标签：名场面 或 治愈`。
- 取值字典（`dimValues`）显示的是"**有该标签（任一层）的媒体数**"（`COUNT(DISTINCT media_id)`）。

### 6.2 后端参数

`tagIds`（数组，替代现在的单值 `tagId`）+ `tagMode`（`AND` | `OR`，默认 `AND`）。旧参数 `tagId` 删除（无历史包袱，前端同一版一起改）。

### 6.3 边界：媒体墙只筛"媒体视角"

片段级筛选**不进**媒体墙标签维度（那会与"各算各的"的显示语义打架）。片段筛选的落点是 §7。

---

## 7. 片段侧：让标签真正有用

**实测缺口**：推荐编辑器的 `ClipPicker`（`backend/remotion/editor/panes.tsx:410`）现在只显示 **标题 + 时间戳**，`ClipBrief`（`editor/api.ts:175`）里连 `tag` 字段都没有 → **片段标签的唯一用途是"以后挑片段做成片"，而挑片段的界面里看不见也筛不了标签。**

本版补上：

1. `ClipPicker` 每行显示标签 chip。
2. `ClipPicker` 顶部加标签筛选（多选，语义同 §6）+ 「只看已选 / 未选」。
3. `/api/clips/media/{id}` 返回体带 `tagIds` / `tagNames`（`ClipBrief` 类型同步加字段）。
4. 媒体详情页的片段列表同样显示标签（复用同一渲染）。
5. 相似片段（`/api/search/similar`）召回从 `clips.tag LIKE '%token%'` 改为 `clip_tag` 交集 —— 顺带修掉子串误伤（现在 `恋爱` 会命中 `恋爱番`）。

---

## 8. 批量打标（媒体页勾选模式）

**位置**：媒体页底部已有的批量工具条（`index.html:158`），现状：

```
[☑ 全选本页]  [＋ 收藏夹(0)]  [🗑 移入回收站(0)]  [取消]
```

→ 加 **`[🏷 标签(0)]`**，点开即 `TagPicker` + `添加 / 移除` 切换 → 应用到已勾选媒体。

**为什么不放标签页**：

| | 媒体页勾选 | 标签页发起 |
|---|---|---|
| 动线 | 对象先选（看的是媒体），动作后选 ✅ | 先选词条，再去 5248 部里挑哪几部 ❌ |
| 现成能力 | 勾选模式 + 全选本页 + 底部工具条**全有** | 要新造一个巨型媒体选择器 |
| 心智 | 与「批量加入收藏夹」完全同构 ✅ | 与词表运维混在一起，职责不清 |

标签页的正确动作是**反查**（§9），不是发起打标。

**接口**：`POST /api/media/tags/batch`

```json
{ "mediaIds": [1,2,3], "tagIds": [12,13], "action": "add" }
```

- **一次事务 + `INSERT IGNORE`/`DELETE` 幂等**，不让前端循环（勾 200 部就是 200 个请求，慢且难回滚）。
- `action: "add" | "remove"` —— 同一处支持移除，否则打错一整批只能一部部进详情页删。
- 范围**只处理已勾选的媒体**（`mediaSelected` 已支持跨页累积）。**不做**"按当前筛选条件对 5248 部全量应用"（误伤面大，且需要异步任务 + 进度条）。

**为什么是第一版必做**：媒体级标签现在 86/5248，一部一部点详情页永远起不来。典型用法：筛「异世界」549 部 → 全选本页 → `🏷 标签` 加「异世界种田」。

---

## 9. 标签管理页改造

**定位变化**：受控后它从"清理垃圾的地方"变成**词表的唯一运维台**。

| 项 | 现状 | 本版 |
|---|---|---|
| 列表 / 搜索 / 分页 | 有（`/api/tags/manage`） | 不变 |
| 新增（批量输入、去重、撞名提示） | 有（`＋新增标签` 弹层，已支持空格/逗号拆分 + 实时去重预览） | 不变（受控后它变成**高频入口**） |
| 改名 / 合并 / 删孤儿 / 批量删 | 有 | 不变 |
| **使用位置反查** | **无** | **新增**：点引用数 → 列出哪些媒体 / 集 / 片段在用（分三组，可跳转）。接口 `GET /api/tags/usage?tagId=` |
| 合并影响面预览 | 无（只有一个目标下拉） | **新增**：显示 `源 N 处 / 目标 M 处 → 合并后 N+M 处`，二次确认（合并不可撤销） |
| 合并目标选择器 | `<select>` 灌全量词条（词条一多就没法用） | 复用 `TagPicker` 的搜索选择 |
| 「按媒体」页签 | 有 | 保留（三级并集展示，只读视角） |

---

## 10. 口径合一（修掉"三套数"）

| 位置 | 现在 | 改为 |
|---|---|---|
| 统计页「标签数」 | `clipMapper.countDistinctTags()`（数 `clips.tag`，= 11） | 数 `tag` 词表 |
| 统计页「最常用标签」 | `clipMapper.countTags()`（`clips.tag` GROUP BY） | `clip_tag JOIN tag` GROUP BY（**片段级**口径，并标注清楚） |
| 标签页 | `tag` 表（171） | 不变（词表就是词表） |
| 片段详情标签 chip | `clips.tag` 按 `，,` 切 | `clip_tag JOIN tag` |
| 全文检索命中标签 | `clips.tag LIKE` | JOIN `tag`（`tag.name LIKE`） |

---

## 11. 影响面清单（要改的文件/模块）

**后端**

- `entity/Clip.java`：删 `tag` 字段
- `mapper/ClipMapper.java`：`findSimilarByTag`（改 `clip_tag` 交集）、`fullTextSearch`（改 JOIN tag）、`countDistinctTags`/`countTags`（改口径）、`updateTag`/`selectByTagContains`（删除）
- `mapper/MediaMapper.java`：新增 `TAG_UNION` 常量并加进 5 条 SQL + `listExportRows`；`listTagCounts` 改三级并集
- `mapper/TagMapper.java`：新增 `usageOf(tagId)`（三组使用位置）、`countByMediaIds` 保留
- `service/TagSyncService.java`：**删除**
- `service/TagAdminService.java`：删 `rewriteClipTags`；加 `usage()`、合并影响面、`validateTagIds()`
- **新增** `service/TagLinkService.java`：受控校验 + 三张关联表写入/删除 + 重嵌入队（五个入口共用）
- `service/MediaService.java` / `EpisodeService.java` / `ClipService.java` / `ReviewClipService.java` / `AnimekoTagService.java`：打标入口改收 `tagIds`，去掉建词条
- `service/RecommendService.java`：`loadRenderMedia` 的标签来源改为查询期并集（语义不变，数据源改）
- `service/HighlightCardRenderer.java`：同上
- `service/StatsService.java`：口径改 §10
- `service/VideoSourceRemapService.confirm`：**补** `clip_tag` 关联复制（现在漏抄）
- `controller/TagController.java`：删 `/sync-all`；加 `/usage`；`/manage` 保持
- `controller/MediaController.java`：加 `POST /tags/batch`；`POST|DELETE /{id}/tags` 改 tagIds
- `controller/EpisodeController.java`：同上
- `mapper/EmbeddingTaskService`：不变（受控后标签文本更干净，向量质量自然提升）
- **新增迁移** `V44__tag_rework.sql`

**前端（Web）**

- `static/app.js`：`TagPicker` 组件（新增）；五处打标入口替换；筛选维度改多选 + `tagMode`；媒体卡显示前 2 个标签 chip；批量工具条加 `🏷 标签`；标签页加反查/合并预览；统计页口径；`renderClipTags` 改读 `tagIds/Names`；删「同步历史标签」按钮
- `static/index.html`：批量工具条加按钮；标签页占用位置不变
- `static/styles.css`：`TagPicker` 样式（贴合既有 chip / 浮层语言）

**前端（推荐编辑器）**

- `remotion/editor/panes.tsx`：`ClipPicker` 加标签显示 + 筛选；候选库筛选维度改多选 + `tagMode`
- `remotion/editor/api.ts`：`Filter.tagIds: number[] | null` + `tagMode`；`ClipBrief` 加 `tagIds/tagNames`

**扩展**

- `extension/options.js` / `options.html`：快捷位改"选词条"（存 `tagId`）
- `extension/content.js`：浮层换简化 `TagPicker`；提交改 `tagIds`

---

## 12. 验收口径

**清空与结构**

1. 备份文件存在且非空：`data/backup/tags-before-0.31.sql`、`clips-tag-before-0.31.tsv`。
2. 跑完 V44 后：`tag` / `media_tag` / `episode_tag` / `clip_tag` 四表 **计数 = 0**；`SHOW COLUMNS FROM clips` 无 `tag` 列。
3. 后端启动无 SQL 错误（`Unknown column 'tag'` 不会出现）。

**受控**

4. `POST /api/media/{id}/tags` 传任意名字 → **400**（不是自动建词条）。
5. 传合法 `tagIds` → 关联表出现该行，且词表**没有**新增词条。
6. `TagPicker` 输入不存在的名字 → 出现「＋新建词条『xxx』并打上」；点它 → 词表新增 1 条 **且** 该媒体已挂上。

**三级命中（D3/D4 的核心回归用例）**

7. 给某媒体下的**一个片段**打标签「回归探针」，**不碰媒体级**：
   - 媒体详情标签池**看不见**「回归探针」（实体视角，各算各的）✅
   - 媒体墙筛「回归探针」→ **命中该媒体**（媒体视角，三级并集）✅
   - 筛选面板的标签选项里**能列出**「回归探针」且计数 ≥ 1 ✅

**多标签筛选**

8. `tagIds=[A,B] & tagMode=AND`：A 在片段、B 在集 → 该媒体**命中**（验证"各自三级命中"）。
9. `tagMode=OR` 结果 ⊇ `AND` 结果；切到「最近观看」tab 条件**仍然生效**（§19 那 5 条 SQL 全加了）。

**批量打标**

10. 勾 3 部媒体 → `🏷 标签` 加「批量探针」→ 3 部全部挂上，词表只有 1 条「批量探针」；再执行一次 **不报错**（幂等）。
11. 同处「移除」→ 3 部全部摘掉。

**片段侧**

12. `ClipPicker` 显示标签 chip；按标签筛出的片段集合 = 该媒体下带该标签的片段数。
13. 相似片段：给一个带「恋爱」的片段找相似，**不再命中只有「恋爱番」的片段**（子串误伤已修）。

**口径合一**

14. 统计页「标签数」= 标签管理页「通用池」总数（同为 `tag` 表行数）。

**回归**

15. 后端 `mvn test` 全绿（`TagAdminServiceTest` / `TagSyncServiceTest` 需按本规格重写——后者对应服务已删除）。
16. 编辑器 `npm test` + `typecheck` + `build:editor` 全绿。
17. 媒体墙卡片（含列表视图/回收站/收藏夹视图）与详情页不因删列报错。

**只读探针命令**（供人工复核，勿在真库乱写）

```bash
docker exec vt-mysql mysql --default-character-set=utf8mb4 -uroot -proot123456 -N -B video_tagger -e "
SELECT 'tag',COUNT(*) FROM tag
UNION ALL SELECT 'media_tag',COUNT(*) FROM media_tag
UNION ALL SELECT 'episode_tag',COUNT(*) FROM episode_tag
UNION ALL SELECT 'clip_tag',COUNT(*) FROM clip_tag;"
```

---

## 13. 本版明确不做（YAGNI）

| 不做 | 理由 |
|---|---|
| 标签 vs 收藏夹的职责边界整顿 | 用户 D10：先看实际操作，允许部分重复 |
| 标签颜色 / 图标 / 嵌套层级 | 层级归收藏夹与分类管；加了只会再造一套分类体系 |
| `scope` 列（按级别限制可用范围） | D2 已定三层全部受控，分级策略无当前需求；真需要时再加一列即可 |
| 「停用 / 归档」词条 | 受控后孤儿极少；不想要某个词条时，**合并**是主出路（已有），删孤儿（已有）兜底 |
| NOT（不含）筛选 | 现有所有维度都没有排除语义，单独给标签加一个不顺；有真实需求再补 |
| 自动打标 / 标签推荐（AI 猜） | 先把人手打的那点量做扎实；输入脏的时候做自动打标只会放大噪声 |
| 标签云可视化 | 词条预期几十到几百，列表 + 计数比云好用 |
| "按筛选条件对全库批量打标" | 误伤面大，需要异步任务 + 进度条；本版只做已勾选媒体 |
| 标签使用趋势图 | 统计口径先合一，趋势是后话 |

---

## 14. 风险与遗留

| 风险 | 说明 | 处置 |
|---|---|---|
| **清空不可逆** | 5 处全清是用户明确要求（D6） | 单独备份 4 表 + `clips.tag` TSV；本次备份不参与 3 代滚动 |
| 删列顺序 | 先跑 V44 再改代码 → 后端启动即 `Unknown column` | §3.2 的上线顺序写进执行计划，作为验收项 |
| 老草稿的引用级标签显示开关 | 草稿里只有 `detailShow.tag` / `tailShow.tag` 布尔（实测 `JSON_SEARCH` 只命中这一处，无标签文本） | 清空**不破坏草稿**，只是渲染时标签行变空 |
| 向量文本变脏 | `embedding_tasks` 中 **MEDIA 250 + CLIP 1** 已成向量，媒体向量把标签名拼进文本 | 清空后需重嵌这些实体。**当前 Milvus 容器未启动**（`docker ps` 仅 vt-mysql），实际影响为零；**重新启用向量检索前必须重嵌** |
| 受控后的摩擦 | 一次性碎语（`老二次元参加工作后的心声`）需要先建词条 | 靠「＋新建并打上」抵消（一次交互）；若实测仍劝退，升级路径 = 给 `tag` 加 `scope` 放开片段级 |
| 桌面端（SQLite） | 冻结中（§13）；`sqlite-schema.sql` / `migration-sqlite/` 不同步 | 不维护；`Clip` entity 删字段后桌面版仍可用（列还在内存不读） |

---

## 15. 审阅与变更记录

| 日期 | 变更 | 状态 |
|---|---|---|
| 2026-10-02 | 初稿（基于 2026-10-02 三轮问答：三级不互通 / 全部受控 / 全部清空 / 筛选三级命中 / 批量打标在媒体页） | 待用户审阅 |
| 2026-10-02 | 按「日期 + 版本」命名规范改名（`2026-10-02-video-tagger-v031-tag-rework-design.md`）；版本号从 v0.30.0 更正为 **v0.31**（0.30 被 09-19 起的未归档批次占用）；头部改为既有规格的统一格式并补前置文档 | 待用户审阅 |
