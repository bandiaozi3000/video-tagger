# 推荐导出重构：独立「推荐」tab + 分步向导（v0.13）设计

> 承接：`2026-08-07-video-tagger-recommend-html-design.md`（v0.12 已交付勾选→HTML→视频链路）
> 用户反馈：「流程不太喜欢。推荐希望做成一个单独的工具栏，页面分几个步骤：勾选番剧 → 主题 → 预览 HTML → 预览里导出视频 → 勾选视频标题/格式/清晰度/导出地址」
> 版本：**0.13.0**（当前 pom 0.12.0，流程级重构 + 新交互，升大版本）

## 拍板决策（ask 四问，2026-08-07）

1. **主题 = 标题文案**：仍是渐变环流排布，但推荐页的**标题文字可自定义**（默认「我的番剧推荐」）。不是配色、不是模板风格。
2. **预览形式 = 弹窗内嵌 iframe**：在向导流程里调后端生成 HTML，用 iframe 在弹窗内渲染预览，旁置「导出视频」按钮，不离开当前页面。
3. **导出地址 = 浏览器保存弹窗（File System Access API）**：导出视频时 Chrome 弹出系统「另存为」对话框，用户选本地位置写文件；非 Chromium 浏览器降级为普通下载。
4. **入口 = 独立「推荐」tab**：顶部导航新增「推荐」视图，页面本身即分步向导，勾选在向导内部完成，**不依赖媒体页勾选**。

## 现状盘点（读码确认）

**后端（v0.12 已交付）**：
- `RecommendService.buildHtml(List<Long> ids)`：ids → slide JSON → 替换 `/*__SLIDES_JSON__*/` 返回自包含 HTML。
- 模板 `templates/recommend.html`：`<title>我的番剧推荐</title>`（第 6 行）与 hero `<h1>我的番剧推荐</h1>`（第 288 行）**硬编码**标题。
- `RecommendVideoService.render(List<Long> ids, String resolution)`：buildHtml → 临时文件 → `node render.js`（参数 `--html --out --width --height --duration --chrome --ffmpeg`）→ mp4。
- `render.js`：CFR `-framerate` image2 → ffmpeg `-c:v libx264 -preset veryfast -movflags +faststart`（写死 h264 mp4）。
- `RecommendController`：DTO `RecommendExportRequest(List<Long> ids, String resolution)`；`POST /html` + `POST /video` 附件下载。
- 本机 ffmpeg 支持 libx264 / libvpx-vp9 / libx265 / libaom-av1（已验证）。

**前端（v0.12 已交付）**：
- nav tab 用 `data-view` 切换：search/media/videos/stats/tags/collections，`showView(name)` 统一调度，views Map 注册 section。
- 媒体页批量勾选：`mediaBatchMode`/`mediaSelected`/`renderMediaGrid`/`.media-batch-cb`（勾选框现已**常驻**，v0.12 修复）。
- 现有「导出推荐」按钮在媒体页工具栏（`#media-recommend`），依赖 `mediaSelected` 计数。

## 设计

### 一、整体流程（独立「推荐」tab，分步向导）

```
顶部导航 +「推荐」tab
  └── view-recommend 页面
        ├── 步骤条（Step ① 勾选 → Step ② 主题 → Step ③ 预览导出）
        ├── ① 勾选面板：媒体网格（勾选框常驻，独立集合 recommendSelected，含筛选）
        ├── ② 主题面板：标题文案输入（默认「我的番剧推荐」，实时预览标题示例）
        └── ③ 预览导出面板： 
              ├─「生成预览」→ 调后端 → iframe 弹窗内嵌渲染 HTML
              │    预览弹窗底部：「导出视频」按钮
              └─ 导出视频弹窗：视频标题 / 格式(mp4·webm) / 清晰度(720P·1080P·4K) / 导出地址
```

**步骤间导航**：①→② 需 recommendSelected 非空；②→③ 需标题非空（或默认值即可）。每步「上一步」返回。「生成预览」可重复点击（改了标题/勾选后重新生成）。

### 二、后端改动

1. **`RecommendService.buildHtml(List<Long> ids, String title)`**：
   - title 空/null → 默认「我的番剧推荐」。
   - 模板新增占位符：`__TITLE__` 替换 `<title>` 与 hero `<h1>` 两处（用 `HtmlUtils.htmlEscape` 转义防注入）。
   - 保持向后兼容重载 `buildHtml(ids)` → `buildHtml(ids, null)`。

