# v0.28 推荐工作台（Remotion 原生编辑器化）设计规格

- **日期**：2026-09-18
- **关联版本**：**v0.28**（用户 2026-09-18 拍板）
- **状态**：**已批准**（2026-09-18 经五轮 Grilling 逐项拍板；用户同日批准，装载方式按 **A 单页挂载**）。本规格**不含任何代码改动**；配套计划：`docs/superpowers/plans/2026-09-18-video-tagger-v028-recommend-editor-plan.md`（待确认后开工）。
- **前置文档**：
  - v0.27 渲染链路重写：`docs/superpowers/specs/2026-09-18-video-tagger-remotion-native-recommend-design.md`
  - 当日工作日志：`docs/worklog/2026-09-18.md`
  - 本次 Grilling 的实测探针：`backend/remotion/probe/`（脚本随本轮落地保留）

---

## 1. 目标

把推荐功能从**"填四步表单 → 点确认渲染 → 整页重载预览"**，改造成**"一屏编辑器：改参数即时看到、时间轴直达、就地编辑"**：

1. **即时性优先**：滑块/输入改动 **≤100ms** 内反映到预览（`inputProps` 热更新，不重载页面、不重建素材）。
2. **可预期性**：时间轴把"哪些段、多长、哪一部"变成可见可点；选中对象 = 正在编辑的对象。
3. **配置可复用（系列化）**：模板升级为「配置 + 候选筛选条件 + 变体」，支持每月换一批媒体重出、同批媒体出多版本。
4. **素材不再重复劳动**：片段优先复用已物化的产物，避免每次预览/导出重裁。
5. 不改动成片渲染语义：同一 Composition、同一视觉令牌、同一导出链路。

### 1.1 非目标

- 不改媒体/片段业务模型、不改媒体库（`view-media`）与高光项目；
- **不碰 `single-preview`**（高光项目的「模板预览」，`HighlightProjectController:131` → `RecommendSingleService`；`index.html:329` + `app.js:6045` 在用，是活功能）；
- 不动 Remotion 渲染语义（场景模型、音频内建、ducking、视觉令牌、门禁**除外**本文明确列出的项）；
- 不改导出任务队列的接口形态与产物目录/命名（`data/exports`、`/video/tasks*`）；
- 不做桌面端（Electron/SQLite）同步、不做 Docker/云端/Lambda 渲染；
- **不做** Java 侧参数重载合并、`clamp` 真值收归（单列后续批次，见 §2 硬边界）；
- 不做多轨时间线、字幕轨、FCPXML/OTIO 导出。

---

## 2. 已确认决策（五轮 Grilling，2026-09-18）

