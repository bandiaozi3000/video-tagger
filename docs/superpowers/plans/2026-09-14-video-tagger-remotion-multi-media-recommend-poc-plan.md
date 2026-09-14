# Remotion 多媒体混合推荐模板最小 POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一份包含 3 个真实媒体、两类 Clip 状态和本地视频素材的输入，同时跑通 Remotion Player 预览与 720P MP4 渲染，验证“多媒体混合推荐”路线是否适合 Video Tagger。

**Architecture:** 在 `backend/remotion` 建立独立、最小的 Remotion 工程。POC 读取本地 JSON 和资源目录，先由纯函数生成帧级 `ScenePlan`，Player 与 Node renderer 共同消费同一 Composition。Spring Boot、现有推荐入口、数据库、导出任务和旧 HTML/Puppeteer 模板在 POC 阶段不改动；路线通过后再做业务接线。

**Tech Stack:** Node.js、TypeScript、React、Remotion、`@remotion/player`、`@remotion/bundler`、`@remotion/renderer`、现有 FFmpeg/ffprobe、现有 `RecommendMediaClips` 选择语义。

**Spec:** `docs/superpowers/specs/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-design.md`

## Global Constraints

- **POC 样本：**固定 3 个真实媒体：A 选 2 段短 Clip、B 不选 Clip、C 选 1 段短 Clip；总时长控制在约 30～60 秒。
- **选择语义：**媒体按 `ids` 顺序展示，Clip 按每媒体 `RecommendMediaClips.order` 顺序展示；空 `order` 的媒体仍必须生成资料场景。
- **时间语义：**准备后的 Clip 从第 0 帧播放；场景以 `fromFrame` / `durationInFrames` 表达；Clip 原始起点只保存为核验字段。
- **素材边界：**Remotion 只读取本地资源包，不读取远程 URL、Cookie、Authorization 或任意请求头。
- **输出：**16:9、1280×720、30fps、H.264 MP4；POC 无 BGM；有声和无声样本各至少一段。
- **复用边界：**不新增数据库表，不改旧模板，不改 `HighlightProject`，不迁移 `RecommendVideoService`，不把 POC 临时输入写回真实库。
- **依赖规则：**先检查工作区 Node/Remotion 依赖和 Node 版本；所有 `@remotion/*` 使用同一锁定版本；不升级现有 `backend/scripts` 的 Puppeteer 依赖。
- **安全规则：**标题、简介和标签作为 React 文本渲染；资源路径只允许 POC 资源根目录下的相对路径；选中素材不存在、越界或不可解码时明确失败。
- **验证规则：**每个非平凡场景计划逻辑保留一条可运行测试；完成前运行 POC 测试、TypeScript 检查、Player 页面、双次渲染、ffprobe 和旧模板冒烟检查。

## 文件变更总览

- **Create:** `backend/remotion/package.json`，POC 私有工程依赖和脚本。
- **Create:** `backend/remotion/tsconfig.json`、`backend/remotion/remotion.config.ts`，TypeScript 与 Remotion 配置。
- **Create:** `backend/remotion/src/types.ts`，POC 输入与场景计划类型。
- **Create:** `backend/remotion/src/scene-plan.ts`，媒体 0～N Clip 到帧级场景的纯函数转换。
- **Create:** `backend/remotion/src/scene-plan.test.ts`，无 Clip、多个 Clip、顺序和时长回归测试。
- **Create:** `backend/remotion/src/RecommendComposition.tsx`，统一 Composition 根组件。
- **Create:** `backend/remotion/src/scenes/CollectionOpening.tsx`、`MediaInfoScene.tsx`、`MediaClipScene.tsx`、`CollectionEnding.tsx`，四类最小视觉场景。
- **Create:** `backend/remotion/src/Root.tsx`、`index.ts`，Composition 注册、输入读取和 Player/renderer 入口。
- **Create:** `backend/remotion/scripts/render-poc.ts`，读取资源包、bundle、selectComposition、renderMedia。
- **Create:** `backend/remotion/scripts/serve-player.ts`，启动本地 Player 验收页面。
- **Create:** `backend/remotion/poc/sample.json`，脱敏/可提交的结构样例，不含真实影片或真实绝对路径。
- **Create locally only:** `backend/remotion/poc/real-input.json` 和 `backend/remotion/poc/media/`，使用真实媒体与短 Clip；必须加入 `.gitignore`，不提交。
- **Modify:** `.gitignore`，忽略 POC 真实素材、产物和本地输入。
- **Modify after POC:** `docs/worklog/2026-09-14.md`，记录结果；不在 POC 未通过前改 README/CHANGELOG 的正式功能描述。

