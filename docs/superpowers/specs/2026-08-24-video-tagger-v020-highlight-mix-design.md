# v0.20 单媒体高光混剪设计

- **日期**：2026-08-24
- **版本范围**：v0.20.0
- **状态**：可扩展混剪链路完成，待 Web/Electron 人工验收与高级能力演进
- **主文档约定**：本文件是 v0.20 的唯一主需求/设计文档。后续 v0.20 的需求变更、方案调整、实现状态与验收结果均直接更新本文件及变更记录，并同步唯一计划、工作日志、CHANGELOG、story 与项目记忆。
- **关联执行计划**：`docs/superpowers/plans/2026-08-24-video-tagger-v020-highlight-mix-plan.md`
- **与 v0.19 的关系**：v0.19 保持“单个 Clip 的本地裁剪、截图、浏览器录制回退”能力与既有验收范围；v0.20 以 v0.19 的 Clip/产物为上游，新增可持久化的单媒体高光制作和混剪成片能力，不删除、不替代 v0.19 浏览器录制回退。

## 1. 背景与目标

现有推荐导出按多部媒体生成封面、标题、标签、备注组成的 HTML 动画资料卡，再通过 Puppeteer/ffmpeg 渲染为视频；它不是实际片段视频的混剪。v0.19 虽能为单个片段提供裁剪、截图与录制产物，但没有“围绕一部媒体挑选高光、组织叙事、输出完整推荐视频”的制作闭环。

v0.20 的目标是把观影时积累的媒体、集、Clip、标签和封面转为可恢复的高光制作项目：

```text
媒体详情
→ 独立高光制作工作台
→ 选片 / 准备真实视频素材
→ 非破坏性微调、排序与剧透控制
→ 单段预览
→ 片头 / 可选短标题 / 片尾
→ 原声保留 + BGM 自动压低
→ 横屏 16:9 混剪导出
```

它不是替代 Premiere Pro 等专业剪辑工具。其价值是消除“重新找素材、抄时间码、重复裁剪和重新整理”的高频机械工作，并让打标数据直接变成可分享的推荐初稿。

## 2. 已确认决策

1. **独立大版本**：高光制作项目具有独立持久化模型、素材生命周期和渲染器，归入 v0.20，不并入 v0.19。
2. **入口与形态**：从媒体详情进入独立、宽屏的“高光制作工作台”，不挤入现有多媒体推荐向导。
3. **成片定位**：单媒体高光混剪；媒体资料卡只作为片头、可选转场和片尾，主体为真实视频片段。
4. **片段编排**：用户手动勾选、手动排序；在工作台中调整入点/出点只保存到制作稿，不修改原 `Clip.timestampSec/endSec`。
5. **素材优先级**：已准备/已导出的本地片段 → 本地视频库精确裁剪 → 可公开读取的直链 MP4/WebM → 无鉴权、无 DRM 的公开 HLS/DASH → 手动上传。任意段失败时显示明确状态，不静默漏片。
6. **URL 边界**：首期只处理用户有权访问且可公开读取的媒体源；不传递浏览器 Cookie、Authorization、CSRF Token；不做任意 URL 代理下载；拒绝 DRM、访问控制绕过和私网/本机 SSRF。
7. **声音**：原声保留；BGM 整片铺底，在含原声的片段内自动压低并以短淡变恢复。首期不做语音识别或复杂侧链分析。
8. **剧透**：制作段级别 `PENDING/SAFE/SPOILER`；新加入默认 `PENDING`。导出“无剧透版”时只使用 `SAFE` 段，若为空或有未就绪素材则阻止导出。
9. **叙事**：自动生成媒体片头/片尾；每段可选轻量短标题，不做复杂逐段脚本编辑。
10. **预览**：首期支持单段即时预览；不因每次编辑自动渲染全片。
11. **项目保存**：草稿可恢复；每次导出保存不可变成片快照，之后修改草稿不追溯改写旧成片。
12. **画幅**：首期 16:9，输出 720P/1080P/4K；不同源画幅采用居中完整画面 + 模糊背景填充，避免默认硬裁切。
13. **时长**：创作层不限制总时长；工作台实时预估时长、临时空间和导出成本，超过软阈值要求二次确认；服务端保留配置化硬时长/片段数/磁盘安全限制。
14. **v0.19 录制回退**：继续保留为单 Clip 的人工兜底能力，作为独立功能验收，不参与 v0.20 URL 素材自动化承诺。

## 3. 范围与非目标

### 3.1 v0.20 范围