| # | 决策 | 依据 / 轮次 |
|---|---|---|
| 1 | 目标场景 = **系列化高频出片**（每月固定出片，配置复用）→ 选 **A 完整编辑器化** | R1-Q1 |
| 2 | 痛点优先级 = **即时性 > 可预期性 > 风格** | R1-Q2 |
| 3 | 范围 = **只动推荐向导**；`single-preview` 保留不碰 | R1-Q3（`index.html:329`/`app.js:6045` 核查） |
| 4 | **不留旧向导开关，直接替换** | R1-Q4 |
| 5 | 主题允许偏离现有视觉语言；**第一版必须含 1 套 = 今天 chapter 外观** | R1-Q5 |
| 6 | 性能预算：滑块 **≤100ms**；片段首次准备 **≤30s（进度可见）**、之后即时；导出等待**维持现状** | R1-Q7 |
| 7 | **不兼容旧草稿/模板**；`recommend_draft`/`recommend_template` 重建、旧行清掉（用户明确接受清数据） | R2-Q1 |
| 8 | **一屏编辑器替换四步向导**，分 4 阶段落地、每阶段可用 | R2-Q2 |
| 9 | 系列化 = **① 同配置换媒体重出 + ② 同批媒体多版本** | R2-Q3 |
| 10 | 候选媒体 = **筛选条件可保存进模板 + 套用重算 + 人工微调**（新增能力，单列 scope） | R2-Q4 |
| 11 | 批量导出 = **同配置多版本**（如 30s 短版 + 完整版；竖/横）；**不做**按分组各出一条 | R2-Q5 |
| 12 | 载体 = **页内替换 `view-recommend`**；保留 `#titlebar/.sidebar/.statusbar/.container` 四容器 | R3-Q1 载体 |
| 13 | Inspector = **对象轴**（选中谁配谁），步骤语义退化为分组标题 | R3 |
| 14 | 片段配置 = **搬进时间轴**；原片段弹窗只保留"批量挑选片段" | R3 |
| 15 | 配置模型 = **模板 = 配置 + 候选筛选 + 变体**；草稿退化为会话暂存 | R3-Q5 |
| 16 | 帧溢出 = 跳到**当前所在段的新段首**；段已不存在 → 最近的前一段段首 | R4-Q1 |
| 17 | 片段素材 = **混合策略**：优先复用 READY 物化产物（探编解码，h264+aac 直用；否则重编码一次进会话缓存） | R4-Q2 |
| 18 | 失败态 = **降级不阻断**（段级标黄 + 导出前拦截；预览包缺失 → 预览区禁用 + 可复制命令） | R4-Q3 |
| 19 | 缩略图 = **懒加载可视段 + 会话缓存 + 后台串行** | R4-Q4 |
| 20 | 保存 = 会话暂存**自动节流（~1s 防抖）**；模板**显式命名保存** | R4-Q5 |
| 21 | 门禁 = 新增**色彩标注断言** + **"热更新保帧"回归断言**；真实音频断言列「待素材」 | R4-Q6 |
| 22 | 顺带修：色彩 full-range、渲染超时死代码、孤儿端点 `/prepare-clips`；前端"总时长 `--:--`"死链路随编辑器重做消失 | R5-Q1 |
| 23 | 版本 = **v0.28** | R5-Q2 |
| 24 | 重构深度 = **只做与编辑器直接相关**（每帧 O(n) 查找索引化、`resolveParams` 双算合一、`useMemo` 收口）；**不做** Java 32 参数重载合并与 clamp 收归 | R5-Q3 |

**硬边界（不越线）**

- 只动推荐向导；`single-preview`、媒体库、高光项目不动；
- 保留四个容器 DOM 约定（`AGENTS.md` 冻结条款）；
- 删除清单里的文件**在计划确认前不删**；
- 门禁不假装覆盖：真实音频断言明确列为「待素材」。

---

## 3. 现状与依据

### 3.1 现状痛点（读码定位）

| 痛点 | 位置 | 后果 |
|---|---|---|
| 改参数只是标记 `previewDirty`，必须点「确认渲染」 | `app.js:4539-4552` | 每调一次等一轮 |
| 每次预览新建 token 目录 + **重裁全部片段** | `RecommendController:87-91`、`RecommendClipSourceService.prepare`（`outputs` 只在单次调用内去重） | 有片段时每次预览重跑 ffmpeg |
| 预览整页 `srcdoc` 重载 | `app.js:4572` | 播放进度归零，无法对比改前/改后 |
| 有已物化的片段产物却不复用 | `ClipMaterializationService`（GENERATED_CLIP + READY）vs 推荐链路从整集源重裁 | 重复劳动 |
| 风格 = 十几个滑块 | `index.html:1486-1600` | 调不出"好看"，只能调出"不一样" |
| 总时长永远 `--:--` | `app.js:7943-7971` + `computeRecommendDuration`，依赖旧 HTML 预览的 `preview-structure` 消息 | 黑盒：片子多长得导出后才知道 |
| 四步向导 + 配置弹窗两处分工 | `index.html:650-830` / `1486+` | 参数归属靠记忆 |

### 3.2 实测证据（本轮探针，可复现）

**探针① 热更新 `inputProps`**（`backend/remotion/probe/`，puppeteer-core + 系统 Chrome，无头）

| 场景 | 实测 |
|---|---|
| `seekTo(90)` | 帧 = 90 |
| 热更新（时长不变） | 帧仍 90（**保帧**） |
| 热更新（570→930 帧） | 帧仍 90 |
| **播放中**热更新 | `isPlaying` 仍 true，帧继续前进（60 → 74） |
| 边界：seek 925（总 930）后缩到 480 帧 | 自动钳到 **479**（末帧） |

复现：`cd backend/remotion && npm run probe:player`（脚本随本轮落地）

