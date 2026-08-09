# 推荐导出细化（v0.18）：BGM 多曲 / 副主题 / 封面大小 / record 徽标 / 开局自选

- 日期：2026-08-09
- 版本：0.18.0
- 状态：grilling 确认，直接实施

## 需求（用户 6 点）

1. **BGM 多曲**：设置主题可多选 BGM；**顺序连续播放**，每首快结束时 BGM 条提示「即将播放：下一首名」；视频导出多曲按序拼接混入音轨。
2. **开局自选番剧**：模板开场显示哪些 = 向导勾选；确保步骤1开局勾选清晰 + 数量提示（「已选 N 部 · 开场将显示 N 个封面」）。
3. **副主题可配置**：主标题外可配副题；模板副题由占位符注入，**存在则显示、不存在隐藏**（当前写死「珍藏之作 · 逐张显影」）。
4. **封面大小可调**：预览加「小/中/大」下拉，**默认中（比现略大）**；模板开场卡片按系数缩放。
5. **record 去徽标**：视频导出（`?record=1`）时右上角「✦ 自动导览中」不显示。
6. **BGM 条信息**：多曲时 BGM 条显示**当前曲名 + 进度 + 时间** + 下一首提示。

## 设计

### 后端
- `RecommendExportRequest` 新增：`List<BgmTrack> bgmTracks`（name/base64）、`String subtitle`、`String coverSize`（sm/md/lg）。保留旧 `bgmName/bgmBase64`（bgmTracks 空且旧字段有 → 单曲）。
- `RecommendService.buildHtml(..., subtitle, coverSize, bgmTracks)`：
  - 注入 `__SUBTITLE__`（空 → 模板隐藏副题）
  - 注入 `__COVER_SIZE__`（sm/md/lg，模板 JS 映射开场卡片 scale 系数）
  - 注入 `__BGM_TRACKS__`（JSON 数组 `[{name, src(dataURI)}]`；兼容单曲）
- `RecommendVideoService.render`：bgmTracks >1 → ffmpeg concat 多曲（统一 44100 stereo）成临时音频 → 单 `--bgm` 路径；单曲直接传。

### 模板三套（stream/chapter/overview）
- hero-plate：副题 `<div class="sub" id="heroSub">__SUBTITLE__</div>`，注入空 → JS 隐藏该元素。
- 开场卡片：`__COVER_SIZE__` → JS `COVER_COEF`（sm .82 / md 1.15 / lg 1.4），乘以 SPOTS scale 与基准尺寸。
- BGM：多曲播放队列——数组按序，`audio.onended` 自动播下一首；`timeupdate` 检测剩余 < 4s → BGM 条显示「即将播放：{下一首名}」；当前曲名/进度/时间正常显示；record 模式自动从第 1 首起播。
- record：`IS_RECORD` 时 autoBadge 不显示（`beginAutoGuide` 里 `if (!IS_RECORD) autoBadge.hidden = false`）。

### 前端
- 步骤2：
  - 副标题输入 `#recommend-subtitle`（可空）。
  - BGM 改为**多选**（file input `multiple`），列表显示已选曲目（名称 + 移除），顺序即添加序。
  - 请求 body 带 `subtitle` + `coverSize` + `bgmTracks[]`。
- 预览弹窗：加「封面大小」下拉（小/中/大），改选后重新生成预览（带 coverSize）。
- 步骤1：`updateRecommendCount` 补提示「开场将显示 N 个封面」。
- 视频导出 >30 校验保留。

## 兼容
- 不传新字段行为不变（无 BGM / 无副题 / 默认封面大小 md / 单曲旧字段可用）。

## 测试
- `RecommendServiceTest`：subtitle 注入/空隐藏、coverSize 注入、bgmTracks 多曲 JSON、单曲兼容。
- 模板 puppeteer（validate-templates.js 扩展）：多曲队列存在、副题空隐藏、record badge 隐藏、封面系数生效。
- 手工：向导多曲选择/播放衔接/下一首提示、封面大小三档预览、视频导出多曲混音。

## 涉及
- 改：`RecommendController`、`RecommendService`、`RecommendVideoService`、三套模板、`index.html`、`app.js`、`app.css`、`RecommendServiceTest`、`RecommendVideoServiceTest`、pom(0.18.0)、CHANGELOG、story、worklog。
