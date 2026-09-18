# v0.29 · 推荐工作台 UI 重做（参照「媒体详情」设计语言）

- **状态**：**已实现**（2026-09-18，用户当日说「执行」）；本文件同时承担设计规格与执行清单（偏离说明见 §7）。
- **前置**：v0.28 四阶段（`docs/superpowers/specs/2026-09-18-video-tagger-v028-recommend-editor-design.md`）已实现并提交；本版**只改编辑器前端**，不动后端、不动渲染管线、不动数据模型。
- **触发**：用户 2026-09-18 给出 v0.28 工作台截图 + 明确诉求 ——「当前 UI 样式太丑也太拥挤了，你参照媒体详情，设计一下 UI 交互，大气美观且方便易用」。
- **相关产物**：`backend/remotion/editor/{editor.css,main.tsx,panes.tsx,timeline.tsx}`、`backend/src/main/resources/static/index.html`（缓存戳）。设计对照图：`.tmp/ui/proposal-1.png`（方案 mock）、`.tmp/ui/impl-3.png`（实现效果）。

## 1. 现状诊断（都有证据，不是感觉）

1. **字号/密度是控制台级别**：全局 12px；字段用 `grid-template-columns: 88px 1fr` 把标签和控件挤成一行；行距窄、卡片 10px 圆角；边框是自造的 `rgba(130,160,255,.18)`，**与站点其它页面两套皮肤**（站点用 `--surface/--border/--grad` + 18～22px 圆角）。
2. **一栏塞多个模块**：左栏一个滚动条里装了 筛选 + 分页 + 全选 + 落点 + 网格 + 已选列表 + 片段选择器；右栏同理 10 组参数。每块都合理，叠一起就窒息。
3. **时间轴被裁**：时间轴挂在三栏**外面**的页面底部，左栏 30 张卡片把整页撞高（实测 `document.scrollHeight = 2823`，视口 1080），时间轴只露半截 —— 这份不满就是用户截图里最直观的一条。
4. **顶栏 8 个控件平权**：`章节式 / MP4 / 4K / 模板 / 导出任务 / 导出视频 / 导出全部变体` 挤一行，主操作没有主次。

## 2. 设计取向

沿用「媒体详情」（v0.24 M4）已确立的视觉语言，**不引入新字体、不引入新配色**：

| 元素 | 规格（直接复用站点既有 class/token） |
|---|---|
| 抬头卡 | 22px 圆角 + `linear-gradient(180deg, var(--surface), var(--surface-2))` + `var(--grad)` 顶部渐条 + `0 22px 55px rgba(0,0,0,.32)` 投影（= `.detail-hero` 同款） |
| 面板 | `.panel` / `.panel-head` / `.kicker` / `h3`（app.css 既有，18px 圆角） |
| 正文/标签 | 正文 13～14px；字段标签 11.5px `--text-faint`；数值用 `--font-mono` + `--cyan` |
| 控件 | `.btn-primary` / `.btn-mini`（既有）；胶囊 chip 自建（`.vt-chip`），激活态用 `--pink-soft` / `--cyan-soft` |
| 强调色 | `--pink` 交互、`--cyan` 状态/高亮、`--amber` 缺失告警 |

## 3. 布局

```
┌ Hero 抬头卡 ────────────────────────────────────────────────┐
│ RECOMMEND STUDIO（标题+副标题）         [▶ 导出视频][变体][任务] │
│ 胶囊：已选 30 部 · 5:15 / 9450 帧 · 4K·MP4 · 素材就绪 · 暂存    │
│ 设置条：模板 | 样式 | 画质 | 封装 | 主题预设 chips             │
└────────────────────────────────────────────────────────────┘
┌ 346px ────────┬── 1fr（舞台）──────────┬─ 392px（对象轴）──┐
│ LIBRARY 候选库 │ STAGE 预览舞台          │ INSPECTOR 对象轴  │
│ 候选 5528|已选30│ Player + 传输条 + 时间轴│ sticky 面包屑+对象名│
│ 筛选/工具/网格 │ （同一张卡内）           │ 可折叠 section     │
│ ↕ 内部滚动      │                        │ ↕ 内部滚动         │
└───────────────┴────────────────────────┴──────────────────┘
```