### Task 1: 建立独立 Remotion 工程并锁定版本

**Files:**
- Create: `backend/remotion/package.json`
- Create: `backend/remotion/tsconfig.json`
- Create: `backend/remotion/remotion.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 可在 `backend/remotion` 单独执行的 `npm install`、`npm run typecheck`、`npm run test`、`npm run render:poc`、`npm run player:poc`。

- [x] **Step 1: 检查本机和工作区依赖**

运行：

```bash
node --version
npm --version
rg -n 'remotion|@remotion' --glob 'package.json' --glob 'package-lock.json' .
```

记录 Node 版本、npm 版本和已有 Remotion 依赖；若 Node 版本或当前 Remotion 版本不满足官方要求，先在计划执行记录中停在工具链问题，不猜版本。

- [x] **Step 2: 创建最小 package.json**

使用统一版本的 `remotion`、`@remotion/player`、`@remotion/bundler`、`@remotion/renderer`、`react`、`react-dom`、`typescript`、`tsx`、测试运行器。脚本固定为：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "studio": "remotion studio src/index.ts",
    "render:poc": "tsx scripts/render-poc.ts",
    "player:poc": "tsx scripts/serve-player.ts"
  }
}
```

不要加入 UI 框架、状态管理、CSS-in-JS、数据库客户端或第二个视频处理库。

- [x] **Step 3: 写配置与忽略规则**

`remotion.config.ts` 固定 30fps、1280×720、禁止自动并发扩展；`.gitignore` 忽略：

```text
backend/remotion/node_modules/
backend/remotion/poc/real-input.json
backend/remotion/poc/media/
backend/remotion/poc/output/
backend/remotion/poc/.cache/
```

- [x] **Step 4: 安装并验证工具链**

运行：

```bash
cd backend/remotion
npm install
npm run typecheck
```

预期：安装成功、TypeScript 配置可用；此时还没有 Composition，若脚本因入口不存在失败，先完成 Task 2 后重新验证。

### Task 2: 定义 POC 输入和场景计划，并先锁定行为

**Files:**
- Create: `backend/remotion/src/types.ts`
- Create: `backend/remotion/src/scene-plan.ts`
- Create: `backend/remotion/src/scene-plan.test.ts`

**Interfaces:**
- Consumes: `MultiMediaPocInput`，其媒体顺序等价现有 `ids`，媒体 Clip 列表等价 `RecommendMediaClips.order`。
- Produces: `buildScenePlan(input: MultiMediaPocInput): ScenePlan`。

- [x] **Step 1: 写失败测试**

测试至少包含：

```ts
it('keeps an info-only media and creates no clip scene', () => {
  const plan = buildScenePlan(inputWithOneInfoOnlyMedia());
  expect(plan.scenes.map(scene => scene.type)).toEqual([
    'COLLECTION_OPENING',
    'MEDIA_INFO',
    'COLLECTION_ENDING',
  ]);
});

it('keeps media order and clip order', () => {
  const plan = buildScenePlan(inputWithThreeMedia());
  expect(plan.scenes.map(scene => scene.mediaId)).toEqual([
    undefined, 1001, 1001, 1002, 1003, 1003, undefined,
  ]);
});

it('uses prepared clip duration and exact frame totals', () => {
  const plan = buildScenePlan(inputWithKnownDurations());
  expect(plan.durationInFrames).toBe(
    plan.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
  );
});
```

同时测试：空简介、无封面、0 Clip、重复 Clip ID、负时长和缺失资源路径的输入拒绝；不得用实现代码重新计算 expected 值。

- [x] **Step 2: 运行红灯测试**

运行：

```bash
cd backend/remotion
npm test -- scene-plan.test.ts
```

预期：测试因 `buildScenePlan` 尚未实现而失败；若直接通过，说明测试没有锁定新行为，先修测试。

- [x] **Step 3: 实现最小类型与纯函数**

类型至少包括：

```ts
export type MediaMode = 'CLIPS_SELECTED' | 'INFO_ONLY';
export type SceneType =
  | 'COLLECTION_OPENING'
  | 'MEDIA_INFO'
  | 'MEDIA_CLIP'
  | 'COLLECTION_ENDING';

export interface PocClip {
  clipId: number;
  episodeNo?: number;
  episodeTitle?: string;
  title: string;
  assetPath: string;
  durationMs: number;
  sourceStartMs?: number;
  hasAudio: boolean;
}

export interface PocMedia {
  mediaId: number;
  order: number;
  mode: MediaMode;
  title: string;
  originalTitle?: string;
  year?: number;
  season?: number;
  coverAssetPath?: string;
  description?: string;
  tags: string[];
  clips: PocClip[];
}

export interface Scene {
  type: SceneType;
  mediaId?: number;
  clipId?: number;
  fromFrame: number;
  durationInFrames: number;
}

export interface ScenePlan {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  scenes: Scene[];
}
```

