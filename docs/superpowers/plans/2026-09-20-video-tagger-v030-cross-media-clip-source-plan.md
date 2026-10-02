# 跨媒体片段来源（同系列借片段）— 执行计划

- 日期：2026-09-20
- 设计规格：`docs/superpowers/specs/2026-09-20-video-tagger-v030-cross-media-clip-source-design.md`
- 状态：**待用户确认**（确认后才动代码）
- 定稿的 4 项决策（用户 2026-09-20「看你建议」）：
  1. 视频类关系白名单：`主线故事 / 番外篇 / 前传 / 续集 / 剧场版 / 角色出演 / 同一世界观`（**去掉**「其他」这种catch-all；白名单是常量，可后续加）
  2. 没有片段的关联条目**不列出**（只显示条数提示）
  3. 成片里**显示**来源行（仅借来的片段）
  4. 来源切换放**片段面板顶部**

---

## 阶段 0：基线与回归快照（不改代码）

- 用固定草稿导出一次「不借片段」的 `render-input.json`，存到 `.tmp/baseline-render-input.json`（gitignore 目录），作为阶段 2/5 的回归基线。
- 命令：现有会话接口 + `curl` 或直接看会话目录；用途：改完后**逐字段 diff 应无差异**（除新键缺失）。

**验收**：基线文件存在，且记录下它的 md5。

---

## 阶段 1：后端 — 同系列解析 + 端点

| # | 动作 | 文件 |
|---|---|---|
| 1.1 | 找出现成的 relations 读取/解析路径（`/api/metadata-sync/media/{id}/metadata` 已在返回 `relations`）→ 抽出可复用的读取方法 | `metadata/*`、`MediaMetadataController` |
| 1.2 | 新增按 `external_id` 反查本地媒体（含片段数）的查询 | `ExternalWorkMapper` / `MediaMapper` |
| 1.3 | 新增 `RelatedMediaService.videoRelated(mediaId)`：解析 relations → 白名单过滤 → 反查本地 → 过滤 0 片段与自引用 → 排序（relationType 顺序 + clipCount desc） | 新 `service/RelatedMediaService.java` |
| 1.4 | 新增 `GET /api/media/{id}/related` → `[{mediaId,title,relationType,year,clipCount}]` | `controller/MediaController.java` |
| 1.5 | 单测：白名单过滤、自引用过滤、0 片段过滤、external_id 多命中取第一、无 relations 返回空 | 新 `RelatedMediaServiceTest`（构造 JSON 字符串，不连库） |
| 1.6 | 单测：端点 JSON 形状 | `MediaControllerTest`（MockMvc + mock service） |

**验收**：`mvn -o test -Dtest=RelatedMediaServiceTest,MediaControllerTest` 全绿 + `mvn -o -q compile`。
**手测**：`curl localhost:8080/api/media/6917/related` → 期望只含 `6648 草莓棉花糖 OVA 第2期 / 番外篇 / 1`。

---

## 阶段 2：后端 — 借片段（契约与素材准备）

| # | 动作 | 文件 |
|---|---|---|
| 2.1 | `RecommendMediaClips` 加 `Map<Long,Long> sources`（可选键，旧草稿缺省 → null = 全部本体） | `service/RecommendMediaClips.java` |
| 2.2 | `loadClips`：本体查不到 → 按 `sources[clipId]` 查来源媒体；三段校验（存在 / 属本体 / 与本体有视频类关联），三种 missing 文案 | `RecommendClipSourceService` |
| 2.3 | `PreparedClip` 加 `sourceMediaId` / `sourceTitle` | 同上 |
| 2.4 | 片段视图加 `sourceTitle`（仅 `sourceMediaId != 本体` 时） | `RecommendService.buildRenderInput` |
| 2.5 | 单测：① 借片段命中并带上 `sourceTitle`；② 来源无视频类关联 → 拒绝且文案正确；③ 片段不存在 → `片段不存在`；④ **旧草稿（无 sources）行为与今天一致** | `RecommendClipSourceServiceTest`、`RecommendServiceTest` |

