# Video Tagger 推荐导出 BGM 支持设计（v0.16）

> 日期：2026-08-08
> 前置：用户要求推荐导出页面添加 BGM——BGM 名称、播放进度在 HTML 页面显示，导出视频时 BGM 一并导出。
> 目标：推荐向导支持选本地音频 BGM；生成的自包含 HTML 内嵌 BGM（base64）并显示名称/播放进度/静音开关；导出 MP4/WEBM 时 BGM 循环混入音轨。
> 版本：升到 **0.16.0**。

## 1. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | BGM 来源 | **本地文件上传**（mp3/m4a/wav），前端 FileReader 读 base64 |
| 2 | 视频 BGM 时长 | **循环到结束**（ffmpeg `-stream_loop -1` + `-shortest`，导览多久播多久） |
| 3 | HTML 自包含 | **base64 内嵌**（保持单文件可分享，文件变大几 MB）；HTML 内自动播放 + 名称 + 播放进度条 + 静音开关 |

## 2. 数据流

```
前端选本地音频 → FileReader 读 base64（存 recommendBgm {name, base64, mime}）
  → POST /api/recommend/html  body {ids, title, bgmName, bgmBase64}    → buildHtml 注入 __BGM_*__ 占位符
  → POST /api/recommend/video body {ids, title, format, resolution, bgmName, bgmBase64}
      → 后端解 base64 写临时 BGM 文件 → render.js --bgm → ffmpeg -stream_loop -1 -i bgm -shortest 混音 → 输出视频
```

## 3. 后端改动

### 3.1 `RecommendExportRequest` record 加字段

```java
public record RecommendExportRequest(List<Long> ids, String title, String format, String resolution,
                                     String bgmName, String bgmBase64) {}
```

（前端不传 BGM 时两字段 null，行为不变。）

### 3.2 `RecommendService.buildHtml`

- 模板加 `__BGM_SRC__`（base64 data URI，`data:audio/mpeg;base64,...`）与 `__BGM_NAME__` 占位符。
- 有 BGM：注入 base64 与名称；无 BGM：占位符替换为空 + 模板 JS 隐藏 BGM 区。
- mime 由前端传入或按 base64 前缀推断（audio/mpeg 等）。

### 3.3 `RecommendController` + `RecommendVideoService`

- `html`：`buildHtml(ids, title, bgmName, bgmBase64)`。
- `video`：解 base64 → 写临时 `.mp3/.m4a/.wav`（扩展名按 mime/前端传）→ `recommendVideoService.render(ids, title, fmt, resolution, bgmPath)` → 完成后清理临时文件。
- `RecommendVideoService.render` 加 `bgmPath`（null=无 BGM）→ ProcessBuilder 加 `--bgm`。

## 4. 模板 `recommend.html`

- BGM 区（右下角小条，贴合霓虹风格）：`<audio id="bgm" src="__BGM_SRC__" loop>`（仅 BGM 时渲染）。
- 显示：BGM 名称 + 播放进度条（`timeupdate` 更新 `currentTime/duration`，进度填充）+ 静音开关（♪ 点击切换）。
- 自动导览（`?record=1`）自动 `bgm.play()`；手动模式提供播放/暂停。
- `__BGM_SRC__`/`__BGM_NAME__` 为空时不渲染 BGM 区。

## 5. render.js 混音

- 加 `--bgm <path>` 可选参数。
- ffmpeg 命令加：`-stream_loop -1 -i <bgmPath>`（BGM 循环）+ 音频编码 `-c:a aac`（mp4）/ `-c:a libopus`（webm）+ `-shortest`（以视频帧时长结束）。
- 无 `--bgm` 时命令不变。

## 6. 前端推荐向导

- 主题步骤（②）加「🎵 添加 BGM」：`<input type=file accept="audio/*">` → FileReader 读 base64 → 显示 BGM 名称 + 「移除」按钮。
- `exportRecommendHtml`/`exportRecommendVideo` 请求 body 带 `bgmName`/`bgmBase64`。
- 预览弹窗内 iframe 的 BGM 可播放（用户手动点，浏览器 autoplay 策略限制）。

## 7. 测试与验证

1. 编译 + 单测（RecommendService buildHtml BGM 注入、RecommendController DTO 字段）。
2. 起后端：`/api/recommend/html` 带 bgmBase64 → HTML 含 `data:audio` + BGM 名称；无 BGM → 无 BGM 区。
3. `/api/recommend/video` 带 bgmBase64 → 输出 MP4 带音轨（ffprobe 验证 `has audio`）+ BGM 循环。
4. 前端：向导选 BGM 显示名称、导出请求带 bgm 字段。

## 8. 非目标

- BGM 音量/淡入淡出/多首循环列表（后续按需）。
- HTML 下载后 BGM 播放兼容性（浏览器 autoplay 策略，需用户交互）。
