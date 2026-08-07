# 推荐番剧 → 渐变环流 HTML + 视频导出（v0.12）实施计划

> spec：`docs/superpowers/specs/2026-08-07-video-tagger-recommend-html-design.md`
> 拍板：D 渐变环流模板 / Node+puppeteer 视频导出 / 720P·1080P·4K / 版本 0.12.0

## P0 模板落位

- 新建 `backend/src/main/resources/templates/recommend.html`：
  - 从 `docs/design/photo-wall-D-ring.html` 拷贝改造：删硬编码 SLIDES，留 `/*__SLIDES_JSON__*/` 占位符。
  - 加 `?record=1` 录制模式：关闭交互 stopAuto；封面去 lazy；保留全部动画/自动导览。
  - 校验：`node --check` 语法 + 本机 open 目测一版。

## P1 后端：封面 base64 读取

- **CoverService** 新增 `public String base64ForCoverPath(String coverPath)`：
  - null/空 → null；越界校验（复用 deleteCover 的 normalize + startsWith + 目录包含）→ null。
  - 文件不存在/读异常 → null；成功 → `data:image/{mime};base64,{...}`。
  - mime 映射：`.jpg`/`.jpeg`→`image/jpeg`、`.png`→`image/png`、`.webp`→`image/webp`，其余默认 `image/jpeg`。

## P2 后端：RecommendService + RecommendController（HTML）

- **RecommendService**（新 `service/RecommendService.java`）：
  - 注入 `MediaService`、`TagMapper`、`MediaSubcategoryMapper`、`MediaFormatMapper`、`CoverService`、`ObjectMapper`、`ResourceLoader`。
  - `public String buildHtml(List<Long> ids)`：
    - ids 空 → IllegalArgumentException。
    - 逐个 `mediaService.get(id)`（跳过 null），保留顺序。
    - 每媒体：封面 base64（coverPath→fallbackCoverPath 降级）；分类路径（subcategoryId 递归父节点，深度≤10，失败回退快照）；`MediaFormat.name`；note（空占位）；flag（status 中文映射）；tags（countByMedia 前 6 refCount>0）。
    - **双重转义**：htmlEscape 内容 → JSON 序列化（ObjectMapper 会把 `<` 转 `<` 等）。
    - 读模板 `classpath:templates/recommend.html` → 替换 `/*__SLIDES_JSON__*/` → 返回完整 HTML。
- **RecommendController**（新 `controller/RecommendController.java`）：
  - `POST /api/recommend/html`，body `{ids:[...]}`，produces text/html。
  - 响应 Content-Disposition attachment `video-tagger-recommend.html`。
  - 空 ids → 400（IllegalArgumentException → 全局处理器现成）。

## P3 视频导出：render.js + RecommendVideoService

- **backend/scripts/**：`package.json`（deps: puppeteer-core）+ `render.js`：
  - 参数 `--html --out --width --height --fps --chrome --ffmpeg`。
  - puppeteer-core `headless:'new'`，executablePath=chrome；viewport=宽高；goto `file://...?record=1`。
  - CDP `Page.startScreencast`（format jpeg）收帧 → 写临时 `frame_%04d.jpg`；总帧数按 `ids.length` 推导时长传参。
  - ffmpeg `-framerate fps -i frame_%04d.jpg -c:v libx264 -pix_fmt yuv420p -movflags +faststart out.mp4`。
  - 清理临时帧；异常 exit≠0。
- **RecommendVideoService**（新 `service/RecommendVideoService.java`）：
  - 注入 RecommendService；配置 `videotagger.render.{scripts-dir,node-path,chrome-path,ffmpeg-path}`。
  - `render(List<Long> ids, String resolution)`：buildHtml → 写临时 html → ProcessBuilder 调 node → 等退出 → 返回 mp4 路径。分辨率映射 720P/1080P/4K → 1280×720/1920×1080/3840×2160。
  - 渲染时长 = `7 + 6×N + 2` 秒（fps×时长 帧数）。
- **application.yml**：`videotagger.render.*` 默认值（本机路径）。
- **RecommendController** 增 `POST /api/recommend/video`，body `{ids, resolution}`，produces video/mp4，附件文件名带时间戳。

## P4 后端测试

- **CoverServiceTest**：base64ForCoverPath 正常/mime/空/越界/不存在。
- **RecommendServiceTest**（Mockito + 临时 cover-dir）：buildHtml 含标题/分类路径/note/标签×N/`data:image/`；无封面→占位；空 ids→抛异常；特殊字符转义；顺序保持；模板占位符被替换。
- **RecommendControllerTest**：html 成功 200 + Content-Disposition；空 ids 400；video 成功/未知 resolution 400。

## P5 前端：导出按钮 + 弹窗 + toast

- **index.html**：工具栏加 `#media-recommend`（hidden，批量模式下显示）；导出弹窗（HTML / 视频 + 清晰度三选）。
- **app.js**：`updateMediaBatchConfirm` 同步 hidden；`openRecommendExport`；`exportRecommend(type, resolution)`（HTML/视频两分支，blob 下载）；`showToast`；绑定。
- **app.css**：`.toast` 样式；弹窗复用 `.modal`。

## P6 验证与收尾

- `mvn -q compile -o`（export PATH 后）；单测排除 IT。
- `node --check render.js`、`node --check app.js`；`mvn process-resources`。
- 冒烟：勾选 2~3 部 → 生成 HTML → 本机 open 目测；跑 render.js 720P 冒烟出 mp4。
- 起服务实测：勾选→HTML 下载→视频 720P/1080P 下载→播放器目测。
- CHANGELOG（0.12.0）+ docs/worklog/2026-08-07.md；pom 版本 0.11.0→0.12.0。

## 交付物

- 后端：templates/recommend.html(新)、CoverService(+1)、RecommendService(新)、RecommendController(新)、RecommendVideoService(新)、render.js+package.json(新)、application.yml(+render.*)、3 个测试类。
- 前端：index.html(+按钮+弹窗)、app.js(+toast/导出逻辑/绑定)、app.css(+.toast)。
- 文档：spec/plan 更新 + CHANGELOG/worklog。
