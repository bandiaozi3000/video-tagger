# 推荐工作台「候选库多维度筛选」设计规格

- **日期**：2026-09-19
- **关联版本**：v0.30（待用户最终确认版本号）
- **状态**：**待审阅**（用户 2026-09-19 已拍板 7 项交互决策，本文档待批准后写执行计划；**尚未写任何实现代码**）
- **前置文档**：
  - `docs/superpowers/specs/2026-09-18-video-tagger-v029-recommend-editor-ui-design.md`（工作台现有三栏布局与视觉令牌）
  - 当日工作日志：`docs/worklog/2026-09-19.md`

## 1. 目标

候选库（左栏）的筛选从「三个内联下拉/输入」升级为**一个统一的筛选控件**：

1. **最外层常驻一个「添加筛选」入口**（＋ 筛选），点开是多维度取值面板；
2. **激活的筛选以可移除的 chips 呈现**，随时一眼看到"当前筛了什么"；
3. **能快速查找内容**：标题搜索常驻在最外层，7 个维度可自由组合（AND）；
4. 只影响**候选列表**的呈现，**绝不隐式改动已勾选/开场/片段**。

### 1.1 非目标（本轮明确不做）

| 不做 | 理由 |
|---|---|
| 排序控件（最近观看 / 评分 / id） | 用户 2026-09-19 决策 4：不做 |
| 同一维度多值（OR） | 决策 3：不要（后端每维只吃单值） |
| 「有片段 / 有本地视频」筛选 | 决策 6：不需要（那需要后端加 `HAVING COUNT(c.id)>0`） |
| 年份区间 / 近 N 年 | 后端 `year` 是 `=`，区间要新增参数；本轮不做 |
| OR / 嵌套条件组（Notion 式） | 复杂度远超需求（YAGNI） |
| 后端任何改动 | 本轮全部由既有 `/api/media`、`/api/media/count` 参数覆盖 |
| 改动会话重建逻辑（`sessionSignature`） | 筛选只影响"挑媒体"的 UI，不影响 RenderInput；刻意保持不变 |

## 2. 现状（实测事实）

### 2.1 现有 UI（`editor/panes.tsx` → `BasketPane`）

- `.vt-filters` 三个控件：收藏夹 `<select>`、年份 `<select>`、标签输入（回车 → `api.resolveTagId`）；
- 工具行：`☑ 全选本页`、`↻ 按筛选重算`（**会 `patch({ids: 全部命中})` 直接替换已选**）、`✕ 清除标签`、`清空`；
- `CandidateFilter = {collectionId, year, tagId, tagName}`，由 `main.tsx` 持有，随草稿/模板保存（`state.ts` 的 `buildPayload`/`parsePayload`，`parsePayload` 用 `{...defaultFilter(), ...}` 合并 → **新增可选字段天然向后兼容**）。

### 2.2 后端已有能力（读码得来，**本轮直接可用**）

`GET /api/media`（`MediaController.list` → `MediaMapper.listFiltered`）：

| 参数 | 语义 | 备注 |
|---|---|---|
| `q` | 标题 `LIKE '%q%'` | 可做搜索 |
| `collectionId` | 属于某收藏夹 | `/{id}/...` 列表另给 `mediaCount` |
| `year` | 首播年**精确**匹配 | `/api/media/years` 给可选值 |
| `format` | `media_format = code` | 值取 `/api/media-formats` 的 `code` |
| `subcategoryId` | 子分类**含子树**（递归 CTE） | `/api/media-formats` 的 `subcategories[{id,parentId,name,mediaCount}]` |
| `tagId` | 单个标签 | 值来源 `/api/tags/manage?q=&size=` |
| `status` | `WANT / WATCHING / DONE / PAUSED / DROPPED`（`MediaService.STATUSES` 为唯一真值） | 中文标签沿用媒体详情页：想看/在看/看完/搁置/弃番 |
| `confirmed` | `1`=已确认、`0`=待确认 | 媒体详情页现用 `confirmed=0` 表示"仅待确认" |

`GET /api/media/count`：同条件（**无 `ids`/`sort`**）→ 用于分页与"命中 N 部"。

