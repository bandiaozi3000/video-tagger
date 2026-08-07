# 推荐番剧 → 渐变环流 HTML + 视频导出（v0.12）设计

> 版本备注：v0.11 的初稿曾设计「轮播图 HTML」，经设计迭代用户改用**渐变环流（photo-wall-D-ring）**模板，并新增「导出视频」链路。本 spec 为最终方案，版本定为 **0.12.0**（用户拍板，不并 0.11）。

## 需求缘起

用户：「好的，我上述整个功能写入当前项目。整条链路包括勾选推荐番剧 -> 生成 html -> 导出视频，视频清晰度可选如 1080P，当前为一个大版本」。

即：在 Web UI 勾选若干媒体 → 生成一个**自包含渐变环流 HTML 文件**（可下载/发送）；并可将该 HTML **渲染导出为 MP4 视频**，清晰度可选 **720P / 1080P / 4K**。

## 拍板决策（ask 三问，2026-08-07）

1. **HTML 模板**：采用 `docs/design/photo-wall-D-ring.html`（深色霓虹渐变环流：封面瓦片沿椭圆轨道绕中心点旋转、飘带式依次入场、自动导览逐部跳转、全屏详情卡）。无任何与推荐无关文案。
2. **视频导出技术选型**：**Node + puppeteer 脚本**（用户选定）——Java 侧 `ProcessBuilder` 调 `node render.js`，puppeteer-core 连系统 Chrome 按 CDP screencast 录制帧，ffmpeg 合成 MP4。
3. **清晰度**：**720P / 1080P / 4K 三档**（用户选定）。
4. **版本**：**0.12.0**（当前 pom 0.11.0，用户选定不跳 1.0.0）。

## 现状盘点（读码确认）

**后端**：
- `MediaService.get(id)` → `MediaDetail`（含 `note`/`subcategory`/`subcategoryId`/`coverPath`/`mediaFormat`/`status`）。
- `TagMapper.countByMedia(mediaId)` → `List<TagUsage>`（媒体/集/片段三级聚合引用数，v0.9 现成）。
- `MediaSubcategory`：`id/formatId/parentId/name`（parentId=0 根）——可递归父节点拼「父 / 子」路径。
- `MediaFormat`：`code/name`——格式显示名映射源。
- `CoverService` 有 `dir()` 与 `deleteCover` 内的越界校验（normalize + startsWith("/covers/") + startsWith(coverDir)），`base64ForCoverPath` 待新增。
- `GlobalExceptionHandler`：`IllegalArgumentException` → 400，现成。
- **无** RecommendService/Controller，需新建。

**前端**：
- 批量勾选机制现成（`mediaBatchMode`/`mediaSelected`/`.media-batch-cb`/`renderMediaGrid`）。
- 工具栏 `media-batch-del`（切换）旁是 `media-batch-confirm`（删除选中）。
- **无 toast**——需补轻量 `showToast`。
- 无构建链，纯静态 `static/`。

**工具链（本机已备）**：
- Node v22.20.0 / npm 10.9.3（PATH 内）。
- 系统 Chrome：`C:\Program Files\Google\Chrome\Application\chrome.exe`。
- ffmpeg 便携版：`~/.local/ffmpeg/bin/ffmpeg.exe`（npm @ffmpeg-installer/win32-x64 安装）。
- puppeteer-core：需 npm install（backend/scripts/ 下）。

## 设计

### 一、HTML 模板（resources/templates/recommend.html）

改造 `photo-wall-D-ring.html` 为**可注入数据**模板，放 `backend/src/main/resources/templates/recommend.html`：

