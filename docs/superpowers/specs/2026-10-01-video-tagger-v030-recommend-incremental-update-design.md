# 推荐视频「按当前草稿增量更新」设计规格

- **日期**：2026-10-01
- **状态**：已批准（2026-10-01）—— §7 全部按「我推荐的」拍板，执行计划见 `docs/superpowers/plans/2026-10-01-video-tagger-v030-recommend-incremental-update-plan.md`
- **关联**：worklog `2026-10-01.md` 增量一~五。（原指向的 `docs/rules.md` 规则节已于 2026-10-02 删除，见 git `769ed56`）
- **触发需求原话**：「我改了个标题，是不是把json里面的字段改一下就可以了」→「我改了json重新渲染为何还不行」→ **「做成正规功能」**

## 1. 目标

改完草稿（标题、某部的资料/等级/理由、某段片段…）后，**不改草稿、不手改工作目录 JSON、不必整片重渲**，就能把这个成品的画面更新到最新草稿：

- 工具**自动判断哪些块的内容变了**，只重渲那些块，其余块复用已有产物 → 拼接 → 覆盖原成品。
- 明确报告：「复用 6 块 / 重渲 3 块（预计省 X 分钟）」；不能复用的情况要**说清为什么**，绝不静默。
- 失败不破坏现状：旧工作目录与旧成品保持可用。

**非目标**（明确不做）：
- 不做"逐帧级/段级"的增量（块是复用单元，块 = 若干整段）。
- 不做实时预览级增量（那是编辑器的另一条路）。
- 不改现有「导出视频」（仍是完整导出、新任务、新文件名）、不改「重渲某块」的语义（仍是"修坏块"，输入仍取当时快照 —— 但见 §4.6）。
- 不做"自动猜测复用哪个历史任务"（复用对象由用户点选的那个任务决定）。

## 2. 现状事实（全部实测/源码核对过，方案必须与这些对齐）

| # | 事实 | 出处 |
|---|---|---|
| F1 | 局部重渲（`resumeFromWorkDir`）**只用工作目录里冻结的 `render-input.json`**，不读草稿 | `RecommendVideoService.resumeFromWorkDir` |
| F2 | 分块 = **若干整段**（`planByBoundaries`：段内切原子片 + 贪心合并），块与段边界对齐 | `RenderChunks.planByBoundaries` |
| F3 | 段表（plan）**只在 TS 侧算**（`buildScenePlan` / `buildCinemaPlan`），Java 只拿到 probe 输出的 `boundaryFrames` | `scripts/render-recommend.ts:93-99` |
| F4 | 续渲/重渲已能**跳过 probe**（分块表从任务行 `boundary_frames`+`request_json.groupStyle` 复原） | 本日增量三（`knownPlanOf`） |
| F5 | chapter 的 `Topbar`（标题/副标题/品牌名）、`Trackbar`（第 N 段 + 进度）、`BgmBadge`、`BgmAudio` 都挂在**根节点**，**每帧都画** | `RecommendComposition.tsx:40-55` |
| F6 | cinema 根节点只有背景 + 各幕 + BGM；`title` 只出现在开场（`SCAN/SETTLE`）与落款 | `cinema/index.tsx:35-59`、`cinema/scenes.tsx:130/484/972` |
| F7 | chapter 里 `params.title` 只出现在：开场大标题（用到）、序言标题（被 `prologueTitle` 顶掉）、Topbar（被 `brandTitle` 顶掉） | `Opening.tsx:173` / `Intro.tsx:70` / `chrome.tsx:191` |
| F8 | 每块产物必须带音轨；拼接清单每项必须写 `duration`，否则块间有 ~0.18s 空洞 | `RenderChunks` 注释 + 单测 |
| F9 | 工作目录 `data/exports/.work/<id>/`（含块产物）成功后**保留**，是复用的来源 | `VideoExportTaskService.workDirOf` |
| F10 | 片段素材准备走**跨会话缓存** `data/recommend-clip-cache/`，命中则零重编码 | `RecommendClipSourceService` |
| F11 | 成品文件名在提交导出时定死（`uniqueExportName(title, format)`），后续改动不会改名 | `RecommendVideoService` |