`MediaSummary` 已有 `clipCount / rating / latestAt / confirmed / subcategory / mediaFormat / year` 等字段（本轮不新增字段需求）。

## 3. 交互设计

### 3.1 结构

```
候选库                                            共 137 部
┌───────────────────────────────────────┬──────────┐
│ 🔍 搜索标题…                       ✕  │ ＋ 筛选 ②│   ← 常驻行（永远在）
└───────────────────────────────────────┴──────────┘
[收藏夹 2024夏番 ✕] [标签 战斗 ✕] [状态 在看 ✕]        ← 仅激活项存在时出现
                                        ＋2  · 清除全部
· 命中 137 部 · 已选 3（1 部不在当前筛选内）
┌ ☑ 全选本页   ↻ 按筛选重算   清空 ┐                ← 工具行（沿用现状）
┌ 媒体卡片网格 ┐                                   ← 分页沿用现状
```

### 3.2 ＋ 筛选 面板（popover）

- **形态**：锚定在 `＋ 筛选` 按钮上的浮层，`createPortal` 到 `document.body`（左栏 `.vt-scroll` 有 `overflow: auto`，内联浮层会被裁剪），坐标由 `getBoundingClientRect()` 计算；宽度 ≈ 300–320px（与左栏同宽），`max-height: 320px`，内部滚动；窗口 resize/滚动时**关闭**（不做跟随）。
- **布局（相对上版草图的调整）**：改为**单列两段式** —— 面板先列维度（右侧显示当前值），点维度 → 切到该维度的取值列表，头部出现 `‹ 返回`。理由：左栏仅 346px（窄屏 300px），两列（维度 + 取值）会把取值列表压到 ~200px，长收藏夹/子分类名会截断。
- **维度顺序**（已设置的排最前，其余按固定序）：收藏夹 / 年份 / 格式 / 子分类 / 标签 / 状态 / 已确认。
- **生效时机**：取值点选**立即生效**（无"确定"按钮），面板保持打开以便连加；`Esc` 或点击面板外关闭。已激活的维度在面板里**直接显示当前值**，再选一个 = **替换**（本维度单值）。
- **取值选择器按维度类型**：
  | 维度 | 取值控件 | 说明 |
  |---|---|---|
  | 收藏夹 | 单选列表 | 数据已在 mount 拉取；条目可显示 `mediaCount`（标注为**全局计数**，可选） |
  | 年份 | 单选列表 | `api.years()` |
  | 格式 | 单选列表 | `/api/media-formats` → `{code, name}`，存 `code` |
  | 子分类 | 单选列表（可搜） | 展平所有格式的 `subcategories`，条目显示 `格式名 › 子分类名`（`parentId` 消歧），可显示 `mediaCount`（可选） |
  | 标签 | **搜索式选择器** | 输入 250ms 防抖 → `/api/tags/manage?q=&size=20` → 选中即存 `tagId + tagName`；无命中显示「没有这个标签」（**不创建标签**，避免副作用） |
  | 状态 | 单选列表 | 5 个固定值 + 中文标签 |
  | 已确认 | 单选：全部 / 已确认 / 待确认 | 映射 `confirmed=null / 1 / 0` |
- **面板底部**：一行 `命中 N 部`（与列表同条件）+ `清空全部`。

### 3.3 chips 行

- 每个 chip：`维度 值 ✕`；`✕` = 移除该维度；点击 chip 本体 = 打开面板并直接进入该维度的取值段。
- 行右侧：`清除全部`；chip 超过 2 行时折叠为 `＋N`（点一下在当前会话内展开，不持久化）。
- **标题搜索不进 chips**（它就是常驻搜索框），清空用框内 `✕`。
- 换行顺序 = 维度固定序，保证位置稳定（不会因改值而跳动）。

### 3.4 键盘与可达性

- `Esc` 关面板；面板内 `↑/↓` 移动、`Enter` 选中；搜索框空时 `Backspace` 移除最后一个 chip（Notion 式）；
- Tab 顺序：搜索框 → ＋筛选 → chips → 工具行；chip 的 `✕` 与本体是可聚焦按钮，带 `aria-label`（如「移除筛选：标签 战斗」）；面板为 `role="dialog"` + `aria-modal="false"`。

