# Remotion 多媒体混合推荐模板最小 POC 设计规格

- **日期**：2026-09-14
- **关联版本**：v0.26 后续探索
- **状态**：POC 已实现并验收通过（2026-09-14）；生产接线仍待用户单独授权
- **关联执行计划**：`docs/superpowers/plans/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-plan.md`
- **前置设计**：`docs/superpowers/specs/2026-09-08-video-tagger-v026-media-recommend-video-design.md`

## 1. 目标

在现有推荐功能上新增一个基于 Remotion 的“多媒体混合推荐”模板，先用最小可运行 POC 验证 Remotion 是否适合作为 Video Tagger 的推荐视频渲染路线。

本次 POC 的核心问题只有一个：

> Remotion 能否稳定渲染一组真实媒体数据，并正确处理“有 Clip 播片段、无 Clip 播资料卡”的混合推荐流程？

本次不替换当前 HTML/Chrome/FFmpeg 推荐导出链路，不改现有模板的默认行为，也不扩展成专业剪辑器。

## 2. 已确认决策

- **入口**：沿用当前推荐视频向导，在模板选择中新增 Remotion 多媒体混合推荐模板。
- **媒体与 Clip 选择**：复用当前推荐功能的媒体选择和 Clip 选择结果；用户明确允许某个媒体不选择 Clip。
- **无 Clip 媒体**：保留为正式推荐内容，显示资料场景，不播放视频。
- **预览（4C）**：最终支持 HTML 分享/预览、Remotion `<Player>` 预览和视频导出；POC 只验证 Player 页面与 MP4，离线 HTML 分享包后置。
- **模板关系**：新模板与现有模板并存，不替换旧模板，不立即设为默认。
- **本次范围**：先做最小 POC，只证明渲染链路可行。

## 3. 用户场景

用户在推荐向导中选择多个媒体，例如：

```text
媒体 A：选择 2 个 Clip
媒体 B：不选择 Clip
媒体 C：选择 1 个 Clip
```

生成结果应保持三个媒体都存在：

```text
开场
→ 媒体 A 资料卡
→ 媒体 A 的 Clip 1
→ 媒体 A 的 Clip 2
→ 媒体 B 资料卡，不播放 Clip
→ 媒体 C 资料卡
→ 媒体 C 的 Clip 1
→ 结尾回顾
```

“没有 Clip”与“Clip 素材缺失”是两个不同状态：

- 没有 Clip：用户主动选择资料推荐模式，属于正常内容；
- Clip 素材缺失：用户选择了 Clip，但素材无法渲染，属于准备失败或待处理状态。

## 4. POC 边界

### 4.1 POC 必须支持

第一份验收样本固定为 3 个真实媒体：A 选 2 段短 Clip、B 不选 Clip、C 选 1 段短 Clip。样本控制在约 30～60 秒，不构成正式产品的媒体数或时长上限。

- 多媒体输入；
- 每个媒体 0～N 个 Clip；
- 媒体资料场景；
- 有 Clip 时播放真实本地视频片段；
- 无 Clip 时只显示资料信息；
- 媒体标题、年份、季度、封面、简介、标签；
- 媒体级 Clip 数量和集数统计；
- 开场页；
- 媒体资料卡；
- 片段标签条；
- 基础章节/媒体分隔；
- 结尾回顾页；
- Remotion Player 浏览器预览（Studio 仅用于开发调试，不能代替 Player 验收）；
- Remotion 服务端渲染一个可播放视频产物；
- 16:9、720P、30fps、H.264 MP4 作为 POC 默认输出；
- 至少一个有原声 Clip、一个无音轨 Clip；无 BGM，有声片段保留原声，无声素材正常渲染；
- 空简介、空标签、无封面、无 Clip 媒体仍能完成渲染。

### 4.2 POC 暂不支持

- 替换现有旧模板；
- 修改现有推荐数据模型；
- 修改 `HighlightProject` / `HighlightProjectItem` 的数据库结构；
- 多首 BGM、BGM 淡入淡出和复杂音频编排；
- 复杂转场编辑；
- 自定义 CSS 主题编辑器；
- 多轨时间线；
- 字幕轨、关键帧、调色和专业特效；
- Remotion Lambda 或云端渲染；
- 自动挑选 Clip；
- 远程 URL 直接交给 Remotion 播放；
- 生产级异步任务迁移；
- Electron 打包集成；
- FCPXML/OTIO 导出。