**探针② 渲染成本**

| 项 | 实测 |
|---|---|
| `bundle()` | 6774 ms |
| 浏览器启动（冷/暖） | 328 / 231 ms |
| `selectComposition` | 347 ms |
| 热 still（同一浏览器连渲） | 601 / 578 / 515 ms（均值 ~0.55s/张） |

复现：`npm run probe:cost`。→ 结论：**每次导出重付的 6.8s bundle 不值得为它上常驻渲染服务**（收益上限即此）。

**导出色彩（既有缺陷）**

```
ffmpeg -hide_banner -i "data/exports/Remotion原生验收-最终.mp4" | grep Stream
# → h264 (High) yuvj420p(pc, bt470bg/unknown/unknown)   ← full-range、无标注
```
`render-recommend.ts` 传了 `pixelFormat: 'yuv420p'`，但 Remotion 4.x 的 `colorSpace` 默认 `"default"`= 全范围；本机 `@remotion/renderer@4.0.524` 确有 `colorSpace?: 'bt709' | 'bt601' | 'bt2020-ncl' | 'default' | null`（`render-media.d.ts:137`）。

**自家素材的色彩标注（对照）**

```
data/video-assets/.../asset-18.mp4 → h264/aac, yuv420p（limited）
data/video-assets/.../asset-21.mp4 → h264/aac, yuv420p(tv, bt709)
```
→ 我们的导出**与自家素材都不一致**。

**物化产物的编解码风险（影响 §8）**

`ClipMaterializationService.cut()` 用 **`-c copy`**（`ClipMaterializationService.java:49`）→ 产物编解码**继承源片**；动漫 BDRip 常见 HEVC/AV1，Chromium 解不出 → 预览黑屏。上面两份现成产物恰好都是 h264+aac（不能证明普遍安全）。

**Player 能力（读类型定义核验）**

- `PlayerRef`：`seekTo / getCurrentFrame / play / pause / mute / setVolume / requestFullscreen`；事件 `frameupdate / seeked / play / pause / ended / volumechange`（`@remotion/player@4.0.524` `player-methods.d.ts`、`event-emitter.d.ts`）；
- `PlayerProps` 含 `inFrame / outFrame`（范围播放）、`renderCustomControls`、`playbackRate`；
- **`Thumbnail` 组件存在**（`dist/cjs/index.d.ts:11`）→ 单帧可在**浏览器内**渲染，缩略图不必走 Node 渲染器。

---

## 4. Remotion 能力基线（本次改造的支点）

| 能力 | 用途 | 证据状态 |
|---|---|---|
| `inputProps` 热更新不重置帧/播放 | 参数即时生效、就地拖拽 | **已实测**（探针①） |
| `seekTo` / `frameupdate` | 跳段、时间轴游标 | 类型定义 + 探针① |
| `inFrame` / `outFrame` | 范围预览（只循环当前段） | 类型定义（**行为未实测**） |
| `Thumbnail`（浏览器内单帧） | 时间轴缩略图 | 类型定义（**耗时未实测**，见 §14 阶段 2 探针） |
| `buildScenePlan()` 纯函数在 bundle 内 | 时间轴本地即时计算 | 现网代码已具备 |

---

## 5. 工作台形态

### 5.1 布局（页内替换 `view-recommend`）