## 4. 数据与契约

### 4.1 `CandidateFilter` 扩展（`editor/api.ts`）

```ts
export interface CandidateFilter {
  q: string;                    // 新增：标题搜索（空串=不筛）
  collectionId: number | null;  // 既有
  year: string;                 // 既有（''=不筛）
  format: string;               // 新增：格式 code（''=不筛）
  subcategoryId: number | null; // 新增
  tagId: number | null;         // 既有
  tagName: string;              // 既有
  status: string;               // 新增（''=不筛）
  confirmed: number | null;     // 新增：null / 1 / 0
}
```

- `state.ts` 的 `defaultFilter()` 同步加上默认值 → 旧草稿/模板缺字段时自动回落为"未设置"，**行为不变**（`parsePayload` 已是浅合并）。
- 草稿/模板的 `config` 在后端是**透明 JSON 字符串**（`RecommendTemplate.config` / `RecommendPresetService`）→ **零后端改动**。
- `version` 保持 `2`（纯新增可选字段）。

### 4.2 请求映射（`api.media` / `api.mediaCount` 扩展参数）

| CandidateFilter | 请求参数 | 备注 |
|---|---|---|
| `q` | `q` | 空白串不发 |
| `collectionId` | `collectionId` | |
| `year` | `year` | 字符串 → 原样透传（后端 `Integer`） |
| `format` | `format` | |
| `subcategoryId` | `subcategoryId` | |
| `tagId` | `tagId` | |
| `status` | `status` | |
| `confirmed` | `confirmed` | `null` 不发；`0` 要**照发**（现实现 `if (query.confirmed)` 会漏掉 0 → 必须改为 `!= null` 判断） |

⚠️ **已知陷阱**：现有 `api.media/mediaCount` 用 `if (query.collectionId)` 这类真值判断，`confirmed=0` 与 `subcategoryId=0` 这类"假值"会被吞掉 → 新实现统一改成 `!= null` 判断。

## 5. 与「已选」的关系（硬约束）

1. **筛选只影响候选列表**：`config.ids` / `openingIds` / `mediaClips` 在任何筛选动作下都不变（切换筛选、清空筛选、搜索都不动）。
2. **`↻ 按筛选重算`**（决策 5，按推荐执行）：
   - 文案改为 `↻ 用当前筛选替换已选`；
   - 点击时先取当前筛选的**命中总数**（`/api/media/count`）：
     - 命中 ≤ 20 → 直接执行（保持轻快）；
     - 命中 > 20 → `window.confirm('将用当前筛选的 N 部替换已选的 M 部（其中 K 部手工挑选的会被移除），继续？')`（沿用编辑器既有守卫写法，见 `main.tsx:277`）。
   - 执行后：`ids = 命中 ids`（沿用现有 `limit:500` 一次拉取，命中 > 500 时提示"只取前 500 部"），`openingIds` 过滤保留。
3. **「已选未在当前筛选内」提示**（可选但建议保留）：当筛选激活且 `config.ids.length > 0` 时，额外请求 `/api/media?limit=<已选数>&ids=<已选 ids>&<当前筛选>` → 返回条数 = 命中数；`不在筛选内 = 已选总数 − 该值`。仅当 > 0 时在 chips 行末尾显示小字 `已选 3（1 部不在筛选内）`。

## 6. 边界与异常

| 场景 | 行为 |
|---|---|
| 命中 0 | 列表区显示「没有符合条件的媒体」+「清除全部筛选」按钮；chips 行保持可见（方便逐个摘） |
| 加载中 | 搜索框右侧小转圈；**不清空**当前卡片（避免闪白） |
| 筛选变更 | 一律回到第 1 页（沿用现状）；总数走 `/api/media/count`（同条件） |
| 字典接口失败 | 该维度取值列表显示「加载失败，点击重试」；不影响其他维度与列表 |
| 标签解析 | 取消失败/无此标签 → 不设置 chip，并就地提示「没有这个标签」（不再"静默清空 tagName"） |
| 窄栏 | chip 行最多 2 行；面板宽 300–320px；面板内长文本省略 + `title` 全文 |
| 模板兼容 | 旧模板无新字段 → 全部视为未设置，结果与升级前一致 |
| 快速连点维度 | 请求带 cancel 标记（沿用 `BasketPane` 现有 `cancelled` 模式），只认最后一次 |