- 高光项目、项目段和成片快照的 MySQL/SQLite 持久化；
- 媒体详情入口、独立高光制作工作台；
- 按季/集/Clip 选择、拖拽排序、非破坏性入出点、剧透状态、短标题；
- 本地片段/本地视频库素材准备与单段预览；
- 直链和公开 HLS/DASH 的受控探测接口与后端安全边界；
- 手动上传单段视频素材；
- 素材状态、重试、删除、导出前完整预检；
- 16:9 标准化、片头/片尾、转场、原声+BGM 压低、ffmpeg 混剪导出；
- 异步任务、取消、进度、产物查看/下载/清理；
- 草稿恢复与不可变导出快照；
- 删除媒体/集/Clip 时的引用失效和缓存/产物生命周期处理。

### 3.2 非目标

- 不替代专业非线性编辑器，不做多轨精细关键帧、专业调色、逐字字幕或帧级特效；
- 不承诺任意视频网站页面 URL 都可下载；
- 不绕过 DRM、付费墙、登录访问控制、反爬或版权限制；
- 不默认导入浏览器凭据或将其传给后端；
- 首期不做竖屏/方形成片、实时全片预览、自动高光挑选或多项目版本对比；
- 不删除 v0.19 浏览器录制回退。

## 4. 用户流程与状态

### 4.1 制作流程

```text
媒体详情 → 制作推荐视频
  → 选择片段（默认待确认剧透）
  → 素材准备（READY / PREPARING / UNAVAILABLE / FAILED）
  → 时间线排序、微调入出点、短标题、剧透状态
  → 单段预览
  → 配置 BGM / 导出画质 / 无剧透或全量
  → 导出前预检
  → 异步导出
  → 成片快照与文件产物
```

### 4.2 素材状态

```text
PENDING       尚未选择具体来源或未开始准备
PREPARING     正在裁剪、下载、转码或校验
READY         已存在可读取的受控本地素材
UNAVAILABLE   无可自动获取来源，需上传、重试或移除
FAILED        上一次准备失败，可查看原因并重试
```

导出前所有参与成片的项目段必须为 `READY`。无剧透导出会先排除 `PENDING/SPOILER` 剧透状态的段，再检查剩余段的素材状态；任何未就绪段均阻止导出而不是静默跳过。

### 4.3 剧透状态

```text
PENDING  新加入默认；不可进入无剧透版
SAFE     已明确确认安全；可进入无剧透版
SPOILER  明确剧透；仅全量版可进入
```

剧透状态属于项目段，不改变 `Clip` 本身。

## 5. 数据模型

### 5.1 highlight_project

```text
id
media_id
name
config_json              视觉、BGM、导出偏好等草稿配置
created_at
updated_at
```

一个媒体首期只保留一个活动草稿项目；用户可导出多次。媒体被彻底删除时，草稿标记为不可编辑/删除，已成片快照保留文件并显示来源已删除。

### 5.2 highlight_project_item

```text
id
project_id
clip_id
sort_order
in_sec                   制作稿覆盖入点
out_sec                  制作稿覆盖出点
spoiler_state            PENDING / SAFE / SPOILER
caption                  可选短标题
source_type              LOCAL_CLIP / LOCAL_LIBRARY / DIRECT_URL / STREAM / UPLOAD
source_state             PENDING / PREPARING / READY / UNAVAILABLE / FAILED
source_path              服务端受控相对路径，前端不可指定
source_message
original_volume          原声音量，首期默认 100
created_at
updated_at
```

`clip_id` 可空仅用于未来扩展手动附加素材；首期工作台从 Clip 创建，因此通常非空。`in_sec/out_sec` 默认继承 Clip 的有效区间，但保存项目段后仅以项目段为准。

### 5.3 highlight_export

```text
id
project_id
mode                     FULL / SAFE
snapshot_json            本次项顺序、时间、文案、声音和视觉配置的不可变快照
output_path              服务端受控相对路径
status                   PENDING / RUNNING / DONE / ERROR / CANCELLED
message
created_at
finished_at
```

## 6. 素材准备与安全

### 6.1 本地优先

1. 项目段已有成功片段导出时可直接复用；
2. 否则按 `videoFp` 在 v0.19 本地视频库安全定位；
3. 使用项目段 `inSec/outSec` 精确裁剪到专属缓存；
4. 统一检查时长、文件非空、规范化路径和输出格式。

### 6.2 URL 层

网页 URL 不等于媒体 URL。扩展/页面探测仅登记 `currentSrc/src` 或公开 manifest；后端仅在下列条件同时满足时下载：

- HTTP(S) 协议；
- URL 经过 DNS/IP 校验，拒绝 loopback、link-local、private、multicast、unspecified 地址；
- 重定向逐跳重新校验并限制次数；
- 限制响应大小、下载时长和允许的媒体/manifest 类型；
- 无需用户凭据、无 DRM，且用户明确发起准备。