`buildScenePlan` 使用 3 秒开场、3 秒有 Clip 资料卡、5 秒无 Clip 资料卡、3 秒结尾；Clip 时长按 `durationMs` 转帧并至少保留 1 帧；按输入顺序生成，不按可用性重排。

- [x] **Step 4: 运行绿灯测试**

运行：

```bash
cd backend/remotion
npm test -- scene-plan.test.ts
npm run typecheck
```

预期：场景计划测试和类型检查通过。

### Task 3: 实现 Remotion Composition 和新视觉模板

**Files:**
- Create: `backend/remotion/src/RecommendComposition.tsx`
- Create: `backend/remotion/src/scenes/CollectionOpening.tsx`
- Create: `backend/remotion/src/scenes/MediaInfoScene.tsx`
- Create: `backend/remotion/src/scenes/MediaClipScene.tsx`
- Create: `backend/remotion/src/scenes/CollectionEnding.tsx`
- Create: `backend/remotion/src/Root.tsx`
- Create: `backend/remotion/src/index.ts`

**Interfaces:**
- Consumes: `MultiMediaPocInput` 和 `ScenePlan`。
- Produces: `RecommendComposition`，Player 与 renderer 使用同一组件。

- [x] **Step 1: 注册 Composition**

`Root.tsx` 注册一个 Composition：

```tsx
<Composition
  id="MultiMediaRecommendPoc"
  component={RecommendComposition}
  durationInFrames={1800}
  fps={30}
  width={1280}
  height={720}
  defaultProps={defaultPocInput}
/>
```

实际 duration、fps、宽高由输入/场景计划通过 `calculateMetadata` 或等价官方机制得到；不能用固定 1800 覆盖真实计划。

- [x] **Step 2: 实现开场和结尾**

开场视觉：深色封面拼贴、主标题、副标题、媒体统计。结尾视觉：媒体总数、有 Clip 数、资料推荐数、Clip 总数和封面回顾墙。

使用 `AbsoluteFill`、`interpolate`、`spring`、`Sequence` 等 Remotion 原生能力。文本全部使用 React 文本节点，禁止把 HTML 字符串插入 `dangerouslySetInnerHTML`。

- [x] **Step 3: 实现媒体资料场景**

有 Clip 和无 Clip 媒体都渲染同一资料组件；无 Clip 媒体显示“资料推荐 · 本次未选片段”，但不显示错误色、不创建 Video。简介最多两行，标签最多 6 个，封面不存在时渲染渐变纹理回退。

- [x] **Step 4: 实现 Clip 场景**

使用 Remotion `<Video>` 读取资源包内本地 HTTP URL；Clip 已经是裁切后的文件，因此 `startFrom` 固定为 0，播放长度由 ScenePlan 决定。显示集号、集标题和 Clip 标题的信息条，片段主体保持画面完整。

有声 Clip 使用原声；无声 Clip 不强行制造 BGM 或静音轨。资源不存在时 Composition 显示明显错误并让 renderer 失败，不自动跳过。

- [x] **Step 5: 使用场景计划驱动所有 Sequence**

`RecommendComposition` 只遍历 `plan.scenes`：

```tsx
{plan.scenes.map((scene) => (
  <Sequence
    key={`${scene.type}-${scene.mediaId ?? 'collection'}-${scene.clipId ?? ''}`}
    from={scene.fromFrame}
    durationInFrames={scene.durationInFrames}
  >
    {renderScene(scene, input)}
  </Sequence>
))}
```

不得在组件中再次根据 `clips.length`、媒体顺序或秒数创建另一份场景时序。

- [x] **Step 6: 运行组件类型检查**

运行：

```bash
cd backend/remotion
npm run typecheck
```

预期：Composition、Player 输入类型和场景组件全部通过。

### Task 4: 建立本地 Player 预览和固定样例

**Files:**
- Create: `backend/remotion/poc/sample.json`
- Create: `backend/remotion/scripts/serve-player.ts`
- Modify: `backend/remotion/src/index.ts`

**Interfaces:**
- Consumes: `sample.json` 或未提交的 `real-input.json`。
- Produces: 本地 `http://127.0.0.1:<port>` Player 页面，页面通过同一 `RecommendComposition` 预览。

- [x] **Step 1: 创建可提交结构样例**