```
┌──────────────────────────────────────────────────────────────────┐
│ 工具栏：[模板 ▾]  状态：已保存/未保存   [预览播放▷] [导出 ▾]      │
├──────────────┬───────────────────────────────────┬───────────────┤
│ 媒体篮子      │        Player（就地编辑）          │ Inspector     │
│ · 筛选(标签/   │  · 播放/暂停/进度/全屏（Player 自带）│ 选中对象轴：   │
│   年份/来源)   │  · 拖 BGM 条（x/y）+ 缩放          │ · 全局        │
│ · 列表/网格    │  · 点卡片 → 定位到该段             │ · 当前媒体    │
│ · 拖拽=推荐顺序│  · 范围预览按钮（只看本段）        │ · 当前片段    │
│ · 勾选/框选    │                                   │ · 当前段      │
│ · 片段挂载入口 │                                   │               │
├──────────────┴───────────────────────────────────┴───────────────┤
│ 时间轴：[开场][序言][章节·2014年][资料 1-3][片名·片段][…][结尾]  │
│  ▲游标随播放走  · 段级校验标记(黄)  · 点击段=seek+切 Inspector     │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 区域职责

| 区域 | 职责 | 数据来源 |
|---|---|---|
| 媒体篮子 | 候选集筛选、勾选、排序（= `order`）、片段挂载、开场代表秀拖入 | 现有 REST（媒体/标签/收藏夹/片段） |
| Player | 所见即所得预览 + 就地编辑 | `inputProps` = 当前配置 |
| Inspector | 对象轴参数编辑 | 当前选中对象 |
| 时间轴 | 段结构可视化、跳段、游标、段级校验 | `buildScenePlan()` **本地计算** |

### 5.3 步骤语义的去向

原四步（勾选媒体 / 内容·主题 / 页面·交互 / 预览导出）**不再作为流程**：勾选→左栏；内容·主题→Inspector「全局」页签内的分组标题；页面·交互→Inspector 各页签；预览导出→顶部工具栏 + 时间轴。

### 5.4 实现载体（**§16 待确认项 1**）

编辑器需要 Player 与 Composition（都在 Remotion 工程的构建产物里），因此编辑器 UI 不能继续写在无构建链的 `app.js` 里。两种装载方式：

| 方式 | 说明 | 评价 |
|---|---|---|
| **A. 单页挂载（推荐）** | 新增 `vite.editor.config.ts` → `dist-editor/`，Spring 托管 `/recommend-editor/**`；`index.html` 以 ESM 脚本加载，React 应用挂载进 `view-recommend` 内的 `#recommend-editor-root` | 同源、无跨窗口时序、无重复上下文；需明确挂载/卸载协议与滚动恢复 |
| B. iframe 嵌入 | 编辑器作为独立页，占满内容区 | 免与 `app.js` 共享 DOM 生命周期；但要跨窗口传配置与帧事件，时序与性能风险更高 |

**约束**：无论哪种，`view-recommend` 之外的结构与四个容器不变。

---

## 6. 交互细则

### 6.1 即时生效契约

- 配置改动 → 直接更新 `inputProps`（不重建素材、不刷新页面、不新建 token）；防抖 **≤100ms**；**不得**重置当前帧或打断播放（探针①已证可行）。
- 只有**素材类变更**（新增/更换片段、换 BGM、改片段区间）才触发后端准备，并显示进度（见 §8）。
- `durationInFrames` 变化时：按 §6.6 处理帧位置；不允许出现"停末帧"。

### 6.2 时间轴

- **段模型**：直接映射 `ScenePlan.scenes`（`COLLECTION_OPENING / COLLECTION_INTRO / GROUP_INTRO / MEDIA_INFO / MEDIA_GRID / MEDIA_CLIP / COLLECTION_ENDING`）；段名沿用 `sceneLabel()` 文案（开场/序言/章节·X/资料 N-M/片名·片段/结尾）。
- **本地计算**：`buildScenePlan()` 在浏览器内即时重算（参数改动 → 段长与段数即时变化），**不请求后端**。
- **游标**：`frameupdate` 事件驱动，显示当前帧/总帧/时间码。
- **跳段**：点击段 → `seekTo(seg.fromFrame)` + Inspector 切到该对象（`initialFrame` 挂载后不可改，**必须用 `seekTo`**）。
- **范围预览**：选中段可切"只看本段"（`inFrame/outFrame`），退出后回到全片。
- **段级标记**：素材缺失/时长异常/封面缺失 → 段上标黄（见 §6.8）。

### 6.3 Inspector（对象轴）

| 选中对象 | 可编辑项（节选） |
|---|---|
| 全局 | 标题/角标/副标题/简介/序言标题/结尾标题·文案、模板形态（chapter/clip）、主题预设、分组方式与排序、每屏 N 部、五项时长、动效档（开场/结尾）、BGM 条位置与缩放、背景层、详情卡显隐（status/note/tag）、导出格式与清晰度 |
| 当前媒体 | 该媒体在片中的呈现：顺序（可与左栏联动）、片段挂载与顺序、角标文案 |
| 当前片段 | 顺序、字幕条内容（`detailShow.note`）、区间裁剪（改区间触发素材重裁）、删除 |
| 当前段 | 段内参数（如资料卡→该媒体；网格段→该屏媒体集合；章节段→分组名文案） |

**参数收纳原则**：一次性调好的参数（背景透明度/模糊/亮度、BGM 坐标、封面大小）收进「高级」，默认折叠；高频参数（标题、时长档、主题预设、分组、每屏）在首屏可见。

### 6.4 就地编辑

- **BGM 条**：在 Player 上层用编辑器浮层实现拖拽（x/y）与缩放（角柄），回写 `bgmX/bgmY/bgmScale`。旧 HTML 预览的 `bgm-moved`/`bgm-scaled` 通道已死（`dist-player` 内 0 命中），本次以浮层重做；**浮层只存在于编辑器装载层，绝不进成片**（`Root.tsx`/`render-recommend.ts` 不引用编辑器代码）。
- **媒体排序**：左栏拖拽即改 `order`（与 `PICK NO.` 及开场顺序一致）。
- **开场代表秀**：把媒体拖入"开场"槽位 = 写 `openingIds`。
- **点卡片跳段**：Player 内点击某张资料卡 → 时间轴定位 + Inspector 切换。

### 6.5 主题预设

- 3~5 套预设，每套 = 一组 `theme.ts` 令牌覆盖（色板/发光/玻璃卡/版式比例/动效手感/装饰强度）。
- **必须包含 1 套与今天 `chapter` 完全一致的预设**（提供"没变差"的退路）。
- 其余参数（背景色、BGM 坐标、封面大小等）归「高级」。
- 预设的具体审美与命名 → **§16 待确认项 2**。

### 6.6 帧与时长一致性（硬规则）

| 情形 | 行为 |
|---|---|
| 改动只影响画面（文案/颜色/版式） | 帧不变 |
| 改动使总帧数变化，且当前帧仍落在原段内 | 帧不变（段偏移允许） |
| 改动使当前帧超出新总长 | **跳到"当前所在段的新段首"**；该段已不存在 → **最近的前一段段首** |
| 删除当前选中的媒体/片段 | Inspector 回落到"全局"，游标按上一条规则 |
| 播放中改动 | 不打断播放（探针①已证），仅在超出总长时按上一条纠正 |

落实现制：每次 plan 变化后做一次"段内帧合法性校正"，禁止静默停在末帧。

### 6.7 缩略图

- 用 `@remotion/player` 的 **`Thumbnail`** 在浏览器内按段首帧渲染（Node `renderStill` 仅用于门禁，不进编辑器链路）。
- **懒加载**：只渲可视区及其邻近段，进后台串行队列，会话内缓存（内存 + 会话 token 目录可选）。
- 失败/超时 → 该段回落为段色 + 文字标签，不阻塞。
- 浏览器端单帧耗时**未测**（§14 阶段 2 必须先探）。

### 6.8 校验前置

- Java 侧已有素材校验（`PreparedClips.missing`）→ 结果回传编辑器并落成**段级标黄** + 悬停原因。
- 本地可算的检查（封面缺失、`groupBy` 兜底名、段长越界、开场封面数量）→ 即时标记，不请求后端。
- **导出前统一拦截**：有红色项时导出按钮给确认提示（可继续导出，但明确告知会缺什么）。

---

## 7. 配置模型与持久化

### 7.1 模型

```
模板（Template）
├─ 配置（RenderParams 全量 + 素材选择语义：ids/mediaClips/openingIds）
├─ 候选筛选条件（标签 / 年份 / 来源收藏夹 / 入库时间范围）   ← 系列化新增
└─ 变体（Variant[]）                                        ← 批量导出新增
   └─ 变体 = 具名覆盖（时长档 / 画幅 / 模板形态 / 每屏）
```

- **草稿（draft）**：退化为**当前编辑会话的暂存**，自动节流保存（~1s 防抖）。
- **模板**：**显式命名保存**，不自动覆盖。
- **套用模板**：按筛选条件**重算候选**，仍允许人工微调（勾选/排序/删减）。

### 7.2 表结构

**重建** `recommend_draft` / `recommend_template`（新 JSON 结构）；**旧行清掉**（用户 2026-09-18 明确接受清数据）。新迁移脚本随计划落地（编号在计划里定），要求：

- 旧行删除与新结构建表在同一迁移内完成；
- 不保留兼容读取分支（不写"旧 JSON 兜底"代码）。

### 7.3 保存与冲突

- 编辑期间：本地为真值 → 节流写草稿；写入失败 → 顶部状态显示"未保存"并可重试。
- 离开编辑器（切视图/关页）：若有未保存改动 → 提示（沿用现有 `saveRecommendPosition` 的会话恢复思路，但不再用 sessionStorage 存配置）。

---

## 8. 素材与缓存策略

### 8.1 片段素材（混合策略）

```
选中片段 (clipId, startMs, endMs)
├─ 1. 命中会话缓存 → 直接使用
├─ 2. 存在 READY 物化产物且区间一致 → 探测编解码
│       ├─ 视频 h264 && 音频 aac/无音轨 → 直接复用（不重编码）
│       └─ 否则 → 本会话重编码一次（libx264 + aac，沿用现有参数）
└─ 3. 无可用产物 → 触发物化/裁剪（复用 ClipMaterializationService 的既有路径），
        完成后按第 2 步判定；进度可见
```

- 编解码探测走 ffprobe（`RecommendVideoService.ffprobePath()` 已有定位逻辑）；探测不可用时**保守重编码**（宁可慢，不可黑屏）。
- 重编码参数沿用 `RecommendClipSourceService.export()`（`libx264 -preset fast -crf 20 -c:a aac -b:a 128k`，保留原声）。

### 8.2 会话与缓存键

- **会话 token**：进入编辑器时创建，**整个编辑会话固定不变**（路径稳定 = 缓存可用）；退出/显式回收时删除。
- 缓存键：`clipId + startMs + endMs + 编解码判定`；BGM 键：文件名 + 内容哈希。
- 目录：`data/recommend-previews/<sessionToken>/`（沿用现有静态托管 `/recommend-previews/**`），内部 `media/`（片段）、`bgm-N.ext`、`thumbnails/`（可选）。
- **回收**：会话结束删除；启动时清理超过 N 天的遗留 token 目录（N 在计划里定，默认 7）。

### 8.3 封面

- 编辑器预览走 `url` 模式（`/covers/x.jpg`，同源直连）；
- 渲染仍走 `embed`（data URI，保持无头自足）——与 v0.27 一致，不改。

---

## 9. 失败态与降级

| 情形 | 表现 | 是否阻断 |
|---|---|---|
| 片段源视频缺失 / 裁剪失败 | 该段标黄 + 封面/黑底占位 + 悬停原因；导出前拦截提示 | 不阻断编辑 |
| 物化产物编解码不可播 | 自动重编码一次；仍失败 → 按上一条 | 不阻断编辑 |
| `dist-editor` 未构建 | 编辑器入口给出**可复制命令**（`cd backend/remotion && npm run build:editor`） | 阻断编辑器（但媒体库等其它功能正常） |
| 缩略图渲染失败 | 该段回落段色 + 文字 | 不阻断 |
| 草稿保存失败 | 顶部"未保存" + 重试按钮 | 不阻断 |
| 导出中 node 卡死 | 受 §10-② 修复后的超时保护，任务转 `ERROR` + 明确文案 | — |
| 浏览器不支持 `postMessage`/ESM 等 | 编辑器入口提示不支持（保留导出可用的最小路径） | — |

---

## 10. 顺带修复的既有缺陷

| # | 缺陷 | 位置 | 修法 |
|---|---|---|---|
| ① | 导出色彩 full-range 且无标注（实测 `yuvj420p(pc)`） | `render-recommend.ts` | 显式 `colorSpace: 'bt709'`（Remotion 4.x 默认 `default`=全范围）；改后复验 `ffmpeg -i` 的 `yuv420p(tv, bt709)` |
| ② | 渲染超时是死代码：`readAllBytes()` 在 `waitFor` 之前阻塞 → node 卡死时 40 分钟超时永不触发 | `RecommendVideoService.java:246-252`（`probeMediaDuration` 同型两处） | 改 drainer 线程排空（范式见 `RecommendClipSourceService.export()`）或 `redirectOutput(file)` |
| ③ | 孤儿端点 `POST /api/recommend/prepare-clips`（无调用者，且每次泄漏临时目录） | `RecommendController:73-77` | 删除端点 |
| ④ | 前端"总时长 `--:--`"死链路（`preview-structure`/`bgm-moved`/`bgm-scaled` 在 `dist-player` 中 0 命中） | `app.js:7943-7971` + `computeRecommendDuration` | 随编辑器重做删除：时长由本地 `ScenePlan` 直接显示 |

---

## 11. 删除清单

| 目标 | 核查 | 说明 |
|---|---|---|
| `templates/archive/recommend-{chapter,clip,overview,stream}.html`（4 份 ≈210KB） | 无 Java 引用，仅归档脚本自读 | 删 |
| `backend/scripts/archive/{render.js,diag-*.js,validate-templates.js,snap-galleries.js}` | 仅互相引用 | 删 |
| `RecommendService.styleOf/normalizeStyle` 的 `stream/overview` 回退分支 | 被 `RecommendServiceTest:82` 断言覆盖 | 删（同步改测试） |
| 旧预览页链路：`dist-player/`、`vite.player.config.ts`、`build:player`、`player.html`、`player.tsx` 中的注入式入口、`WebConfig` 的 `/recommend-player/**`、`RecommendVideoService.hasPlayerBundle()/playerPagePath()`、`POST /api/recommend/preview` | 由编辑器接管预览 | 删（编辑器产物取代） |
| `RecommendSingleService` + `templates/recommend-single.html` | **活的**（高光项目） | **保留，不碰** |

---

## 12. 接口与构建产物变化

| 项 | 变化 |
|---|---|
| `POST /api/recommend/session` | **新增**：创建编辑会话（token + 素材准备 + 返回初版 `RenderInput`） |
| `POST /api/recommend/session/{token}/assets` | **新增**：增量准备（新增/更换片段、改区间、换 BGM），返回 missing 清单 |
| `DELETE /api/recommend/session/{token}` | **新增**：回收会话目录 |
| `POST /api/recommend/preview` | **退役**（由编辑器 + session 取代） |
| `POST /api/recommend/prepare-clips` | **删除**（孤儿） |
| `POST /api/recommend/draft` / `templates*` | 保留路径，**新 schema**（§7.2） |
| `POST /api/recommend/video` / `video/tasks*` | **签名与行为不变**（含多版本导出的扩展方式在计划里定） |
| 构建 | 新增 `npm run build:editor` → `dist-editor/`；`build:player` 退役 |
| 新增 npm 脚本 | `probe:player`、`probe:cost`（探针保留，不进 `verify:*`） |

---

## 13. 验收标准

### 13.1 自动化门禁（必须全绿）

1. **帧确定性**：沿用 `npm run verify:params`（多场景多帧字节一致）；
2. **参数生效矩阵**：新参数（主题预设/变体/筛选条件）纳入"参数→画面/计划"可定位性核查，报告**不允许出现"未生效"栏**；
3. **色彩标注断言**（新增）：导出产物 `ffmpeg -i` 断言为 limited-range + bt709；
4. **热更新保帧回归**（新增）：把探针① 固化为断言（seek 后热更新帧不变、播放中热更新不中断、超长时按 §6.6 纠正）；
5. **硬禁则**：`npm run check:native`（`src` 内无 `transition`/`@keyframes`/定时器/`Math.random`）；
6. **Java 侧**：`mvn test` 全绿（含删除 `styleOf` 死分支后的测试调整）。

### 13.2 性能预算

| 指标 | 上界 |
|---|---|
| 滑块/输入 → 画面变化 | ≤100ms |
| 片段首次准备（单片段，重编码路径） | ≤30s（进度可见） |
| 片段复取（命中缓存/可直用产物） | 即时（无感知） |
| 段缩略图（单张，浏览器端） | 阶段 2 探针测定后回填 |
| 导出 | 维持现状（不新增进度呈现） |

### 13.3 人工验收（真实浏览器）

1. 进入编辑器 → 勾选媒体 → 拖动排序 → 拖 BGM 条 → 点段跳转 → 范围预览 → 改时长（验帧校正）→ 保存模板 → 套用模板重算候选 → 导出 → 任务列表/打开目录；
2. `chapter` 与 `clip` 两种形态各走一遍；
3. 失败态：故意缺片段源（段标黄 + 导出拦截）、故意删 `dist-editor`（提示命令）。

### 13.4 「待素材」项（不假装覆盖）

**真实音频断言**（ducking 的实际听感/解码验证）依赖真实片段素材；本机 `data/videos` 为空、现有 clips 为 `REFERENCE_ONLY`，**本轮不覆盖**。规格要求：执行计划里单列「何时补（拿到真实片段素材后）+ 怎么验（渲染后 ffmpeg 解码出音轨并做增益曲线/静音段断言）」。

---

## 14. 分阶段落地（每阶段结束都能用）

| 阶段 | 内容 | 阶段验收 |
|---|---|---|
| **1. 会话与即时预览** | session 端点、素材混合策略与缓存、编辑器装载骨架（§5.4 选定方式）、Player 常驻 + 即时生效、旧 `preview` 退役 | 滑块 ≤100ms；片段复取即时；`preview` 相关旧代码已删且无残留调用 |
| **2. 时间轴** | 段模型本地计算、游标、跳段、范围预览、段级标记、缩略图（先探针，再懒加载） | 跳段/范围预览可用；缩略图耗时回填到 §13.2 |
| **3. 对象轴 Inspector 重构** | 参数按对象重排、高级参数折叠、主题预设（含"等于现状"那套）、就地编辑（拖 BGM/排序/开场槽位） | 首屏参数可调通；主题预设切换有画面差异 |
| **4. 系列化与变体** | 模板 = 配置 + 筛选条件 + 变体；套用重算候选；多版本导出 | 一套模板换批媒体重出可用；同配置导出 2 个版本 |

**阶段间不留双轨**：旧向导在阶段 1 结束时即退役（决策 4：不留开关）。

---

## 15. 风险与遗留

| 风险 | 说明 | 处置 |
|---|---|---|
| 编辑器前端复杂度上升 | 预览页从"服务端一次性 HTML"变为有状态前端应用；状态/脏值/同步都要新设计 | §5.4 选装载方式时优先"无跨窗口同步"；分阶段落地 |
| `Thumbnail` 浏览器端耗时未测 | 若单张明显慢于 Node 的 0.55s，缩略图体验会打折 | 阶段 2 先探针，慢则退回"仅段色 + 文字" |
| `inFrame/outFrame` 行为未实测 | 范围预览可能与 seek/播放态交互异常 | 阶段 2 首个任务即验证 |
| 物化产物 `-c copy` 的编解码不确定性 | HEVC 源会预览黑屏 | §8.1 探测 + 保守重编码 |
| 删除清单体量 | 4 份归档模板 + 归档脚本 + 旧预览链路 | 删除在计划确认后执行；`git` 历史可回溯 |
| 色彩修复影响已发视频观感 | 从 full-range 改 limited 后，旧成片与新成片亮度观感不同 | 明确记录为"修正"；不做旧产物回溯转码 |
| 1080P/4K 耗时仍未测（v0.27 遗留） | 本轮不新增 | 沿用 v0.27 §13 遗留，不假装解决 |
| Remotion 许可证/商业分发 | v0.27 起未核验 | 仍待你确认（自用/商业） |

---

## 16. 待确认项

1. **编辑器装载方式**（§5.4）：**已裁 = A 单页挂载**（2026-09-18：新增 `vite.editor.config.ts` → `dist-editor/`，ESM 脚本挂进 `view-recommend` 的 `#recommend-editor-root`；Spring 托管 `/recommend-editor/**`）。
2. **主题预设的审美与命名**：数量（建议 3~5，含 1 套等于现状）、每套的名字与色板方向。这是唯一我无法替你决定的审美题——建议在阶段 3 开工前，我先出 3 张静态样张（`renderStill`）给你挑，再定令牌。

---

## 17. 变更记录

- 2026-09-18：初版。依据同一天五轮 Grilling 的 24 项决策（§2）与两组实测探针（§3.2）编写；状态为**待批准**。
- 2026-09-18（同日）：用户批准本规格，并裁定 §16-1 装载方式为 **A 单页挂载**；配套执行计划已编写并待确认。§16-2（主题预设审美）不阻塞，阶段 3 开工前以 3 张静态样张定稿。