1. 删掉硬编码 `SLIDES` 数组，改由占位符 `/*__SLIDES_JSON__*/` 注入（后端 Java 把真实媒体数据序列化为 JSON 数组替换）。
2. 动画参数不变（ORBIT_RX=300/RY=150、入场、自动导览 AUTOPLAY_START=7000/AUTOPLAY_HOLD=6000）。
3. 保留「第 X 部 / 共 N 部」+ 进度条；**不显示任何品牌/生成时间/提示文案**（用户要求已去掉）。
4. 支持 `?record=1` 录制模式（供 puppeteer 视频渲染用）：
   - 注入脚本：`window.__VT_START` 时间基准由外部覆盖，动画时间统一走 `performance.now()` 即可（真实时间录制，无需虚拟时钟——screencast 按真实节奏抓帧）。
   - 关闭交互干扰：录制模式下忽略 wheel/touch/click/keydown 的 `stopAuto`（避免导览被打断）。
   - 关闭 `loading="lazy"`（headless 下懒加载可能不触发，封面全量加载）。
5. 封面用 `data:` base64 URL 内嵌（自包含，file:// 打开可显示）。

### 二、后端：`POST /api/recommend/html`

- **RecommendController**：`@PostMapping("/api/recommend/html")`，body `{ids:[...]}`，返回 `text/html` + `Content-Disposition: attachment; filename="video-tagger-recommend.html"`。ids 空/缺失 → 400。
- **RecommendService.buildHtml(List<Long> ids)**：
  1. 逐个 `mediaService.get(id)`，跳过不存在；**按 ids 传入顺序**。
  2. 每媒体组装 slide：
     - **cover**：`coverPath` → `CoverService.base64ForCoverPath` → 失败降级 `fallbackCoverPath` → 再失败无封面占位。
     - **cat**：`MediaFormat.name` +（子分类路径 `父 / 子`，subcategoryId 递归父节点深度≤10，无则 subcategory 快照）。
     - **title**：媒体标题；**note**：备注（空 → 占位「（暂无备注）」）；**flag**：status 中文（想看/在看/看完/搁置/弃番）。
     - **tags**：`tagMapper.countByMedia(id)` 过滤 refCount>0，取前 6（次数降序）。
  3. **HTML/JSON 双重转义**：标题/分类/note/标签名含 `<>&"` 会破坏 JSON 或 HTML——先 `HtmlUtils.htmlEscape` 再序列化 JSON，JSON 里 `<` `>` 需 `\u003c` 级转义（防 `</script>` 注入）。
  4. 替换 `/*__SLIDES_JSON__*/` 为序列化 JSON 数组。

### 三、后端：`POST /api/recommend/video`（视频导出）

- **RecommendController**：`@PostMapping("/api/recommend/video")`，body `{ids:[...], resolution:"1080P"}`，返回 `video/mp4` + 附件下载 `video-tagger-recommend-YYYYMMDD-HHmm.mp4`。
  - resolution ∈ {720P, 1080P, 4K}；映射 {1280×720, 1920×1080, 3840×2160}。
  - ids 空/未知 resolution → 400。
- **RecommendVideoService**（新 `service/RecommendVideoService.java`）：
  1. 调 `RecommendService.buildHtml` → 写临时 HTML 文件到 `${java.io.tmpdir}/vt-render/`。
  2. `ProcessBuilder` 调 `node render.js --html <file> --out <mp4> --width <w> --height <h> --fps 30 --chrome <chromePath>`。
     - node/chrome/ffmpeg/scripts 路径来自 `application.yml`（`videotagger.render.*`），本机默认值指向上面工具链。
  3. 等待进程退出；非 0 → 抛异常带 stderr 摘要；成功返回 mp4 路径。
  4. 视频时长 = 动画真实时长：`AUTOPLAY_START(7s) + N×AUTOPLAY_HOLD(6s) + 2s 收尾`——render.js 内按 `ids.length` 计算帧数（`fps × (7 + 6N + 2)`）。
  5. **同步阻塞**（个人工具可接受，渲染 8 部 1080P 约 40~60s）；HTTP 响应等待完整渲染。
- **边界**：Docker 容器内无 node/chrome/ffmpeg → 本功能在本机后端运行时可用；容器化视频渲染列为「不做」。

### 四、render.js（backend/scripts/）