**一屏定高**：`body:has(#view-recommend:not([hidden])) main.container { height: calc(100vh - 46px); overflow:hidden }` + 隐藏站点页脚；`.vt-workspace/#view-recommend/#recommend-editor-root { height:100% }`，三栏各自内部滚动。列宽断点：≤1560px → `300/1fr/344`；≤1240px → 单列堆叠。

## 4. 交互改动

- **左栏拆 Tab**：`候选 N | 已选 N`。候选页只放 筛选 + 工具（全选本页 / ↻ 按筛选重算 / 清空）+ 网格 + 分页；已选页只放 开场代表秀落点 + 排序列表（带序号、拖拽排序、↑↓、✕）；两者不再抢同一个滚动条。
- **片段选择改弹层**：卡片上的 `＋ 片段` 打开模态（复用 `.vt-overlay/.vt-panel`），内含候选片段勾选 + 播放顺序 + 字幕条配置 —— 不再把这一整块塞进左栏。
- **时间轴搬进舞台卡**：播放器 + 传输条 + 标尺 + 段轨道 + 段信息同一张卡，**不再被页面底部裁掉**。
- **新增传输条**：⏮ 上一段 / ▶❚❚ 播放暂停 / ⏭ 下一段（按段首跳）+ `m:ss / 总长` + `帧 n / 总数` + `⟳ 只看本段`（范围预览）+ `0.5×~2× 预览倍速`（`playbackRate`，不影响导出）。
- **对象轴**：sticky 面包屑（`全局设置` / `第 N 位 › 媒体` / `第 N 位 › 片段` / `时间轴 · 第 N 段`）+ 对象名；与选中对象相关的字段加**青色左竖线**（`.vt-field.hl`）；选中段/媒体时 Inspector 顶部对象条即时更新。
- **段标签自适应**：段宽 ≤54px 时隐藏段名（只留缩略图，靠 tooltip），避免 30 段时挤成字符汤（CSS 容器查询）。
- **主题预设上提到 Hero**：随手切换，不再需要展开右侧面板（Inspector 里的原分组已删除，避免两处入口）。

## 5. 实现位置

| 文件 | 改动 |
|---|---|
| `backend/remotion/editor/editor.css` | **整体重写**：抬头卡、三栏骨架与一屏定高、面板内滚动、字段两行式、tabs、媒体卡、传输条、时间轴、对象轴、弹层、控件兜底 |
| `editor/panes.tsx` | `Toolbar` → `Hero`（状态胶囊 + 主操作 + 设置条）；`Group`（kicker + 折叠）与 `Field`（标签在上 + `hl`）重构；`BasketPane` 改面板 + 双 Tab + 片段弹层；`InspectorPane` 改面板 + 对象条 + section kicker |
| `editor/main.tsx` | 骨架改 hero + 三栏；播放状态/倍速/暂存时间；`togglePlay`、`stepScene`；时间轴与传输条移入舞台卡 |
| `editor/timeline.tsx` | 去掉自带头部（工具移入传输条）；加标尺 + 底部信息行；段名自适应 |
| `static/index.html` | `/recommend-editor/editor.{js,css}` 加 `?v=` 缓存戳（与站点其它资源同一做法） |

## 6. 验收证据（实测）

- `tsc --noEmit` 干净；`vitest` **26 passed**；`check:native` **21 个源文件通过**。
- 浏览器（Chrome 1920×1080 / 1440×900 / 1280×800 / 2560×1440，真实数据 30 部）：
  - `document.scrollHeight === window.innerHeight`（四档全部，**无整页滚动**）；`.vt-stage-body` 内部溢出 = **0**（时间轴完整可见）。
  - 新结构 DOM：`.vt-hero-title` ×1、`.vt-sec` ×8、`.vt-tab` ×2、`.vt-col` ×3、`.vt-seg` ×32。
  - 对象轴联动：点第 2 段 → 帧 300/9450，Inspector 切到「当前媒体 · 巴哈姆特之怒 GENESIS」，面包屑 `第 1 位 › 媒体`，相关字段亮青线。
  - 30 部全选：已选 30 / 9450 帧（5:15），缩略图渲染正常（无 4xx 资源请求）。