## 5. 模板视觉方向

模板采用“暗色影院感 + 编辑部片单 + 轻量榜单”的方向，参考影视流媒体、影视资料库、视频分享和年度榜单网站的共同视觉模式，但不复制具体网站界面。

### 5.1 视觉特征

- 深色背景，使用封面或代表画面形成低对比度背景层；
- 明确的内容层级：序号、标题、元数据、简介、标签、片段；
- 大尺寸海报/封面作为媒体识别核心；
- 信息卡与真实视频画面之间有明显节奏变化；
- 资料型媒体也具有完整的视觉重量；
- 使用少量强调色标记当前媒体、章节和进度；
- 采用细颗粒、渐变遮罩、模糊背景和轻微缩放制造影院感；
- 文字控制在可读范围，优先保证视频观看距离下的识别度。

### 5.2 场景结构

```text
COLLECTION_OPENING
  → MEDIA_INFO
  → MEDIA_CLIP*（有 Clip 才生成）
  → MEDIA_BREAK（可选）
  → 下一个 MEDIA_INFO
  → COLLECTION_ENDING
```

### 5.3 开场页

展示：

- 推荐主题；
- 副标题或主题简介；
- 媒体总数；
- 有 Clip 的媒体数；
- Clip 总数；
- 封面拼贴或海报带。

POC 中主题和副标题可以使用当前推荐向导已有字段；没有填写时使用稳定默认文案。

### 5.4 媒体资料卡

默认展示：

- 媒体序号；
- 标题；
- 原始标题或外部标题（有则显示）；
- 年份/季度；
- 封面；
- 最多两行简介；
- 最多 6 个标签；
- 本次 Clip 数量；
- 涉及集数；
- “片段推荐”或“资料推荐”状态。

封面回退顺序：

```text
本地媒体封面
→ 代表性 Clip 封面
→ 外部元数据封面
→ 纯色/纹理背景
```

### 5.5 有 Clip 媒体

资料卡后按用户的 Clip 顺序播放片段。片段开始时显示：

- 第几集；
- 集标题；
- Clip 标题；
- 可选剧透状态。

信息条短暂出现后淡出，视频主体保持简洁。

### 5.6 无 Clip 媒体

仍生成 `MEDIA_INFO` 场景，不生成 `MEDIA_CLIP` 场景。资料卡可以带轻量状态文字：

```text
资料推荐 · 本次未选片段
```

该状态不是错误提示，不阻断后续媒体播放。

### 5.7 结尾页

展示：

- 推荐媒体总数；
- 有 Clip 的媒体数量；
- 资料推荐媒体数量；
- Clip 总数；
- 封面回顾墙；
- 推荐主题和结束文案。

## 6. 数据与场景计划

### 6.1 现有数据复用

- 多媒体推荐入口使用 `RecommendController.RecommendExportRequest.ids` 与 `mediaClips`。
- 每媒体选片使用 `RecommendMediaClips.order` 和 `badge`；没有映射或空 `order` 代表本次未选 Clip。
- 多媒体草稿和命名预设继续使用 `RecommendDraft.config`、`RecommendTemplate.config`。
- `HighlightProject` / `HighlightProjectItem` 属于单媒体制作稿，本 POC 不把它们当作多媒体业务模型。
- `RecommendClipSourceService.prepare()` 当前用 FFmpeg `-an` 生成无声素材；如果 POC 要验证原声，必须使用已准备的有声本地样本，或单独补一条保留原声的 POC 准备命令，不能默认现有输出保留原声。

### 6.2 POC 输入

POC 不新增数据库表或业务写接口。先只读提取真实数据，按显式选择的媒体和 Clip ID 构造本地 JSON；不把真实数据库、影片或凭证提交到 Git。媒体按 `ids` 顺序展示，Clip 按每媒体 `order` 顺序展示，不能按可用 Clip 反推媒体集合。

准备后的 Clip 以资源包相对路径和 `durationMs` 表示；已裁好的文件从第 0 帧播放，原视频起点只作为核验字段。Remotion 通过本地 HTTP 静态资源服务读取资源，不向 Player 传 `file://`。

POC 不新增数据库表。业务输入先转换为独立的渲染数据和场景计划：