`sample.json` 只包含 3 个媒体的文字与占位资源路径：A 两个 Clip、B 空 Clip、C 一个 Clip；不放真实视频，不放绝对路径，不伪装成可直接渲染的样例。

- [x] **Step 2: 写 Player 页面入口**

`serve-player.ts` 启动本地 HTTP 静态服务，资源根目录固定为 `poc/`，通过 `@remotion/player` 挂载：

```tsx
<Player
  component={RecommendComposition}
  inputProps={input}
  durationInFrames={plan.durationInFrames}
  fps={plan.fps}
  compositionWidth={plan.width}
  compositionHeight={plan.height}
  controls
  loop={false}
/>
```

资源只接受资源根目录下的相对路径；路径校验失败返回错误页。

- [x] **Step 3: 运行样例 Player**

运行：

```bash
cd backend/remotion
npm run player:poc -- --input poc/sample.json --port 18126
```

用浏览器打开：

```text
http://127.0.0.1:18126
```

验收：能看到开场、3 个媒体资料卡和结尾；B 没有视频元素；占位 Clip 的资源错误状态清晰可见。保存页面截图和浏览器控制台/网络结果到工作日志，不提交产物。

### Task 5: 接入真实本地资源并实现 Node MP4 渲染

**Files:**
- Create: `backend/remotion/scripts/render-poc.ts`
- Create locally only: `backend/remotion/poc/real-input.json`
- Create locally only: `backend/remotion/poc/media/*`

**Interfaces:**
- Consumes: 3 个真实媒体和短 Clip 的本地资源包。
- Produces: `backend/remotion/poc/output/multi-media-recommend-poc.mp4` 与 JSON 渲染报告。

- [x] **Step 1: 准备真实输入但不写入 Git**

从当前推荐功能已有 API/本地资源中人工选择：

```text
媒体 A：2 个短 Clip，至少一个有声
媒体 B：0 个 Clip，有封面或元数据
媒体 C：1 个 Clip，至少一个无声素材或无音轨样本
```

