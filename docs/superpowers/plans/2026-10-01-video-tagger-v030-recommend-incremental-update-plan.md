# 推荐视频「按当前草稿增量更新」执行计划

- **日期**：2026-10-01
- **对应设计规格**：`docs/superpowers/specs/2026-10-01-video-tagger-v030-recommend-incremental-update-design.md`（**已批准**）
- **§7 拍板结果（用户 2026-10-01「按你推荐的来」）**：
  1. 入口 = 任务面板新增「增量更新」按钮（不改「导出视频」的语义）
  2. 不再被引用的旧块 = **保留**，只在完成后给一条「可清理」提示（不自动删）
  3. 每轮写 `inc-<yyyyMMdd-HHmmss>` 子目录（失败可无损回滚）
  4. 段层指纹先用**保守版**（媒体/片段全字段 + 显示开关放全局层）
  5. 老任务缺 `chunk_keys` → **自动补算**（对旧 `render-input.json` 跑一次 probe）；补不齐再整片重渲
- **执行顺序**：P1 → P2 → P3 → P4，每阶段结束**必须**跑该阶段验证；P1 完成即可先验"改标题 → 判定全渲"这条闭环。

---

## P0 前置（5 分钟）

- [ ] 规格文件头部状态改为「已批准（2026-10-01）」，把上面 §7 结论回填进规格 §7。
- [ ] 开工前确认：**不要**在用户 IDEA 实例正在渲染时 `mvn clean`；真机验收用**隔离实例**（18099 + 真库 + 同一 `data/`），验收完 kill 掉并确认 `netstat` 无 LISTENING。

---

## P1 块键（TS 定义 + 脚本输出 + Java 存储）

**目标**：让"一块的内容"有确定性身份，且这个身份**由渲染侧定义**（只有它知道每段读了什么）。

### P1-1 `src/chunk-keys.ts`（新，唯一真源）

```ts
/** 全局层：根节点每帧都会画 / 影响全片时间轴的东西。 */
export function globalLayerKey(plan: ScenPlan, input: MultiMediaPocInput, assetPrint: AssetPrint): string
/** 段层：这一段渲染用到的东西。 */
export function segmentKey(scene: Scene, plan: ScenePlan, input: MultiMediaPocInput, assetPrint: AssetPrint): string
export function segmentKeysOf(plan, input, assetPrint): string[]   // 与 plan.scenes 一一对应
```

- **全局层**要含：`fps/width/height`、`plan.durationInFrames`、`params` 里**除 `durations` 外**的全部字段（title/brandTitle/subtitle/intro/ending*/detailShow/preset/bgm*/seed/coverSize/clipVolume/…）、**每段的 `(type, fromFrame, durationInFrames, sceneLabel)` 序列**（Trackbar 每帧都画）、**音频/素材指纹**（BGM/sting 文件的 `size+mtime`）。
  - `durations` 不必单独列：它变了必然改 `durationInFrames` 与每段帧数，已被覆盖。
- **段层**要含：段类型、段时长（帧）、该段引用的**媒体/片段全字段**（直接从 `input.media` 取该段的媒体或片段对象，不做字段白名单），以及该段引用的素材文件指纹（片段 `assetPath` 的 `size+mtime`；封面路径已在媒体对象里）。
- **规范化（关键坑）**：键必须从**规范化输入**算 —— 因为脚本会把 `/covers/**` 改写成本次素材服务的绝对地址（端口随机）。
  → 定义 `canonicalize(input)`：剥离 `assetBaseUrl`、把 `coverAssetPath` 里的 `http(s)://<host>/covers/...` 还原成 `/covers/...`；键只用规范化后的值。
  **单测必含**：同一输入在不同 `assetBaseUrl`/端口下算出的键**完全相同**。
- **哈希**：纯 TS 实现 FNV-1a 64 位（hex 16 字符），不依赖 `node:crypto`（该模块可能被浏览器侧 bundle 到）。理由与实现写进文件头注释。
- **确定性红线**：只用输入里的值；禁止 `Date.now()`/`Math.random()`（`seed` 属于输入）。