`blob:` URL、需要 Cookie/token 的流、DRM manifest 一律显示为不可自动获取，不尝试绕过。

### 6.3 手动上传

手动上传只接受受控视频 MIME/白名单扩展名、大小上限和基础文件头校验。临时写入并完成 ffprobe/ffmpeg 基本校验后原子替换。上传不会接受客户端本地路径。

## 7. 混剪与声音

### 7.1 标准化

每段先规范为统一的临时中间文件：H.264/AAC、统一帧率/采样率、16:9 画布。非 16:9 源用原画面居中加模糊背景填充，保留完整画面。

### 7.2 视觉段

片头/片尾复用推荐导出的色板、品牌标题、媒体封面和 BGM 配置概念，但不把真实片段嵌入 HTML 录屏；视觉卡单独生成标准视频段后与素材段拼接。

### 7.3 音频

- 原始片段音轨保留，按 `original_volume` 输出；
- BGM 覆盖整片，在片段原声存在时压低至配置音量；
- 段边界以 250–500ms 淡入淡出避免爆音；
- 首期按段压低，不做复杂语音检测或侧链算法。

### 7.4 任务与产物

导出按“预检 → 素材标准化 → 视觉段 → 拼接/混音 → 原子替换”运行。任何失败/取消都不能覆盖旧成功成片。中间文件在成功后清理，孤儿临时文件延迟清理。

## 7.5 风格包与可扩展渲染

v0.20 的混剪表现不固定为“片段拼接 + BGM 混入”。时间线只保存内容编排；风格包声明视觉 token、画幅、片头/标题卡/片尾、转场和音频策略。导出前将风格包编译为 `ScenePlan`，再由受控 Renderer/Strategy 生成卡片、ffmpeg filter graph 与音频计划。

```text
项目快照
→ 风格包解析与能力校验
→ ScenePlan
→ 视觉卡片 + 真实片段标准化
→ 转场/音频计划
→ ffmpeg 合成
```

扩展边界：组合已注册能力只需配置；新增能力通过 `CanvasRenderer`、`SceneRenderer`、`ClipRenderer`、`TransitionRenderer` 或 `AudioStrategy` 注册；外部风格只允许受控 HTML/CSS 卡片模板和资源。风格包禁止任意 JavaScript、shell、路径或 ffmpeg 命令；缺少必需能力必须在导出前报错，不能静默降级。

推荐导出只复用视觉语言、卡片模板、BGM/探测/任务基础设施，不把真实视频放入浏览器截帧链路。真实片段由 ffmpeg 标准化和合成。

首期先实现统一音轨、Style Pack 校验和 ScenePlan 最小编译骨架；片头片尾卡、基础转场、场景式 BGM ducking 逐步接入，复杂侧链和 HLS/DASH 仍是后续扩展。


```text
POST   /api/media/{mediaId}/highlight-project
GET    /api/media/{mediaId}/highlight-project
PUT    /api/highlight-projects/{id}
POST   /api/highlight-projects/{id}/items
PUT    /api/highlight-projects/{id}/items/{itemId}
DELETE /api/highlight-projects/{id}/items/{itemId}
POST   /api/highlight-projects/{id}/items/reorder
POST   /api/highlight-projects/{id}/items/{itemId}/prepare
POST   /api/highlight-projects/{id}/items/{itemId}/upload
GET    /api/highlight-projects/{id}/items/{itemId}/preview
POST   /api/highlight-projects/{id}/exports
GET    /api/highlight-projects/{id}/exports
GET    /api/highlight-exports/{id}
POST   /api/highlight-exports/{id}/cancel
DELETE /api/highlight-exports/{id}
```

## 8.1 最终版执行边界与发布门禁

本节归档当前已确认的 v0.20 最终版范围；它是计划，不代表代码已经全部完成。

### 风格与渲染

- 风格配置先规范化为 canonical Style Pack，再生成 `ScenePlan`；时间线只保存内容编排，不保存视觉实现细节。
- 支持内置 `cinematic`、`energetic`、`minimal`，以及 `none`、`crossfade`、`fade-black`；Renderer/Strategy 必须来自服务端白名单。
- 外部风格包只允许受控目录中的声明式 JSON/HTML/CSS 与白名单资源；限制 ID、版本、哈希、大小、文件数量和路径范围，拒绝脚本、事件属性、外链、shell、原始 FFmpeg 和任意模板代码。
- 导出快照记录 canonical 配置、风格包 ID/哈希、请求能力、实际能力和 fallback 诊断；包被修改或删除时不得静默换版。

### 音视频与可靠性