## 3. 入口与交互

在**任务面板**里，对 `DONE` 的任务新增按钮：

```
[增量更新]   ← title: 用当前草稿重算，只重渲内容变了的块（其余复用已有产物），完成后覆盖本成品
```

- 点击后与导出一致：**提交的是当前草稿的完整 config**（前端已在 `api.exportVideo(config)` 里这么做，复用同一份载荷）。
- 任务进入 `RUNNING`，阶段文案逐条汇报：
  1. `准备素材（复用缓存）…`
  2. `比对分块：复用 6 块 / 重渲 3 块`
  3. `渲染第 3/9 块（复用 8 块）` …（沿用今日 B 的口径：进度按**本次要渲的块数**映射 0→100%）
  4. `整片重新拼接（-c copy 不重编码，但需完整重写一次成品）`
- 完成后 `DONE`，`message` 里写「复用 6 块 / 重渲 3 块」；并刷新任务行的 `boundary_frames`/`chunk_keys` 为新值。

**不能复用时的行为（重要）**：若**所有**块都变了（例如 chapter 改了标题/BGM/总时长），仍然照常跑，但先给一句明确交代：
`本次改动影响全部块（全局层变了：标题/主题/BGM/总长…），将整片重渲（N 块）` —— 用户点之前就知道要等多久。

## 4. 方案设计

### 4.1 块键（唯一真源 = TS 侧）

在 `src/chunk-keys.ts`（新文件）里定义 **`blockKeyOf(plan, input, chunkIndex)`** 与 `chunkKeysOf(plan, input, chunks)`：

```
blockKey = hash( 全局层指纹 , [该块覆盖的各段：段层指纹…] )

全局层指纹 = hash(
  fps, width, height,
  plan.durationInFrames,                       // 总长（BGM 时间轴 / Trackbar 进度都依赖它）
  params 里除 durations 以外的全部字段,          // title/brandTitle/subtitle/intro/ending*/detailShow/preset/bgm*/seed/coverSize/clipVolume…
  每段的 sceneLabel 序列 + 每段的 type/fromFrame/durationInFrames   // Trackbar 文案与进度依赖
)

段层指纹 = hash(
  段类型, 段时长（帧）,
  该段引用的媒体/片段内容（MEDIA_INFO/MEDIA_GRID: 该屏各 PocMedia 全字段；MEDIA_CLIP: 该 clip 全字段 + 所属媒体标题…）
                                     // 「全字段」= 从渲染输入里直接取，不做字段白名单 → 少一处漂移点
)
```

- **必须确定性**：只能用输入里的值，禁止 `Date.now()`/`Math.random()`（`seed` 是输入的一部分，已在全局层）。
- probe 时（`--probe`）把 `chunkKeys` 一起打印 → Java 存进任务行（见 4.4）。
- 编辑器**不需要**算这个键（它不参与 UI 判定）→ 不引入"两端各写一份字段清单"的漂移风险。✅
- 该模块**必须配单测**：同一输入两次结果一致；只改 title → 全部键变（chapter）；只改某部媒体的 note → 只有含该部的块变；只改某段片段素材 → 只有含该段的块变；改 `seed` → 全变。

### 4.2 输入准备

走**与首次导出同一条路**（把 `RecommendVideoService.render(...)` 里"准备素材 + 组装 input"的段落抽成 `prepareInput(...)`，返回 `{workDir 里的 input 文件, preparedClips 等}`）：