- 未重跑：`mvn test`、`verify:params/encode/player` —— 本轮**未改 Java、未改渲染管线与合成**（只动编辑器前端与 index.html）。

## 7. 偏离与取舍（先声明）

1. **未单独写执行计划**：本文件合并「规格 + 执行清单」。理由：改动纯前端、单文件级、无跨阶段依赖；如需回滚只需回退编辑器四个文件。
2. **保留 Remotion Player 原生控制条**（`controls`）+ 自建传输条：原生条提供 拖动进度/静音/全屏/PiP，自建条提供 跳段/只看本段/倍速 —— 二者的能力不重合，故此并存（代价是播放器内多一行控件）。
3. **隐藏站点页脚**：工作台是整屏工具，页脚会额外占 52px 并把一屏撞高。
4. **容器宽度**：`main.container` 在推荐视图下放宽到 1720px（与媒体详情同一处理）；否则中间舞台只有 ~530px。
5. **片段选择从内嵌改弹层**：左栏拥挤的主要来源之一。
6. **主题预设只在 Hero**：Inspector 里的同名分组已删（两处入口会让「当前值」出现两个真相源）。

## 8. 未验证 / 待决定

- **审美最终裁量权在你**：主题预设四套、抬头卡与面板的具体留白，都是可调参数，等你验收。
- **Electron 桌面模式（`body.desktop-mode`）未验**：该轨道已冻结，一屏定高用的是 `main.container` 的浏览器模式布局；桌面壳的 `.container` 另有 padding 规则，未在壳里回归。
- 1080P/4K 导出耗时仍未测；真实音频 ducking 断言仍待素材（v0.28 遗留，非本版引入）。
- v0.28 遗留的「候选重算按钮 / HTML5 拖拽落点 / 模板删除确认 / 帧溢出校正」仍未做浏览器级验证。
- 本版未升 `pom.xml` 版本号：等你说「v0.29 收尾」再统一改版本 + CHANGELOG + story。

## 9. 修复记录（同日「背景音乐 / 图片 / 详情内容不生效」）

| # | 根因（代码事实） | 影响面 | 修复 |
|---|---|---|---|
| 1 | 会话响应从未返回 `assetBaseUrl`，合成退回开发缺省值 `http://127.0.0.1:18126/assets`（那个服务只在渲染进程里起） | 预览里 **BGM 与片段素材**都加载不到 —— 表现为「音乐条在、就是没声音」 | `RecommendController.sessionResponse` 注入 `assetBaseUrl = /recommend-previews/<token>`（根相对路径，浏览器同源解析；导出链路自带素材服务并覆盖该字段，不受影响） |
| 2 | 草稿刻意不含 `bgmTracks`（base64 体积大），而草稿加载分支整体覆盖本机配置 | BGM **切 tab / 刷新即丢** | 草稿加载时合并本机 `bgmTracks`（`bgImages` 也做兜底） |
| 3 | 背景图存的是**裸 base64**，而 `assetUrl()` 只原样透传 `http(s)://` / `data:` / `/` 三类值 | 背景图**预览与导出都坏** | 背景图改存 data URI（`fileToDataUri`） |

实测证据（隔离实例 18099 + 真实浏览器 + ffmpeg 造的 wav/png 探针）：

- 修复后 `<audio src="…/recommend-previews/<token>/bgm-0.wav">`，`readyState=4`，`fetch` 得 `200 audio/x-wav len=264678`。
- 上传 BGM → 切到「媒体」再切回「推荐」：`localStorage.bgmTracks` 仍为 1、徽标保留（修复前会变 0）。
- 背景图以 `data:image/png;base64,` 出现在舞台（截图可见橙色背景铺满）。
- 资料卡的 备注 / 标签 / 状态 三项开关均生效；「切走再切回会重建会话 → 详情刷新」也实测通过（改库后：不重建显示旧值，重建显示新值）。
- 门禁：`mvn -o test` **368 passed**、`tsc --noEmit` 干净、`vitest` 26、`check:native` 21。

遗留：data URI 背景图对导出耗时/体积/内存的影响未测（大图会撑大 localStorage 与草稿 JSON，升级路径是像 BGM 一样落盘会话目录）；Java 侧修复需 Build + 重启才对 8080 生效。