**验证**：`src/chunk-keys.test.ts`
1. 同一输入算两次 → 完全一致；
2. 只改 `params.title` → chapter 下**全部**段键变（因为 Trackbar 标签序列/全局层变）`;
3. 只改某媒体的 `note` → 只有含该媒体的段键变；
4. 只改某片段的 `assetPath`/素材 mtime → 只有含该片段的段键变；
5. 改 `seed` → 全局层变。

### P1-2 脚本输出（`scripts/render-recommend.ts`）

- 在 probe 那一行 JSON 里追加 `globalKey` 与 `segmentKeys`（数组，长度必须等于 `plan.scenes.length`；不等就只发 `globalKey: null` 并在 stderr 打 WARN —— 键不可信时宁可全渲）。
- 只在 `probeOnly` 时输出这两项（逐块渲染不需要）。

### P1-3 Java：解析 + 装配 + 存储

- `RenderChunks` 或新类 `ChunkKeys`：
  - `parseProbeKeys(String probeOutput)`：取 `globalKey` + `segmentKeys`。
    **解析方式优先用 Jackson**（`RecommendService` 已有 `ObjectMapper` 实例；`RecommendVideoService` 需要就拿一个）：probe 那行是标准 JSON。若不想引依赖 → 用"键是我们自己生成的 hex"这条事实做正则提取 + 数量校验。二选一写进注释。
  - `assemble(oldKeys, newKeys)`：
    - 段索引 ↔ 帧范围映射：`boundaryFrames[i] → boundaryFrames[i+1]` 是第 i 段，块覆盖整段（`planByBoundaries` 保证）；
    - `blockKey(i) = sha256( globalKey + '\u0000' + segmentKeys[s..e].join('\u0000') )`（hex 64 字符）；
    - 返回 `List<BlockKey>`（下标 = 块号）。
  - `planReuse(List<BlockKey> oldWithFile, List<BlockKey> now)`（**纯函数，单测重点**）：
    - 返回 `{ reuse: Map<新块号, 旧产物相对路径>, pending: List<新块号>, allChanged: boolean }`；
    - **按键匹配，不按下标**（插入/删段会整体错位）；
    - 同一个旧产物**不允许被两个新块复用**（键相同意味着内容相同，理论上可复用，但先禁止，避免同一文件被拼两次导致的时长/时间戳风险）。
- 任务行新增列（Flyway **V43**，MySQL 侧；SQLite 侧已冻结）：
  ```sql
  ALTER TABLE video_export_task ADD COLUMN chunk_keys TEXT NULL;   -- JSON: [{"key":"…","file":"inc-20261001-143000/chunk-3.mp4"}, …]
  ```
  - `file` 相对 `work_dir`（老任务/首轮导出 = `chunk-000.mp4`）。
- `VideoExportTaskService`：首轮导出成功后把 `chunk_keys` 写进任务行（`onChunkKeys` 回调或渲染返回后统一写），DTO 增加字段（面板不需要它，但排障要）。

**验证**：`VideoExportTaskServiceTest`（或新的 `ChunkKeysTest`）：装配 + `planReuse` 的用例（键相同→复用、错位→按内容复用、新增块→pending、全部不同→allChanged、旧产物重复复用被禁止）。

---

## P2 增量更新执行体

**目标**：`updateFromDraft(taskId, 当前草稿)` → 只渲变化块 → 覆盖成品。

### P2-1 抽 `prepareInput`

- `RecommendVideoService` 新增 public 方法：与 `render(...)` **同一套入参**，但只做「建工作目录 + 复制 BGM/sting + 准备片段素材 + `buildRenderInput` + 写 `render-input.json`」并返回该文件路径，不做 probe/渲染。
- 实现方式（最小 diff）：在现有最深那层 `render(...)` 上加 `boolean prepareOnly`，写完 `render-input.json` 后 `if (prepareOnly) return inputFile;`；`render(...)` 走同一实现（`prepareOnly=false`）。**不要**为此重排 40 个参数的签名（改动面太大）。

### P2-2 `updateFromDraft`

`VideoExportTaskService` 新方法（`@Async("videoExportExecutor")`，与导出/续渲共用串行队列）：

1. `row = selectById(id)`；要求 `work_dir` 存在且 `render-input.json` 或块产物存在，否则报「工作目录已丢失，请整片重导」。
2. `incDir = workDir/inc-<时间戳>`（`Files.createDirectories`）。
3. **旧快照**：`oldFiles = row.chunkKeys`（无 → 自动补算：对 `workDir/render-input.json` 跑一次 probe 拿 keys + 从 `boundary_frames` 复原分块表，文件都在 `workDir` 根；补算失败 → 记 `allChanged=true` 直接全渲）。
4. `prepareInput(..., workDir=incDir, ...当前草稿)` → `incDir/render-input.json`。
5. 对 inc 的输入跑 probe → `durationInFrames/fps/width/height/boundaryFrames/globalKey/segmentKeys`；新分块表 = `planByBoundaries(...)`（`knownPlanOf` 那套语义不变）。
6. 装配新块键 → `planReuse(old, now)`；`pending` 为空 = 草稿改动不影响任何块 → 直接回一句「无需重渲（内容未变）」并结束（不碰成品）。
7. 阶段文案（沿用今日 B 的口径）：
   - `增量准备：复用 N 块 / 重渲 M 块`
   - `allChanged` 时**先**说清：`本次改动影响全部块（全局层：标题/主题/BGM/总长…）→ 整片重渲 N 块`
   - 每块：`渲染第 i/N 块`（`N` = **本次要渲的块数**，进度 0→100%）
   - 收尾：`整片重新拼接（-c copy 不重编码，但需完整重写一次成品）`
8. 渲染 pending 块到 `incDir/chunk-<新块号>.mp4`（`frameRange` 取新分块表；失败重试 1 次；两次失败 → ERROR）。
9. 拼接：**绝对路径清单**（复用块指向旧目录文件，新块指向 incDir）→ `RenderChunks.concatList` 新增重载（接受 `List<Path>` 或 `Chunk → Path` 的函数），**每项仍写 `duration`**（F8：不写就有 ~0.18s 空洞）；`ffmpeg -f concat -safe 0 -c copy`。
10. 成功 → `move` 覆盖 `row.file_path`；更新行：`chunk_keys`（新键 → 新文件映射）、`boundary_frames`、`chunks_total/chunks_done`、`progress=100`、`stage_text`、`finished_at`、`request_json`（换成新的一份，保持自洽）；`message` = `复用 N 块 / 重渲 M 块`。
11. **清理提示**：若旧轮目录/根目录里有**不再被引用**的块文件 → `message` 追加「旧块已保留（可手动删或删除任务时一起清）」。
12. 失败/取消：incDir 保留，成品与旧目录不动，行写 `ERROR`/`CANCELLED`。

**验证**：
- 纯函数单测（P1-3 已覆盖 `planReuse`）。
- 真机场景 A/B/C（见 P4）。

---

## P3 接口 + 面板

- `RecommendController`：`POST /api/recommend/video/tasks/{id}/update-from-draft`，body 复用 **`RecommendExportRequest`**（与 `/video` 完全同款），内部把 body 翻译成 `exportTaskService.updateFromDraft(id, …)`（翻译逻辑与 `/video` 那段重复 → 抽一个私有 `toTaskArgs(body)` 共用，别写两份）。
- `editor/api.ts`：`updateFromDraft: (id, config) => json(...)`（请求体构造复用导出的那份）。
- `editor/main.tsx` 的 `TaskPanel`：
  - `DONE`（或 `ERROR`/`INTERRUPTED` 且工作目录在）任务上新增按钮 `[增量更新]`，title 写明语义；点击前**不做**段边界校验（键比对在后端，比它准）。
  - 「重渲某块」按钮 tooltip 补一句：`只用导出当时的快照渲染这一块；要吃草稿改动请用「增量更新」`。
  - 任务行文案：完成后的 `message` 直接展示（沿用现有 `vt-task-msg`）。
- 按钮放在「重渲某块」那一行旁边，避免再加一行 UI。

**验证**：`npm run build:editor` 通过；刷新编辑器能看到按钮（真机验收里一起点）。

---

## P4 验收（真机，逐条留证）+ 文档

**环境**：隔离实例 `--server.port=18099 --spring.profiles.active=mysql`（真库 + 同一 `data/`），验完 `taskkill` + `netstat` 确认无残留。

- [ ] **场景 A（段内改动 → 只重渲相关块）**：对任务 #9（chapter，223 部）改**某部媒体的备注**（不动时长/标题）→ 期望报告 `复用 8 块 / 重渲 1 块`；抽帧对比：改的那块画面有变化，其余块与旧成品**同时间点抽帧一致**（文件大小 + 人工看）。
- [ ] **场景 B（全局改动 → 全渲）**：只改标题 → 期望先看到 `本次改动影响全部块（全局层…）`，最终 `复用 0 块 / 重渲 9 块`；抽帧确认开场标题已更新。
- [ ] **场景 C（失败注入）**：渲染中途 `taskkill` 掉 node 子进程 → 期望任务 `ERROR`、**成品仍是旧版**（`mtime` 不变）、`inc-*` 目录保留。
- [ ] **场景 D（无变化）**：不改草稿直接点增量 → `无需重渲（内容未变）`，成品不动。
- [ ] 成品体检：`ffmpeg -i` → `Duration = durationInFrames/fps`（±0.1s）、分辨率/帧率/音轨齐全。
- [x] 文档：worklog 当日新增增量五（含实测数字）。**原计划的「`docs/rules.md` 追加『增量更新』小节」已于 2026-10-02 取消** —— 按用户新纪律，rules.md 只在用户明确要求时新增条目（规则内容见 git `769ed56`）。

---

## 风险与预先决定

| 风险 | 处理 |
|---|---|
| 键包含易变字段（assetBaseUrl / 绝对封面地址）→ 永远不命中或误命中 | P1-1 规范化 + 专门单测 |
| 键漏了某个"其实影响画面"的字段 → **误复用**（比全渲更糟） | 保守口径：媒体/片段全字段 + params 除 durations 全进全局层；宁可多渲 |
| 同名素材被换掉（BGM/片段文件同名不同内容） | 键里放 `size+mtime` 指纹 |
| 块产物被两个新块复用 | `planReuse` 里禁止 |
| 拼接清单用相对路径 → 跨目录复用失败 | 绝对路径重载 + `-safe 0`（已有） |
| 失败把成品写坏 | 全程写 incDir，最后一步才 `move` 覆盖；P4 场景 C 验证 |
| 磁盘增长（每轮一个 inc 目录） | 本次只提示不自动删（§7-2 拍板）；后续可按需加"清理旧轮" |
