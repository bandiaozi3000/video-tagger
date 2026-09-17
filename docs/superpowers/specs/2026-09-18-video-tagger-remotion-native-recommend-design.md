# Remotion 原生重写推荐视频渲染链路 设计规格（v0.27）

- **日期**：2026-09-18
- **关联版本**：**v0.27**（用户 2026-09-18 拍板：仍归 v0.27，不回退已提交的版本号）
- **状态**：**已批准并已实现**（2026-09-18 用户四条决策 + 三项待确认全部拍板，授权「一次性执行完毕」；实际实现记录见 §15 与执行计划）。
- **前置文档**：
  - POC 设计规格：`docs/superpowers/specs/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-design.md`
  - 替换规格：`docs/superpowers/specs/2026-09-17-video-tagger-remotion-recommend-replace-design.md`
  - 当日工作日志：`docs/worklog/2026-09-17.md`、`docs/worklog/2026-09-18.md`

## 1. 目标

把推荐视频的成片生成**按 Remotion 的原生方式重做一遍**：

1. **章节模板只作为"视觉语言"参考**——不再提供结构、时间轴、交互（这三层全部按帧模型重写）。风格本身后续可能更换，因此风格必须集中、可替换。
2. **`chapter` 与 `clip` 两套样式统一**到同一套新风格与同一渲染引擎，旧 Puppeteer 链路退役。
3. **音频在 Remotion 内建**（BGM 多曲、循环、原声混合、按帧 ducking），推翻 2026-09-17 的决策 (b)。
4. 现有对外契约不倒退：`/api/recommend/video` 签名、导出任务队列、产物命名与目录、前端调用点不变。

### 1.1 非目标

- 不改媒体/Clip 业务模型与选择流程（`ids` + `mediaClips` 语义不变）；
- 不改导出任务队列的 UI 与接口形态；
- 不做 Docker / 云端 / Remotion Lambda / Electron 打包；
- 不为 `recommend-single.html`（Highlight 项目的单媒体推荐，`RecommendSingleService`）提供 Remotion 渲染；
- 不新增数据库表；
- 不做向量检索、字幕轨、多轨时间线、FCPXML/OTIO 导出。

## 2. 已确认决策（2026-09-18 用户答复）

| # | 决策 | 说明 |
|---|---|---|
| 1 | **验收口径统一到 Remotion** | 作废「与旧模板逐场景同帧抽图一致」（2026-09-17 §7.4 / §14.1）；改为「帧确定性 + 风格令牌逐项核对」 |
| 2 | **BGM 搬进 Remotion** | 推翻 2026-09-17 决策 (b)：不再「Remotion 出原声成片 → Java FFmpeg 补混 BGM」。Java 侧混流/探测/concat 代码删除 |
| 3 | **`clip` 样式按新风格来** | 不再"`clip` 保留旧链路"；两套样式共用一套组件与一个 Composition |
| 4 | **一次性重写** | 不做分批过渡，不留"新旧两套视觉"并行期 |

**沿用不动**（2026-09-17 §2 其余决策）：跑在本机（Java spawn node）、产物直接带素材原声、`RENDER_TIMEOUT_SECONDS` 40 分钟、前端零改动、无新表。

## 3. 作废与取代

本文档**取代** 2026-09-17《Remotion 替换推荐视频渲染链路》的以下内容：

| 被取代 | 原因 |
|---|---|
| §3.1「HTML 注入仅供 `clip` 样式使用」、§3.3「`clip` 暂不替换」 | 决策 3：`clip` 一并重做 |
| §7「视觉与风格对齐（搬迁级工作）」 | 决策 1：不再搬迁 DOM/CSS，只保留视觉语言 |
| §8.3「Java FFmpeg 混流改造（amix + 无音轨回退）」 | 决策 2：音频在 Remotion 内建 |
| §10「`/preview` 返回旧注入 HTML（Task 6 的做法）」 | 预览统一为 Player（见 §11） |
| §11「模板参数支持矩阵 26/29 + 决策 B」 | 参数契约重定（见 §8） |
| §11.4「按模板隐藏四项控件」 | 分组/每屏见 §14 待确认项 1 |
| §14 验收第 1 条、第 9 条 | 判定口径变更（见 §12） |

**继续有效**：§2 决策表、§6.3 校验分工、§9 进程管理、§12 部署边界、§13 不做项、§15 风险（耗时/许可证/首次环境准备）。

## 4. 分层基线（判断"能删什么"的唯一标准）