## 7. 改动面（预估，供批准后写计划用）

| 文件 | 内容 |
|---|---|
| `backend/remotion/editor/api.ts` | `CandidateFilter` 扩字段；`media/mediaCount` 参数与真值判断修正；标签建议接口（`tags/manage` 已有 `resolveTagId`，改为返回候选列表） |
| `backend/remotion/editor/state.ts` | `defaultFilter()` 补齐新字段 |
| `backend/remotion/editor/panes.tsx` | `BasketPane`：常驻搜索行 + chips 行 + `FilterPopover` 组件 + 取值选择器 + 命中/已选提示 + 重算二次确认；**删除**原三个内联控件 |
| `backend/remotion/editor/editor.css` | `.vt-filter-pop`（浮层）、`.vt-chips`、`.vt-dim-list`、`.vt-value-list`、搜索行等；沿用现有 `--*` 令牌与 `.btn-mini` |
| `main.tsx` | 预计**不动**（`filter`/`onFilter` 已提升到编辑器层）；若需提交 `q` 防抖状态，也在 `BasketPane` 内闭环 |
| Java 侧 | **不动** |

## 8. 验收标准（可验证条目）

1. 旧草稿/模板加载后候选列表与升级前**完全一致**（无新字段 = 不筛）。
2. 7 个维度**逐个**选中 → `/api/media` 请求带上对应参数，列表与「命中 N 部」同条件变化；每个维度独立可移除。
3. 多维度组合 = AND（实测：选「收藏夹 X + 标签 Y」后，列表 ⊆ 收藏夹 X，且都带标签 Y）。
4. 任何筛选/搜索动作后，`已选` 数量与内容**不变**（除显式点「替换已选」）。
5. 「替换已选」在命中 ≤ 20 时无弹窗直接执行；> 20 时先弹 `window.confirm`，取消则不改动。
6. 命中 0 时出现空态与「清除全部筛选」，点击后恢复全量列表、chips 清空。
7. 键盘：`Esc` 关面板可复现；空搜索框 `Backspace` 能移除最后一个 chip。
8. 面板在左栏窄屏（≤1400px 时 300px）下不被裁剪、不溢出视口。
9. `tsc --noEmit` 干净；`vitest` 全绿；`npm run build:editor` 产物可用；8080 页面上手验（无头 Chrome 走一遍 3/4/6 三条）。

## 9. 风险与未验证

- **未验证**：`/api/media/count` 与 `/api/media` 在"多维度组合 + 标签 + 子分类"下的**性能**（尤其带 `q` 的 `LIKE '%…%'`）在 300 部规模无感，上万部规模未测。
- **未验证**：popover 在编辑器已有 `.vt-overlay`（片段弹窗）打开时叠加的表现（预计不会同时出现）。
- **取舍记录**：本轮不做"取值旁显示当前条件下的命中数"（每值一次请求，代价高、易误导）；仅可选显示**全局** `mediaCount`。
- 复用而非新造：确认弹窗用 `window.confirm`（编辑器既有写法）、chip/浮层样式复用现有令牌与 `.btn-mini`。

## 10. 决策记录（用户 2026-09-19 原话）

| # | 决策项 | 用户选择 |
|---|---|---|
| 1 | 选项包 | **B**（纯前端 8 维 → 去掉排序后为 7 维） |
| 2 | 面板形态 | **(a) 锚定 popover** |
| 3 | 同维度多值（OR） | **不要** |
| 4 | 排序 | **不要** |
| 5 | 「按筛选重算」 | **按推荐**：改文案 + 命中 > 20 二次确认 |
| 6 | 「有片段」筛选 | **不需要** |
| 7 | 原三个内联控件 | **直接替换** |