**验收**：`mvn -o test` 全绿；阶段 0 的基线 diff **无差异**（不借片段路径）。
**回归**：`RecommendControllerTest` 的 mock 参数未变（本阶段不加位置参数，避免重演 `seed`/`clipVolume` 的存根同步问题）。

---

## 阶段 3：渲染 — 来源行（几乎只加显示）

| # | 动作 | 文件 |
|---|---|---|
| 3.1 | `PocClip` 加 `sourceTitle?: string` | `src/types.ts` |
| 3.2 | `ClipShot` 信息卡：`EP.xx · 时长` 行后追加 `来源：X`（仅存在时） | `src/cinema/scenes.tsx` |
| 3.3 | 章节模板 `ClipScene` 同步（两套模板一致） | `src/scenes/Cards.tsx` |

**验收**：渲一帧借片段幕 → 目视来源行；`npm run typecheck`、`npm test`。
**说明**：`plan.ts` / `scene-plan.ts` **不改**（借来的片段在卡片媒体的 `clips` 数组里，天然命中）。

---

## 阶段 4：编辑器 — 来源切换与角标

| # | 动作 | 文件 |
|---|---|---|
| 4.1 | `api.ts`：`MediaClips.sources?: Record<string, number>` + `relatedMedia(mediaId)` | `editor/api.ts` |
| 4.2 | `clip-refs.ts`：`withoutClip` / `dropAllMissing` **同步删 `sources[clipId]`**；加单测 | `editor/clip-refs.ts(.test.ts)` |
| 4.3 | `ClipPicker`：顶部 `来源 [本体 N] [同系列 M]`；同系列按 `relationType` 分组列条目与片段；「加入」写 `order` + `sources`；M=0 置灰 + 提示 | `editor/panes.tsx` |
| 4.4 | 角标：片段列表项与胶片条卡（`labelOf`）标 `来源：X` | `editor/panes.tsx`、`editor/timeline.tsx` |
| 4.5 | 缺失提示带上来源名（卡上 `✕ 移除` 的 tooltip / 右栏条目） | `editor/timeline.tsx`、`editor/panes.tsx` |

**验收**：`npm run typecheck` + `npm test`（含 clip-refs 新用例）+ `npm run build:editor`；bump `index.html` 版本戳并 `cp` 到 `target/classes`。
**注意**：`sources` 必须在 `sessionSignature` 覆盖的 `mediaClips` 里（已是），改完会自动重开会话。

---

## 阶段 5：端到端验收与文档

1. **手测脚本**（用草莓棉花糖）：
   1. 打开工作台 → 选《草莓棉花糖》→ 点「＋ 片段」→ 切到「同系列」→ 应看到 `草莓棉花糖 OVA 第2期（1 个片段）`
   2. 加入 → 片段列表与胶片条卡出现 `来源：草莓棉花糖 OVA 第2期`
   3. 预览该片段幕 → 画面里 ClipShot 显示来源行
   4. 导出短视频 → 成片正常、片单统计不变
   5. 回草稿删掉该片段 → 角标与来源一起消失
2. **回归**：不借片段时与阶段 0 基线一致。
3. **文档**：`docs/rules.md` 补契约说明（`mediaClips.sources` 语义 + 白名单常量位置）；工作日志追加一条。
4. **收尾**：`mvn -o test` 全绿 + `npm test` + `build:editor`。

---

## 风险与回滚点

| 风险 | 回滚方式 |
|---|---|
| 借片段导致素材准备失败新形态 | 复用既有 `missing` 机制；失败不影响其它媒体 |
| 白名单过滤掉用户想用的条目 | 白名单是常量；列表给"为什么没列出来"的提示 |
| 契约键影响别的消费者 | 只加可选键；去掉 UI 入口即回到旧行为（后端忽略 `sources`） |

## 工作量估计

后端 2 阶段 ≈ 大头（新端点 + 契约 + 校验 + 单测）；编辑器 1 阶段；渲染 0.5 阶段；验收+文档 0.5 阶段。
按"先后端跑通、再编辑器、最后渲染"的顺序，每阶段完成后停下来汇报一次。