```json
{
  "template": "MULTI_MEDIA_REMOTION_POC",
  "title": "今夜看点",
  "subtitle": "值得反复回看的动画瞬间",
  "fps": 30,
  "width": 1280,
  "height": 720,
  "media": [
    {
      "mediaId": 1001,
      "order": 1,
      "mode": "CLIPS_SELECTED",
      "title": "作品 A",
      "year": 2024,
      "season": 1,
      "coverAssetPath": "media/poster-1001.jpg",
      "description": "简介摘要",
      "tags": ["热血", "战斗"],
      "clips": [
        {
          "clipId": 501,
          "episodeNo": 3,
          "episodeTitle": "第三集",
          "title": "爆发瞬间",
          "assetPath": "media/clip-501.mp4",
          "sourceStartMs": 12500,
          "durationMs": 12300,
          "originalVolume": 1
        }
      ]
    },
    {
      "mediaId": 1002,
      "order": 2,
      "mode": "INFO_ONLY",
      "title": "作品 B",
      "year": 2022,
      "coverAssetPath": "media/poster-1002.jpg",
      "description": "简介摘要",
      "tags": ["日常", "喜剧"],
      "clips": []
    }
  ],
  "scenes": [
    { "type": "COLLECTION_OPENING", "fromFrame": 0, "durationInFrames": 180 },
    { "type": "MEDIA_INFO", "mediaId": 1001, "fromFrame": 180, "durationInFrames": 150 },
    { "type": "MEDIA_CLIP", "mediaId": 1001, "clipId": 501, "fromFrame": 330, "durationInFrames": 369 },
    { "type": "MEDIA_INFO", "mediaId": 1002, "fromFrame": 699, "durationInFrames": 150 },
    { "type": "COLLECTION_ENDING", "fromFrame": 849, "durationInFrames": 180 }
  ]
}
```

示例中的 `scenes` 是生成结果，不手工维护。POC 用纯函数 `buildScenePlan(input)` 生成完整场景顺序和总时长，Player 与 Renderer 共同调用；Composition 只消费计划。正式接线时由 Spring Boot 负责业务校验和快照，但不复制第二套时长算法。

POC 统一使用帧作为渲染时间单位：

```text
业务数据：秒/毫秒
ScenePlan：帧
Remotion：帧
```

秒到帧的转换只发生在场景计划生成边界，避免前端、Java 和 Remotion 各自计算时长。

## 7. Remotion 分层

```text
Spring Boot
├─ 读取现有推荐选择结果
├─ 组装媒体和 Clip 元数据
├─ 准备/校验本地素材
├─ 生成 MultiMediaScenePlan
└─ 调用 Node Remotion Renderer
      ├─ bundle
      ├─ selectComposition
      └─ renderMedia
```

Remotion 项目是独立的 Node 工程，建议放在：

```text
backend/remotion/
├─ package.json
├─ remotion.config.ts
└─ src/
   ├─ Root.tsx
   ├─ MultiMediaRecommend.tsx
   ├─ types.ts
   ├─ scenes/
   │  ├─ CollectionOpening.tsx
   │  ├─ MediaInfoScene.tsx
   │  ├─ MediaClipScene.tsx
   │  └─ CollectionEnding.tsx
   └─ index.ts
```

POC 可以先由 renderer 接收 JSON 文件路径或标准输入数据，不要求第一步就接入完整 Spring Boot 任务系统。

官方 Remotion Node 渲染路径通常为 `bundle()`、`selectComposition()` 和 `renderMedia()`；Player 可以复用同一个 Composition 做浏览器预览。相关依据：

- https://www.remotion.dev/docs/player/integration
- https://www.remotion.dev/docs/ssr-node
- https://www.remotion.dev/docs/passing-props
- https://www.remotion.dev/docs/renderer/render-media

## 8. 资源边界与安全

- Remotion POC 只消费已经准备好的本地素材；
- 外部封面先经现有受控读取能力准备为本地资源；不把外部 URL、Cookie、Authorization 或任意请求头交给 Remotion；
- 媒体 ID、Clip 归属、空选择、重复 ID、时间范围和资源路径均需预检；选中 Clip 不存在、越界或不可解码时明确报错，POC 阻止导出，不静默退化为资料卡；
- 标题和简介作为文本渲染，不接受可执行 HTML；字体随本地资源准备，不依赖导出时在线下载；
- HTML 分享包如何携带 JS/媒体资源在正式接线阶段验证，不能把 Player 页面称为无需资源依赖的自包含 HTML。
- 继续复用当前受控素材准备和路径校验；
- 分享/导出数据不直接暴露服务器内部绝对路径；
- POC 生成目录使用临时目录，失败时清理；
- 生产导出是否允许嵌入远程资源，留到 POC 通过后另行设计。