2. **`RecommendController`** DTO 扩参：
   - `record RecommendExportRequest(List<Long> ids, String title, String format, String resolution)`。
   - `/html` 端点用 `body.title()`；`/video` 端点用 `body.title() + body.format() + body.resolution()`。

3. **`RecommendVideoService.render(ids, title, format, resolution)`**：
   - format 规范化：`MP4`→`mp4`（h264）、`WEBM`→`webm`（vp9），默认 mp4；未知 → IllegalArgumentException。
   - 透传 `--format` 给 render.js；输出扩展名随 format（`.mp4`/`.webm`）。
   - Content-Type 由控制器按 format 返回（`video/mp4` / `video/webm`）。

4. **`render.js` 加 `--format`**：
   - `mp4`：`-c:v libx264 -preset veryfast -movflags +faststart`（现行为）。
   - `webm`：`-c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1`（vp9 高质量恒定画质；VP9 编码慢于 x264，渲染时间更长，4K 尤甚）。
   - 校验：`ffmpeg -encoders` 已确认 libvpx-vp9 可用。

### 三、前端：独立「推荐」tab

1. **index.html**：
   - nav 增 tab：`<button class="tab" data-view="recommend">✦ 推荐</button>`（放在「收藏夹」后）。
   - 新增 `<section id="view-recommend">`：步骤条 + 三步面板 + 两个弹窗（`#recommend-preview-modal`、`#recommend-export-modal`）。
   - views 注册：`recommend: document.getElementById('view-recommend')`。
   - 媒体页工具栏的 `#media-recommend` 按钮**移除**（入口收归独立 tab；媒体页勾选仅服务批量删除）。

2. **app.js**：
   - `showView` 加 `if (name === 'recommend') loadRecommend()`。
   - `recommendSelected = new Set()`（**独立**于媒体页 mediaSelected）。
   - `renderRecommendGrid(list)`：复用 `.media-card`/`.media-cover`/`.media-batch-cb` 等既有 CSS 类与元信息组装，**独立渲染函数**（不复用 renderMediaGrid，避免与批量删除全局态耦合），勾选事件改走 recommendSelected。
   - 步骤状态机：`recommendStep`（1/2/3），`renderRecommendStep()` 切面板 + 步骤条 active 态。
   - `generateRecommendPreview()`：POST `/api/recommend/html`（`{ids, title}`）→ blob → `iframe.srcdoc = html`（自包含页面，base64 封面无外部依赖）→ 预览弹窗。
   - 预览弹窗「导出视频」→ 打开导出弹窗。
   - `exportRecommendVideo()`：POST `/api/recommend/video`（`{ids, title, format, resolution}`）→ blob →
     - **Chromium**（`window.showSaveFilePicker` 存在）：`showSaveFilePicker({suggestedName: '视频标题.扩展名', types:[{video/mp4:['.mp4']}|{video/webm:['.webm']}]})` → `createWritable()` 写入 → toast「已保存」。
     - **降级**：普通 `a.download` 下载到默认目录（非 secure-context / 非 Chromium）。
   - 勾选/标题变更后清除旧预览缓存（下次点「生成预览」重新生成）。

3. **app.css**：新增 `.wizard-steps`/`.wizard-step`/`.step-card` 步骤条与面板样式（**严格贴合现有暗色霓虹风格**：`--pink:#ff4d8d` active、毛玻璃卡、圆角、现有字体栈）；复用 `.modal` 做两个弹窗；预览 iframe 样式（`.preview-frame`，全屏/无边框）。

### 四、兼容性

- 后端 DTO 扩参为可选字段（`title`/`format`/`resolution` 均可缺省，前端只发用到的）——旧调用（若存在）不破坏。
- 媒体页勾选机制保持原样（批量删除不受影响），仅移除「导出推荐」按钮。
- File System Access API 仅在 secure-context 的 Chromium 生效，已设计降级路径。

## 测试计划

- **后端单测**：RecommendServiceTest 增标题注入（默认标题/自定义标题/特殊字符转义）；RecommendVideoServiceTest 增 format 校验（mp4/webm/未知→400）与时长参数不受影响。
- **前端验证**（agent-browser 实机 8081）：独立 tab 进入向导 → 勾选 → 标题 → 生成预览 iframe 渲染（截图核对渐变环流 + 标题文案）→ 导出视频（降级下载路径实机验证）。