- 新目录：`data/exports/.work/<id>/inc-<yyyyMMdd-HHmmss>/`（**不碰旧目录**，见 4.5）。
- 素材仍进旧目录？不 —— 全部进 inc 目录（BGM/sting/片段），片段走缓存（F10）。
- 片段素材按**新草稿**准备（用户可能改了片段选择/裁剪点）。

### 4.3 复用与渲染流程

1. `prepareInput(当前草稿)` → `inc 目录/render-input.json`
2. 对 inc 的输入跑 probe → 得 `durationInFrames/fps/boundaryFrames/**chunkKeys**`（并顺手比对 fps/画幅；不一致 → 直接按新参数整片，也合法）
3. 旧任务行取旧 `boundary_frames` + **旧 `chunk_keys`**：
   - 旧 keys 缺失（今天之前的老任务）→ **先补算**：对旧 `render-input.json` 跑一次 probe 得旧 keys（花一次 probe 时间，之后永久可用）；再不行（旧 input 丢了）→ 整片重渲。
   - 旧分块表用 `knownPlanOf` 复原（F4）—— 但要**新的**分块表用于拼接：块划分按新 plan 算。
4. **逐块比对**：对新 plan 的第 i 块取 `newKeys[i]`；若旧 keys 里存在**完全相同**的键，则复用**该键对应的旧块产物文件**（按 key→文件 的映射，不假设"第 i 块就是旧第 i 块"，因为插入/删除段会整体错位）；
   否则 → 需要渲染这一块（渲进 inc 目录，文件名仍 `chunk-<i>.mp4`）。
5. 拼接：清单用**绝对路径**（复用块在旧目录、新块在 inc 目录），每项仍写 `duration`（F8）；`ffmpeg -f concat -safe 0 -c copy`。
6. 成功后：`Files.move(rendered, 原成品路径, REPLACE_EXISTING)`；更新任务行的 `boundary_frames`/`chunk_keys`/`chunks_total`/`chunks_done`/`stage_text`/`finished_at`；`request_json` 也更新成新的一份（保持"任务行 ≈ 当前输入"的自洽）。
7. inc 目录**保留**（成为下一轮的"旧块"来源）；旧目录的块已不再被引用 → 下一轮增量时以**最新那一轮**为基准（每轮只认"当前任务行的 keys + 它指向的产物集合"）。
   为控制磁盘：每轮增量后，若旧目录的块全部未被新清单引用 → 提示用户可删（或自动删，**待拍板**，见 §7）。

### 4.4 需要的数据结构变更

- 任务行新增一列 **`chunk_keys`**（TEXT，JSON 数组：`[{"key":"…","file":"inc-20261001-143000/chunk-3.mp4"}, …]`）→ Flyway `V43`（MySQL 侧；SQLite 侧已冻结不动）。
- probe 输出新增 `chunkKeys`（脚本侧）→ Java 解析（正则取数组，沿用现有"不引入 JSON 依赖"的口径会太脆 → 这里允许用现有的 Jackson（`RecommendService` 已经注入 `ObjectMapper`）解析这一行）。
- 新增接口：`POST /api/recommend/video/tasks/{id}/update-from-draft`（body = 导出同款 config）。
- 任务面板加按钮 + 文案（`editor/main.tsx` 的 `TaskPanel` 已在手边）。

### 4.5 失败与回滚

- 新产物全程写 inc 目录，**旧目录与新成品不动**；只有拼接完成且 `rendered` 有效（≥1KB）才 `move` 覆盖成品。
- 中途失败/取消：任务写 `ERROR`/`CANCELLED`，inc 目录保留（下次可续）；成品仍是上一版（**用户至少不会丢片**）。
- 段边界/总长变化**不需要**拒绝：新 plan 就是唯一真相，旧块按 key 复用（键含段时长与总长，天然不会错配）。

### 4.6 与「重渲某块」的关系