```js
// 参数：--html --out --width --height --fps --chrome
// puppeteer-core 连系统 Chrome（executablePath=--chrome, headless:'new'）
// page.setViewport({width,height}) → goto file://...?record=1
// CDP Page.startScreencast 收 JPEG 帧（带时间戳）→ 写 frame_%04d.jpg 临时目录
// 录满总帧数（fps×(7+6N+2)）→ stopScreencast
// 调 ffmpeg：-framerate fps -i frame_%04d.jpg -c:v libx264 -pix_fmt yuv420p -movflags +faststart out.mp4
// 清理临时帧；process.exit(0) 成功
```

- npm 依赖：`puppeteer-core`（backend/scripts/package.json）。
- ffmpeg 路径：npm `@ffmpeg-installer/win32-x64` 已装 → Java 侧配置 `videotagger.render.ffmpeg-path` 传给 render.js（`--ffmpeg`）。

### 五、前端

- **index.html**：媒体工具栏 `media-batch-confirm` 旁加 `<button id="media-recommend" class="btn-mini" hidden>导出推荐</button>`；新增导出弹窗（选 HTML / 视频 + 清晰度）。
- **app.js**：
  - `updateMediaBatchConfirm` 内同步 `#media-recommend.hidden`。
  - `openRecommendExport()`：弹窗选「HTML / 视频」，选视频再选清晰度（720P/1080P/4K）→ 确认。
  - `exportRecommend(type, resolution)`：
    - HTML：fetch POST `/api/recommend/html` → blob → `<a download>` 触发下载 → toast「已生成，共 N 部」。
    - 视频：fetch POST `/api/recommend/video`（长耗时）→ blob 下载 → toast「视频已生成」；loading 态（按钮文字「渲染中…」+ disabled）。
    - 空选 → toast「请先勾选要推荐的媒体」；失败 → toast 错误。
  - `showToast(msg)` 轻提示（全局唯一 `.toast`，2.5s 消失，可打断重显）。
- **app.css**：`.toast`（底部中央浮出，暗色玻璃底）；导出弹窗复用现有 modal 样式（`.modal` 体系现成）。

### 边界与状态闭环

| 场景 | 处理 |
|---|---|
| 未勾选点导出 | toast「请先勾选要推荐的媒体」，不发请求 |
| 无封面媒体 | HTML 内渐变占位（首字）；视频内同样占位 |
| 无备注 | 「（暂无备注）」占位 |
| 无标签热度 | 标签区隐藏 |
| 媒体不存在（残留勾选） | 后端跳过，不报错 |
| 图片读取失败/越界 | 降级 fallback 封面 → 无封面占位 |
| 视频工具链缺失（Docker 内） | 400/500 带清晰错误信息「视频渲染未配置（需本机 node/chrome/ffmpeg）」；HTML 导出不受影响 |
| 视频渲染失败（node 非 0） | 抛异常带 stderr 摘要，前端 toast |
| 大文件（几十张封面 base64 + 视频） | 按钮 loading 防连点；视频渲染同步阻塞数十秒 |
| 内容含 HTML 特殊字符 | 后端双重转义，文件结构不被破坏 |

## 测试

- **CoverServiceTest**（补）：`base64ForCoverPath`——正常读转 base64（mime 正确）/空路径→null/越界路径→null/文件不存在→null。
- **RecommendServiceTest**（Mockito，cover-dir 注入临时目录）：buildHtml 含标题/分类路径/note/标签×N/`data:image/`；无封面→占位；空 ids→异常；特殊字符转义；顺序按 ids 传入。
- **RecommendControllerTest**：html POST 成功返回 + Content-Disposition；空 ids→400；video 成功/未知 resolution→400。
- **render.js**（冒烟，本机）：真实生成 HTML → 跑一遍 node render.js 720P 截前若干帧 → ffmpeg 出 mp4 可播放。

## 版本与文档

- 版本：pom `0.11.0 → 0.12.0`。
- 完成后更新 CHANGELOG + docs/worklog/2026-08-07.md；`mvn process-resources` 同步静态资源到 target。

## 不做（本期明确排除）

- Docker 容器内视频渲染（镜像内装 node/chrome/ffmpeg 过大，留待按需）。
- 自定义标题/文案编辑 UI。
- 图片压缩（封面原字节 base64）。
- 视频导出异步任务队列（同步渲染够用；超长导览后续再异步化）。