| 层 | 旧模板提供的东西 | 处置 | 现行代码里的对应物 |
|---|---|---|---|
| **视觉语言** | 深紫夜空底、星场/云光/顶部发光线、品牌色与章节强调色轮转、玻璃拟态卡与发光、渐变文字标题、大号描边序号、胶囊 chip、封面错落分布 + `coverSize` 系数、暗房"显影"动机 | **保留**：抽成设计令牌（§5），成为唯一风格来源 | `chapter.css` 的色值/发光/圆角/字体段；`params.ts` 的 `chapterCoverCoef` / `CHAPTER_GLOWS` / `chapterBgFilter` |
| **结构** | 纵向滚动页：`.story` 1080px 定宽、`min-height:100vh`、`scroll-snap-align`、`content-visibility`、`.story-card` 网格 `5fr/6fr`、`46vh` 海报、`clamp(…vw/vh)` 字号、`.chapter`/`.grid-screen` 分组屏 | **重做**：按画幅设计，尺寸由 `useVideoConfig()` 驱动 | `chapter/geometry.ts`（整层删）、`chapter.css` 的布局段 |
| **时间** | `setTimeout`/`setInterval`/`requestAnimationFrame` 状态机、22 处 `transition`、5 处 `@keyframes`、IntersectionObserver `.in-view`、自动导览 | **重做**：`Sequence` + `useCurrentFrame` + `spring`/`interpolate` | `chapter.css:29,33,48,71,74,106,186,188,267`；各场景组件的 `interpolate` |
| **交互** | 播放/静音按钮、片段轨道按钮、跳过、自动导览角标、"向下进入"滚动提示、`cursor:pointer`/hover、滚动进度 | **删**：成片里不存在交互；预览的交互由 `<Player controls>` 提供 | `BgmBar.tsx` 的两个 `<button>`、`MediaInfoScene.tsx` 的 `.clip-reel-rail button`、`CollectionIntro.tsx` 的 `.pl-cta`、`CollectionOpening.tsx` 的 `.dev-count` |

**硬禁则**（写进自动校验）：重写后的 `backend/remotion/src` 与其样式中**不允许出现** `transition:` / `animation:` / `@keyframes` / `setTimeout` / `setInterval` / `requestAnimationFrame` / `Math.random`。违反即失败（原因见 §12.1）。

## 5. 视觉语言令牌（`src/theme.ts`）

单一风格来源，各场景只允许引用令牌，不允许写死色值/发光/圆角：

| 令牌组 | 内容（从 `chapter.css` 提炼，语义保持） |
|---|---|
| 底色与画布 | `--bg` 夜空底、根容器渐变、顶部发光线（`::before` 的 `linear-gradient` + `blur(.5px)`） |
| 品牌色 | 天空蓝 / 蓝 / 粉 / 金 / 正文色 / 弱化色 / 线色（旧 `--sky/--blue/--pink/--gold/--ink/--muted/--faint/--line/--card`） |
| 强调色轮转 | `CHAPTER_GLOWS` 五色按 `order` 轮转（现 `params.ts:glowOf`） |
| 玻璃卡 | 半透明渐变底 + 1px 亮边 + 外发光 `box-shadow` + `backdrop-filter: blur` 的**静态**组合 |
| 渐变文字标题 | `background-clip:text` + `color:transparent` + `drop-shadow` |
| 大号描边序号 | `.sc-no` 的 `-webkit-text-stroke` |
| 胶囊 chip | `.chip` 尺寸/圆角/边框（含 `.s1..s5` 五档色） |
| 装饰层 | 星场（点数/半径/色相/闪烁幅度）、云光（数量/模糊/漂移幅度）、顶部发光线（呼吸幅度） |
| 开场封面 | `SPOTS` 错落分布表 + `coverSize` 系数映射（`0.65 + coverSize/100`） |
| 背景层滤镜 | `brightness = 0.2 + bgBrightness*0.016`、`blur = bgBlur/20 px`（逐字对齐旧模板，不改语义） |

`theme.ts` 用字面常量导出（不用 CSS 变量字符串拼接），方便后续整体换风格时只改一个文件。

**删除**：`chapter/chapter.css`（26KB 机械提取）、`chapter/chapter-css.ts`、`chapter/geometry.ts`、`scripts/extract-chapter-css.mjs`。

## 6. 场景模型（Remotion 原生）

### 6.1 时长权威

`buildScenePlan()` 仍是**唯一时长权威**（帧为单位），秒→帧只在该函数边界发生；Java 只保留"给用户看的预估时长"。沿用 POC 已定原则，此处无变更。

### 6.2 场景类型