## 9. 成功标准

POC 只有在以下条件全部满足时才算“Remotion 路线可行”：

1. 能用固定样例数据启动 Remotion Composition；
2. 能渲染至少 3 个媒体，其中至少 1 个有 Clip、至少 1 个无 Clip；
3. 有 Clip 的媒体确实播放指定本地片段，并遵守入点/出点；
4. 无 Clip 的媒体仍显示资料卡，且不产生空视频场景；
5. 开场、资料卡、片段、结尾顺序正确；
6. 生成 MP4 可以被 `ffprobe` 或等价工具读取；
7. 视频帧数等于 ScenePlan 的 `durationInFrames`；容器总时长允许音频封装误差不超过 0.1 秒，Clip 切点与目标误差不超过 1 帧；
8. Player/浏览器预览与视频成片的场景顺序和主要视觉内容一致；
9. 现有旧模板和旧导出接口不受影响；
10. Windows 开发环境完成同一输入的两次本地渲染，场景顺序和帧数一致；记录依赖版本、冷/热渲染耗时、内存观察、成片大小和输出截图；
11. 原声片段在对应时间段可听，无声素材和资料场景正常静音；Player 暂停/继续后时序正常；
12. 用户可以直接打开 Player 页面和样例 MP4 审阅；旧模板至少进行一次原有预览冒烟验证。

如果 Remotion 无法稳定读取本地 Clip、渲染时间严重不可控、打包或路径处理不适合当前桌面交付，则 POC 结论为“不适合直接进入生产链路”，不继续扩大实现范围。

## 10. 后续决策

POC 结束后只做一次技术决策：

- **通过**：进入 Remotion 模板业务接入，先替换新模板自己的预览/视频渲染，不动旧模板；
- **有条件通过**：保留 Remotion 用于视觉模板，素材准备和最终封装继续由现有 FFmpeg 链路负责；
- **不通过**：保留验证报告和可复现证据，停止扩大 POC；由用户决定归档或删除实验代码。

## 11. POC 实测结果（2026-09-14）

- 环境：Node v22.20.0、npm 10.9.3、Remotion 全部 `@remotion/*` = 4.0.524；ffmpeg/ffprobe 用 `/d/Tool/LosslessCut/resources/`。
- 真实样本：少女与战车（1 Clip，有声）、铃铛猫娘 夏季特别篇2000（无 Clip）、现视研 2代目（1 Clip，无声）。
- 场景计划：813 帧；两次渲染场景与帧数一致；冷 168.5s / 热 106.9s；产物 3.47MB。
- 产物：h264 1280×720 30fps AAC 2ch，27.100s；有声段 mean -31.4dB，资料-only 与无声段 -91.0dB。
- 逐场景抽帧与 Player 对照均符合预期；资料-only 场景 `video` 元素为 0。
- 结论：**通过**（POC 路线可行）。
- 未覆盖：真实渲染下的“同一媒体 2 个 Clip”（真实库无足够素材，仅单测覆盖）；BGM；1080P/4K；Electron 打包；Remotion 自带 Chrome Headless Shell 约 521MB 的打包与分发影响。

## 12. 工具链与审阅记录

实施时先检查工作区已有 Node、React、Remotion 使用情况，再只为 POC 添加必要依赖；所有 `@remotion/*` 使用一致且锁定的版本。保留现有 Puppeteer 依赖，POC 不升级它。

需要核验当前 Remotion 的 Node 版本、Windows 视频组件/解码器、许可证、商业分发和自动化渲染条件，不预设全量兼容或免费分发。官方资料：

- https://www.remotion.dev/docs
- https://www.remotion.dev/docs/license
- https://github.com/remotion-dev/remotion/blob/main/LICENSE.md

Remotion 的 Node 渲染仍使用浏览器逐帧绘制与视频编码；本 POC 不预设它一定比当前 FFmpeg 链路更快，主要验证时序一致性、模板复用和渲染稳定性。

## 13. 审阅和变更记录

- 用户已确认 1A、2C、3A、4C、5 新增并存。
- 用户授权生成本设计规格和执行计划，尚未授权开始 POC 编码。
- 原 v0.26 单媒体方案继续有效；其中“暂不引入 Remotion”只约束原生产计划，本次明确指定的独立实验不受该条限制。