把视频裁成短样本放入 `poc/media/`，在 `real-input.json` 中只使用相对路径。执行预检：

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type -of json poc/media/*.mp4
```

记录媒体/Clip ID、原始入点、裁剪后时长、是否有音轨，但不把影片内容复制到仓库。

- [x] **Step 2: 在渲染脚本中验证输入**

渲染脚本必须验证：

- mediaId 唯一；
- Clip 属于当前媒体；
- `mode=INFO_ONLY` 时 clips 为空；
- `assetPath` 解析后仍在 `poc/` 根目录；
- 文件存在且为普通文件；
- `durationMs > 0`；
- 有音轨字段与 `ffprobe` 结果一致；
- 无 Clip 媒体仍有标题或稳定媒体 ID。

验证失败直接退出非 0，不静默跳过。

- [x] **Step 3: 使用官方 Node 渲染流程**

脚本按照以下顺序执行：

```ts
const bundleLocation = await bundle({
  entryPoint: path.join(projectRoot, 'src/index.ts'),
});
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'MultiMediaRecommendPoc',
  inputProps: input,
});
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation,
  inputProps: input,
  concurrency: 1,
  onProgress: ...,
});
```

`inputProps` 必须同时传给 `selectComposition` 和 `renderMedia`。渲染完成后输出：输入摘要、场景摘要、总帧数、耗时、产物大小、输出路径和错误信息。

- [x] **Step 4: 运行第一次真实渲染**

运行：

```bash
cd backend/remotion
npm run render:poc -- --input poc/real-input.json --output poc/output/run-1.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type -of json poc/output/run-1.mp4
```

预期：命令退出 0，输出包含视频流，至少包含资料媒体和 Clip 媒体对应的场景；B 的时间段没有视频文件读取。

- [x] **Step 5: 运行第二次相同输入并比较报告**

运行：

```bash
npm run render:poc -- --input poc/real-input.json --output poc/output/run-2.mp4
```

比较两次：

- `durationInFrames` 相同；
- 场景类型、媒体 ID、Clip ID 顺序相同；
- 两个 MP4 都能被 ffprobe 读取；
- 记录冷启动/热启动时间、文件大小和内存观察；
- 允许编码字节不同，但不允许场景顺序或总帧数不同。

### Task 6: POC 真实验收与路线结论

**Files:**
- Modify: `docs/worklog/2026-09-14.md`
- Modify only if accepted: `docs/superpowers/specs/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-design.md`
- Modify only if accepted: `docs/superpowers/plans/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-plan.md`

**Interfaces:**
- Consumes: Player 页面、两次 MP4、ffprobe JSON、测试和类型检查结果。
- Produces: Remotion 路线结论：通过 / 有条件通过 / 不通过。

- [x] **Step 1: 完成场景核对**

在 Player 和 MP4 中逐项核对：

```text
[ ] 开场存在且统计数字正确
[ ] 媒体 A 资料卡存在
[ ] 媒体 A 的 Clip 1、Clip 2 按选择顺序播放
[ ] 媒体 B 资料卡存在
[ ] 媒体 B 没有播放视频，也没有空白 Clip 场景
[ ] 媒体 C 资料卡和 Clip 存在
[ ] 片段标题/集信息可读并按场景出现
[ ] 结尾回顾包含 3 个媒体
[ ] 有声 Clip 的原声可听
[ ] 无声 Clip 正常渲染
```

- [x] **Step 2: 完成命令验证**

运行：

```bash
cd backend/remotion
npm test
npm run typecheck
npm run render:poc -- --input poc/real-input.json --output poc/output/final.mp4
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name -of json poc/output/final.mp4
cd ../..
node --check backend/src/main/resources/static/app.js
mvn -q -f backend/pom.xml -Dtest=RecommendSingleServiceTest test
```

旧模板冒烟只验证现有服务测试/接口没有被 POC 代码破坏；不把旧模板改造成 Remotion。

- [x] **Step 3: 记录结论**

按以下条件判定：

- **通过**：两次渲染稳定、场景正确、资料媒体保留、Clip 正确播放、Player 与 MP4 结构一致、Windows 工具链可运行；下一步才设计正式入口和业务接线。
- **有条件通过**：视觉和时序可行，但原声、路径、渲染耗时或打包存在可控限制；保留 Remotion 作为视觉层，现有 FFmpeg 继续处理素材/封装，并先补限制项设计。
- **不通过**：无法稳定读取本地资源、无法保证场景/帧数、Windows 环境无法重复渲染或依赖/许可证不适合交付；停止扩大 POC。

日志必须记录：决策、依赖版本、样本摘要、命令、退出码、浏览器验收、两次渲染指标、已知限制和下一步建议。

- [ ] **Step 4: 清理本地真实素材**（本次有意保留：见§执行结果，方便用户自行审阅；产物均在 .gitignore 内）

删除 `backend/remotion/poc/real-input.json`、`backend/remotion/poc/media/` 和 `backend/remotion/poc/output/` 中的真实内容；保留可复现的样例结构、测试代码和不含媒体的报告摘要。若用户需要保留产物，放在项目外部路径并在日志中记录位置。

## 执行结果（2026-09-14）

**结论：通过。** POC 全阶段已完成，Remotion 路线在 Windows 本机可跑通。

已交付：

- `backend/remotion/`：独立工程（`@remotion/*` 锁 4.0.524）、`buildScenePlan` 纯函数 + 4 项单测、四类场景 Composition、Player 页面、Node renderer。
- 真实样本渲染证据：`backend/remotion/poc/output/run-1.mp4`、`run-2.mp4` 与两个 json 报告（均未提交，在 `.gitignore` 内）。
- 详细数据、命令与风险见 `docs/worklog/2026-09-14.md` “Remotion 多媒体混合推荐模板最小 POC” 段。

与计划的偏差（实测事实，不粉饰）：

1. **真实样本未覆盖“同一媒体 2 个 Clip”**：8080 真实库中同一媒体只有 1 段可复用短素材；为不伪造数据库不存在的 Clip，真实渲染用了跨媒体 1+1（A 有声、C 无声）。多 Clip 分支仅由单测覆盖，建议后续指定一部具备 2+1 段素材的媒体补一次真实渲染。
2. **Task 6 Step 4 未执行**：真实素材样本与产物有意保留在现场供用户审阅，均已被 `.gitignore` 覆盖，不会进入提交。
3. **环境差异**：系统 PATH 无 ffmpeg/ffprobe，实际使用 `/d/Tool/LosslessCut/resources/` 下的工具；Remotion 首次运行自动下载 Chrome Headless Shell（约 521MB），打包体积影响未评估。

## 执行门禁

- POC 设计规格和本计划经用户审阅后，才开始 Task 1。
- Task 2 的红灯必须真实出现后才能写 Composition 逻辑。
- Task 5 真实渲染前，不接 Spring Boot API、不改现有推荐入口。
- POC 通过前，不把 Remotion 依赖加入根工程、不替换 `RecommendVideoService`、不改变默认模板。
- 只有 POC 结论为通过或有条件通过，才另行编写正式业务接线规格和计划。