| 场景 | 内容 | 帧驱动 |
|---|---|---|
| `COLLECTION_OPENING` | 封面错落分布 + **显影**（灰阶模糊 → 彩色）+ 标题板（eyebrow / 标题 / 副标题） | 每张封面按 `index * step` 起跳；`filter` 与 `opacity` **都由 `interpolate` 计算**（不再挂 CSS transition）；标题板 `spring` 推入 |
| `COLLECTION_INTRO` | 序言：kicker / 标题 / 正文 | 正文与标题 `spring` 错峰；正文超长时按画幅**自动缩字号**（§13 风险） |
| `GROUP_INTRO`（见 §14-1） | 分组章节页：`CHAPTER NN` + 组名 + 部数 + 缩略图排 + 强调色 | 逐元素 `spring`；缩略图按 index 错峰淡入 |
| `MEDIA_INFO` | 资料卡：海报 + `PICK NO.xx` + 标题 + 简介 + 标签 + 状态 | 画幅布局（海报宽 = `width * 0.34`，信息列自适应）；元素按 index `spring` 错峰 |
| `MEDIA_GRID`（见 §14-1） | 一屏 N 部：N 张封面卡（模糊底 + 清晰海报 + 标题/简介/标签） | 卡片按 index 错峰；列数按 N 计算（沿用旧规则：≤4 一行、>4 两行） |
| `MEDIA_CLIP` | 片段屏：海报外壳 + `OffthreadVideo` + 字幕条 + 计数 + 进度 | 视频用 `premountFor` 预挂载；字幕条/进度由帧算；播放器只播该片段（不做轨道/按钮） |
| `COLLECTION_ENDING` | 结尾：`THE END` + 标题 + 文案 + 封面墙 | 封面墙按 index `interpolate` 错峰（替代 `transition-delay: i*45ms`） |
| 常驻层 | 星场 / 云光 / 顶部发光线 / 顶栏 / 底部胶囊进度条 | 全部帧驱动：星场闪烁 `interpolate`（`random(seed)` 生成点位）、云光 `interpolate` 漂移、进度条按帧百分比 |

### 6.3 尺寸与排布

所有布局尺寸由 `useVideoConfig()` 的 `width`/`height`/`fps` 推导（比例常量放 `theme.ts`），**不使用 `vw/vh` 与 `clamp(...vw)`**；同一份代码在 720P/1080P/4K 下按比例成立。

### 6.4 组件纪律

- 入场：`spring({frame, fps, config})`，缓动：`Easing.bezier`；
- 确定性随机：`random(seed)`（替换手搓 LCG `seeded()`）；
- `buildScenePlan` 与 `resolveParams` 用 `useMemo` 只算一次（现为每帧重算，含全量校验）。

## 7. 音频（Remotion 内建）

### 7.1 输入

`RenderInput` 新增（Java 已能 probe 出对应值）：

```
bgm: {
  assetPath: string,                       // 拼接/循环后的完整 BGM 音轨（可选：直接给多曲）
  tracks: [{ name: string, durationSec: number, assetPath: string }],
  gain: number,                            // BGM 基准增益（默认 0.45）
  duckTo: number,                          // 有原声时压低到的增益（默认 0.18）
  fadeSec: number
}
```

### 7.2 播放

- 多曲按 `durationSec` 顺序排布，`<Audio loop volume={fn}>`；曲子接缝处做 `fadeSec` 交叉淡化；
- **ducking**：`volume={(frame) => …}` 读同一份 `ScenePlan`——当前帧落在带原声的 `MEDIA_CLIP` 场景内则压到 `duckTo`，否则回到 `gain`，进出各用 `fadeSec` 渐变。这是帧模型的天然优势（比 FFmpeg `sidechaincompress` 确定且可复现）；
- 片段原声：`<OffthreadVideo muted={!clip.hasAudio}>`（沿用 POC），音量可逐 clip 微调。

### 7.3 由此删除（Java）

| 位置 | 内容 |
|---|---|
| `RecommendVideoService.renderWithRemotion` | BGM concat 块、`remotionMixCommand`、`runMix`、`probeHasAudio`、无音轨回退分支、最终混流调用 |
| `RecommendVideoService` 字段/调用 | `ffprobe-path` 配置（音频探测用途；片段开放时长探测仍需 `ffprobe`，保留探测但不再为音频服务） |
| `RecommendService` | BGM 曲目 `bgmDurs` 只注入旧 HTML 的那条路径（旧 HTML 退役后一并删） |

`renderWithRemotion` 收敛为：写 `render-input.json` → 起 node → 收产物 → 落 `data/exports`。

## 8. 参数契约（新 `RenderParams`）

