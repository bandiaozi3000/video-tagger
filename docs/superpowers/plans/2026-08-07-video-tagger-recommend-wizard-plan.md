# 推荐导出重构：独立「推荐」tab + 分步向导（v0.13）实施计划

> spec：`docs/superpowers/specs/2026-08-07-video-tagger-recommend-wizard-design.md`
> 拍板：标题文案做主题 / iframe 弹窗预览 / File System Access API 选保存位置 / 独立「推荐」tab / 版本 0.13.0

## P0 后端：标题 + 格式参数化

- **模板 `templates/recommend.html`**：`<title>` 与 hero `<h1>` 的「我的番剧推荐」改 `__TITLE__` 占位符（两处）。
- **RecommendService**：
  - `buildHtml(List<Long> ids)` → 重载 `buildHtml(List<Long> ids, String title)`；title 空 → 默认「我的番剧推荐」。
  - 替换模板 `__TITLE__`（HtmlUtils.htmlEscape 防注入）后再替换 `/*__SLIDES_JSON__*/`。
- **RecommendVideoService**：
  - `render(List<Long> ids, String resolution)` → `render(List<Long> ids, String title, String format, String resolution)`。
  - format 规范化：`MP4`→`mp4`、`WEBM`→`webm`、空→`mp4`；未知抛 IllegalArgumentException。
  - buildHtml 传 title；render.js 加 `--format` 参数；输出扩展名随 format（`recommend-ts.mp4` / `.webm`）。
- **RecommendController**：
  - DTO 改 `record RecommendExportRequest(List<Long> ids, String title, String format, String resolution)`。
  - `/html`：`buildHtml(body.ids(), body.title())`，Content-Type text/html 不变。
  - `/video`：`render(body.ids(), body.title(), body.format(), body.resolution())`；Content-Type 按 format（`video/mp4` / `video/webm`），Content-Disposition 文件名扩展名随 format。
- **render.js**：解析 `--format`；mp4 走现行为，webm 走 `-c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1`。
- **版本**：pom 0.12.0 → 0.13.0。

## P1 后端测试

- **RecommendServiceTest**：buildHtml 默认标题 / 自定义标题注入 / 标题含 `<>&"` 转义；无标题退化兼容。
- **RecommendVideoServiceTest**：format 映射 mp4/webm/未知 400；ids 空 / 超 30 上限仍拦截。
- **RecommendControllerTest**：html 带 title；video 带 format 成功响应 + Content-Type 正确。

## P2 前端：index.html 结构

- nav 增「推荐」tab（data-view="recommend"，放收藏夹后）。
- 新增 `#view-recommend` section：
  - 步骤条（3 步：勾选 / 主题 / 预览导出）。
  - ① 勾选面板：`.recommend-pick` 内嵌媒体网格容器 + 筛选（复用现有 format-tabs 筛选条？——先做全部 + 顶部「已选 N 部」计数，复用媒体页筛选交互可后置）。
  - ② 主题面板：标题 input（默认「我的番剧推荐」）+ 说明「预览标题：xxx」。
  - ③ 预览导出面板：「生成预览」按钮 + 已选数量回顾 + 「上一步」。
- 两个弹窗：
  - `#recommend-preview-modal`：iframe（`.preview-frame`）+ 底部「导出视频」「关闭」。
  - `#recommend-export-modal`：视频标题 input（默认=主题标题）+ 格式 select（MP4/WebM）+ 清晰度 select（720P/1080P/4K）+ 导出地址说明（FS API 选择位置）+ 确认/取消。
- 移除媒体页工具栏 `#media-recommend` 按钮（index.html + app.js 相关引用清理）。

## P3 前端：app.js 向导逻辑

- views 注册 recommend；`showView` 加 `loadRecommend()`。
- `renderRecommendGrid(list)`：独立渲染（复用 CSS 类），勾选事件改 recommendSelected，卡片点击进详情。
- 推荐 tab 数据加载：`loadRecommend()` 拉媒体列表（复用现有 `GET /api/media` 分支），渲染到推荐网格。
- 步骤状态机 `recommendStep` + `renderRecommendStep()`。
- `generateRecommendPreview()`：POST html → blob → `iframe.srcdoc` → 预览弹窗显示。
- `exportRecommendVideo()`：POST video → blob → `showSaveFilePicker` 写文件 / `a.download` 降级。
- 绑定事件：步骤条导航、生成预览、导出视频、取消。
- `updateRecommendCount()`：勾选数实时更新步骤条①与「已选 N 部」。

## P4 前端：app.css

- `.wizard-steps` / `.wizard-step`（active/completed 态，`--pink` 强调）。
- `.recommend-pick` 网格（复用 `.media-grid` 类或同构）。
- `.preview-frame`（iframe 全尺寸、无边框、圆角）。
- 弹窗复用 `.modal`；导出弹窗控件对齐现有表单样式。

## P5 集成验证（实机 8081 + agent-browser）

- 独立 tab 进向导；①勾选 2 部 → ②输标题 → ③生成预览 → iframe 渲染渐变环流 + 自定义标题（截图核对）。
- 预览弹窗点「导出视频」→ 导出弹窗选 WebM + 1080P → 降级下载路径实机产出 .webm（ffmpeg 验证格式）。
- HTML 导出仍可用（下载）。
- 回归：媒体页批量删除勾选不受影响；v0.12 的导出按钮已移除。

## P6 收尾

- CHANGELOG v0.13.0 条目；docs/worklog/2026-08-07.md 追加；README API/文档链接补推荐向导。
- 记忆更新：recommend-export-v012 补 v0.13 向导化 + 新增 spec/plan 指针。
- 待用户浏览器 Ctrl+F5 实测确认后提交 feature/v1。