- 保留不动（修坏块仍是最省的办法），但把它的 tooltip 补一句：「只用**导出当时的快照**渲染这一块；要吃草稿改动请用『增量更新』」。
- 顺带堵住手改 JSON 的野路子：读 `render-input.json` 时若发现 `params` 与任务行（`request_json` 里的 durations 等）不自洽，日志打一条 WARN（不改行为，只留痕）。

### 4.7 必然全渲的清单（写进 UI 文案，别让用户猜）

| 改动 | 影响 | 原因 |
|---|---|---|
| title / brandTitle / subtitle / preset(主题) / 画幅 / fps | 全渲（chapter）；cinema 通常只影响首尾块 | F5/F6 |
| 任意 `durations`、增删媒体、改分组/二级分组/等级（改回顾页数） | 全渲 | 总长或 Trackbar 变 → 全局层变（F5） |
| BGM/sting 素材或混音参数、`seed` | 全渲 | 根节点音频层（F5） |
| 某媒体的资料/备注/理由/等级/封面、某片段的素材或起止 | 只重渲含它的块 | 段层变化 |
| 只看「备注」开关（`detailShow.note`）等显示开关 | 全渲（当前口径） | 开关在全局层（保守但简单；以后可细分到段类型） |

## 5. 验收标准（必须逐条实测，不许"应该好了"）

1. **单测**：`src/chunk-keys.test.ts` 覆盖 §4.1 的确定性与差异传播（≥5 例）；`RenderChunks` 的绝对路径拼接清单单测（含 `duration` 与顺序）。
2. **对拍**：对真实任务 #9，用同一份输入算 keys 两次 → 一致；把 title 改掉再算 → 全部键变（证明"标题=全渲"的判定与 F5 相符）。
3. **真机（隔离实例 18099 + 真库，别动用户实例）**：
   - 场景 A（只改某部的资料/理由）→ 报告「复用 N-1 块 / 重渲 1 块」，抽帧确认那一块变了、其它块与旧成品逐帧一致（用 `ffmpeg` 抽同时间点帧 + 文件大小对比）。
   - 场景 B（只改标题，chapter）→ 报告「影响全部块 → 整片重渲」，抽帧确认开场标题变了。
   - 场景 C（失败注入：渲到一半 kill）→ 成品仍是旧版、inc 目录保留、任务状态正确。
4. **成品校验**：`ffmpeg -i` 时长 = `durationInFrames/fps`（±0.1s）、帧率/分辨率/音轨齐全。

## 6. 工作量与阶段划分

| 阶段 | 内容 | 估计 |
|---|---|---|
| P1 | `chunk-keys.ts` + 单测；脚本 probe 输出 `chunkKeys`；Flyway V43 + 任务行/DTO 字段 | 0.5 天 |
| P2 | `prepareInput` 抽取 + inc 目录 + 键比对 + 复用渲染 + 绝对路径拼接 + 覆盖/失败回滚 | 0.5~1 天 |
| P3 | 接口 + 任务面板按钮 + 阶段文案/报告 + tooltip 补句 | 0.5 天 |
| P4 | 真机三场景验收 + 文档（worklog） | 0.5 天 |

合计 **约 2~2.5 天**（P1 完成即可先做"场景 B"的最小闭环验证）。

## 7. 拍板结果（2026-10-01 用户「按你推荐的来」）

1. **入口**：任务面板加「增量更新」按钮（不改「导出视频」的语义）。
2. **旧块清理**：不自动删 —— 完成后给一条「旧块已保留（可清理）」提示。（`.work` 已 2GB，后续可按需加清理入口。）
3. **目录**：每轮写 `data/exports/.work/<id>/inc-<yyyyMMdd-HHmmss>/`，失败可无损回滚。
4. **段层粒度**：保守版 —— 媒体/片段**全字段**进段层，`params`（除 `durations`）与显示开关全进全局层（宁可多渲，不要误复用）。
5. **老任务**：缺 `chunk_keys` → 自动补算（对旧 `render-input.json` 跑一次 probe）；补不齐再整片重渲。