| 处置 | 参数 |
|---|---|
| 保留 | `title` `brandTitle` `subtitle` `intro` `prologueTitle` `endingTitle` `endingText` `coverSize` `detailShow` `bg*`(color/images/rotationSec/opacity/blur/brightness) `bgmScale/bgmX/bgmY` `openingSpeed` `endingScrollSpeed` `openingIds` `durations.(opening/intro/detail/ending)` `fps/width/height` |
| 新增 | `bgm.tracks[].durationSec`、`bgm.assetPath`、`bgm.gain/duckTo/fadeSec`；分组场景所需的 `media[].group`、`groupOrder`（若 §14-1 选"保留"） |
| 删除（Remotion 侧） | `groupBy` `groupSort` `perScreen` `durations.group`（若 §14-1 选"不保留"）→ 由 §14-1 决定 |

- 动效档位语义：`openingSpeed`/`endingScrollSpeed` 仍是前端 0–100 线格式（**前端零改动**），在 Remotion 侧映射为 `spring` 参数/动画帧数，不承诺与旧模板一致；
- 删除 `NOT_CONSUMED_KEYS` 及其"非 TODO"注释（契约里不再有这些键）；
- Java 侧 `buildRenderInput` 相应调整；`clip` 样式不再需要 29 占位符 1:1 镜像。

## 9. 素材通道与渲染入口

| 项 | 处置 |
|---|---|
| 素材服务 | 删 `scripts/asset-server.ts`；改 `bundle({ publicDir })` + `staticFile()`（素材根 = 每次渲染的 `work/`；封面改用相对路径，不再用 data URI 撑大 input JSON） |
| bundle 缓存 | 同一 node 进程内按工程目录缓存 `serveUrl`（每次导出重跑 `bundle()` 是纯浪费） |
| 渲染参数 | 显式传 `crf` / `h264Preset` / `pixelFormat: yuv420p` / `concurrency`；导出已由 `videoExportExecutor` 单线程串行（`AsyncConfig.java:41`），并发可提至 2–4（需实测） |
| 超时与清理 | 沿用 40 分钟 + `work/` 临时目录 + `finally` 清理 |

## 10. 旧链路退役清单

| 对象 | 处置 |
|---|---|
| `templates/recommend-chapter.html`、`recommend-clip.html`、`recommend-overview.html` | 删除（先移到 `templates/archive/`，验收通过后再删） |
| `RecommendService.buildHtml()` / `readTemplate()` / `normalizeStyle()` 的 HTML 注入面、`esc()` / `jsText()` 等注入辅助 | 删除（`isRemotionStyle()` 也不再需要） |
| `backend/scripts/render.js`、`package.json` 的 puppeteer 依赖、`chrome-path` 配置 | 删除（旧预览与旧导出都退役后） |
| `RecommendService.resolveCoverDataUrl` 的 embed 分支 | 删除（改走素材根相对路径） |
| `chapter/chapter.css`、`chapter-css.ts`、`geometry.ts`、`extract-chapter-css.mjs`、`asset-server.ts` | 删除 |
| `RecommendClipSourceService` 的 `-c:a aac` 原声准备 | **保留**（原声是本次能力） |
| `recommend-single.html` + `RecommendSingleService` | 保留（非目标） |

## 11. 预览与分享

| 端点 | 处置 |
|---|---|
| `/video` + `/video/tasks*` | 签名与行为不变，内部换实现 |
| `/preview` | 统一返回 Remotion Player 页（`backend/remotion/dist-player/`，管线已通）；`legacyPreview()` 回退分支删除 |
| `/html`（HTML 分享包） | 见 §14 待确认项 2 |

## 12. 验收标准（Remotion 口径）

1. **帧确定性（可自动化）**：同一输入、**多个场景各抽 2 帧**（含开场显影中、资料卡、片段、结尾封面墙、云光可见帧）两次渲染字节一致——现门禁只测开场 1 帧，覆盖不到动画漂移；
2. **风格令牌核对（人工）**：按 §5 清单逐项对照（色板、发光、玻璃卡、渐变标题、大序号、胶囊、星云装饰、封面分布），不看"像不像旧模板"，看"用没用同一套令牌"；
3. **参数矩阵（可自动化）**：新契约每一项都能在画面/计划里定位，报告里**没有"不消费"栏**；
4. **音频**：有原声片段可听原声；无原声片段静音；BGM 多曲顺序正确、循环不爆音、接缝无爆音；有原声处 BGM 自动压低（ducking）且进出不突跳；
5. **时序**：成片帧数 == `buildScenePlan().durationInFrames`；同输入两次渲染场景顺序与帧数一致；Clip 切点误差 ≤ 1 帧；
6. **接线无回归**：导出任务创建/进度/列表/打开目录/删除不变；产物命名与 `data/exports` 不变；
7. **分辨率**：720P 必过；1080P 至少跑通一次并记录耗时（4K 不承诺，记录风险）；
8. **失败路径**：素材缺失、渲染超时、node 非 0 退出、产物为空 → 报错文案明确、进程不挂死、临时目录清理干净；
9. **真实浏览器验收**：推荐向导 → 预览（Player）→ 导出 → 任务列表 → 打开目录，`chapter` 与 `clip` 各走一遍；
10. **硬禁则**：`backend/remotion/src` 内无 `transition`/`animation`/`@keyframes`/`setTimeout`/`setInterval`/`requestAnimationFrame`/`Math.random`（自动校验）。