- 所有场景统一为 H.264/AAC、30fps、48kHz stereo、SAR 1:1；有声片段保留原声，无声片段补静音。
- fixed scene ducking：卡片/转场使用正常 BGM，真实片段按配置降低；sidechain 只在存在明确本地原声输入且 FFmpeg 支持时启用，否则明确拒绝或显示 fallback。
- 转场时长不得超过相邻场景安全下限；FFmpeg 不支持 `xfade/acrossfade` 时记录 effective 能力并使用可验证 fallback。
- 导出必须处理 PENDING→RUNNING 取消竞态、阶段/场景诊断、FFmpeg 超时、旧成片保护、磁盘/时长预检和 normalized/card/part 中间产物清理。
- 原声音量修改必须持久化，卡片文本必须严格转义，直链/BGM 素材在 READY 前必须完成可解码校验。

### URL 与流媒体安全边界

- 普通 HTTP(S) 直链只允许受控准备：逐跳 DNS/IP SSRF 校验、重定向/大小/超时/媒体类型/可解码限制；FFmpeg 不得直接读取网络 URL。
- HLS/DASH 只接受安全探测结果；拒绝 DRM、密钥、鉴权、动态/直播/无界 manifest、私网跳转和任意代理下载，不转发 Cookie/Authorization，不绕过登录、反爬或版权控制。

### Release gate

- 编译、定向服务/迁移/Renderer 测试、Node 语法和 diff 检查通过；真实 FFmpeg 覆盖有声/无声、横/竖画幅、三种转场、fixed/sidechain 能力结果、取消/失败清理和最终解码。
- Web/Electron 工作台黄金路径、打包环境和真实用户媒体仍须人工验收；未完成前不能标记为生产封版。


工作台复用项目既有深色霓虹、毛玻璃弹层、圆角和 toast/confirm 体系：

```text
左栏：季 / 集 / 片段素材库，勾选与素材状态
中栏：可拖拽时间线，段封面、时长、剧透、原声、短标题、删除
右栏：项目概览、总时长/资源预估、BGM/导出设置、单段预览和导出按钮
```

窄屏仍保持可用，但桌面布局优先；不使用原生 alert/prompt/confirm。

## 10. 生命周期

- 项目段删除：仅解除项目引用；仅被该项目使用的缓存素材可异步清理；
- Clip 删除：项目段保留历史文本但标记 `UNAVAILABLE`，不能再准备或导出，直到移除/替换；
- 媒体彻底删除：草稿项目不可编辑；历史导出快照默认保留，用户可单独删除；
- 导出删除：删除对应最终文件及任务记录，不影响草稿；
- 所有临时路径、上传路径、导出路径均必须留在 v0.20 专属数据根下。

## 11. 验收标准

### 制作与数据

- 可从视频媒体详情创建/恢复高光项目；
- 按集选 Clip、排序、改入出点、改短标题和剧透状态后刷新仍保留；
- 项目内改时间不改变原 Clip；
- 无剧透导出只使用 SAFE 项，PENDING/SPOILER 被明确排除；
- 导出快照不受之后草稿修改影响。

### 素材与安全

- 已有本地片段及本地源视频可准备为 READY；
- 直链/公开流失败时给出可操作原因；不允许 SSRF、路径穿越、任意本地路径、Cookie 转发或 DRM 绕过；
- 手动上传不合法 MIME/扩展名/大小/文件头会被拒绝；
- 任一段未 READY 时导出被阻止且不静默跳过。

### 成片

- 16:9 720P/1080P/4K 成片可生成；
- 原声可听，BGM 在原声段压低且边界无明显爆音；
- 非 16:9 源完整保留且以背景适配；
- 失败/取消不破坏旧成片，删除能清理对应产物。

### 回归

- v0.19 本地裁剪、截图、连续截图及浏览器录制回退仍可独立测试；
- MySQL 与 SQLite 迁移通过；
- Web/桌面两布局可完成核心工作台流转；
- 主 spec、plan、worklog、CHANGELOG、story 与项目记忆一致。

## 12. 变更记录

| 日期 | 状态 | 变更 |
|---|---|---|
| 2026-08-25 | 可扩展链路完成 | Scene Plan 已接入卡片/真实片段/转场/BGM 合成；工作台支持内置预设、转场和片头片尾开关；外部风格包仅允许声明式 JSON；HLS/DASH 提供安全探测/明确拒绝。高级 sidechain、共享推荐卡片抽取和更多 Renderer 待演进。 |
| 2026-08-24 | 设计确认 | 建立 v0.20：单媒体高光制作工作台、分层素材准备、非破坏性时间线、剧透控制、原声+BGM压低、草稿与成片快照。确认 v0.19 浏览器录制回退继续保留。 |