### 12.1 为什么第 1 条与第 10 条是硬门禁

Remotion 逐帧渲染时帧可能乱序或重复；CSS 动画/过渡的状态取决于浏览器实时时钟，不由帧号决定 → 会闪烁、进度错乱、且**两次渲染不一致**（官方文档 `troubleshooting/css-animations`）。这正是本次要根除的"硬套"残留，必须有自动门禁兜住，不能靠人看。

## 13. 风险与遗留

| 风险 | 说明 | 处置 |
|---|---|---|
| 视觉手感无参照物 | 决策 1 之后，"像不像"没有客观 oracle，只能自审 + 你验收 | 先冻结 `theme.ts` 与三个场景（开场/资料卡/片段）让你看，再批量套用；预留整体换风格只改一个文件 |
| 正文/简介超长 | 旧模板靠滚动页容纳长文本；画幅下必须收口 | 按 `height` 自适应字号 + 行数上限 + 省略；超出策略在 plan 里定死 |
| 1080P/4K 耗时未测 | 720P 实测 226s（1803 帧）；4K 编码更慢 | 验收第 7 条；4K 记录风险不承诺 |
| ducking 听感 | 固定增益 + 淡入淡出可能不够自然 | 阈值与增益放 `bgm.*` 参数（含 `gain/duckTo/fadeSec`），可调不重编 |
| Player 预览 ≠ 成片 | Player 走浏览器实时时钟，渲染走帧 | 视觉一致（同一组件）；仅"实时播放观感"可能不同，不承诺帧级一致 |
| 前端预估时长与实际帧数偏差 | 前端 `app.js:7999` 自己算预估；`buildScenePlan` 是权威 | 接受为预估（现状已如此）；若你要求一致，另开条目 |
| 分组屏若不做 | 四项参数与前端控件变全局死开关 | 见 §14-1 |
| Remotion 许可证 | POC 规格 §12 起未核验 | 仍待你确认（自用/商业分发） |

## 14. 待确认项（**已全部拍板**，2026-09-18）

1. **分组与每屏**：**保留** —— 已实现为 `GROUP_INTRO`（章节页）+ `MEDIA_GRID`（一屏 N 部）两个场景；四项参数（`groupBy`/`groupSort`/`perScreen`/分组屏时长）在 Remotion 侧真正被消费，前端零改动。
2. **`/html` 分享包**：**退役** —— 后端端点与前端「下载 HTML」入口一并移除。
3. **版本号**：**仍归 v0.27**（不回退已提交的版本号）。

## 15. 变更记录

- 2026-09-18：初版。依据用户当日四条决策（验收口径统一 / BGM 搬进 Remotion / `clip` 按新风格 / 一次性重写）编写。
- 2026-09-18（同日）：用户批准并拍板三项待确认（见 §14）；授权「一次性执行完毕」。执行计划：`docs/superpowers/plans/2026-09-18-video-tagger-remotion-native-recommend-plan.md`。
- 2026-09-18（同日，实现后补记）**与规格的两处偏离**：
  1. **保留 `scripts/asset-server.ts`**（§9 原写换成 `publicDir/staticFile`）。理由：该素材通道已在渲染 / Player 预览 / 单帧验证三处跑通，省 36 行的收益抵不上三种运行环境的素材解析回归风险。
  2. **封面仍走 data URI（embed）**（§8 原写改素材根相对路径）。理由：避免为封面额外复制文件；渲染自足性已实测，预览走 `url` 模式。
- 2026-09-18（同日，实现后补记）**实现过程中发现并补上的两点**：`detailShow.note` 原先只作用于资料卡、漏了片段字幕条（已补，参数门禁由「未生效」转绿）；一屏 N 部时单张卡片的版式高度与 BGM 条「最后一曲循环」的进度显示已按实测画面修正。
