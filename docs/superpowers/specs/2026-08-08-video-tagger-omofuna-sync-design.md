# Video Tagger 番剧同步（omofuna 中文源）设计（v0.15）

> 日期：2026-08-08
> 前置：用户提供 omofuna 列表页 URL 要求判断可否按「年份×页码」同步；实测发现 URL 结构可解析、反爬可过（真实浏览器），与 v0.14 调研记忆「maccms+JS 反爬」结论不同——**可同步**。
> 目标：新增第二个数据源 omofuna（https://www.omofuna.com），**补充** AniList：从 omofuna 按年份抓取**中文标题**番剧（日漫/动画/剧场）建媒体档案，命中库中已有（title 或 original_title 精确匹配）跳过。
> 版本：升到 **0.15.0**。

---

## 1. 现状与痛点

- v0.14 已落地 AniList 同步，但 AniList 只给**日文原名**，`title` 以日文占位、要用户手动改中文——中文标题缺口明显。
- 用户重新提出 omofuna（omofuna.com）能否作为补充源。v0.14 调研曾以「maccms+JS 反爬」排除，本轮实测**推翻旧结论**：
  - **URL 结构**（实测）：`show/{分类ID}--------{页码}---{年份}.html`。分类 1=日漫/2=国漫/3=美漫/4=特摄/5=动画/24=剧场；页码在第 8 段、年份在末段；年份筛选**实测生效**（`show/1-----------2025.html` 卡片全是 2025）。
  - **反爬**：MaccMS「系统安全验证」页（title 含该词 + `<input.verify_submit.btnverify>` 按钮 + 混淆 JS + PHPSESSID cookie）。**真实浏览器点「继续访问」→ AJAX → 放行，同会话翻页不再验证**；纯 curl 不可行（带 cookie 也拦）。
  - **卡片字段**：`<a class="lazyload" href="/anime/{32hex}.html" title="中文标题" data-original="{封面webp}">`，每页 ~72 条；每类每年 ~5~6 页；顶部「共检索到 6640 条」是**静态假计数**（全库总量，不可信）。
  - **详情页无日文原名**：只有 类型/地区/年份/状态/导演。
  - **封面无防盗链**（`as.cfhls.top`，无 referer 也 200）——`CoverService.downloadAsync` 原样复用。

## 2. 决策记录（grilling 已拍板）

| # | 决策 | 选项 |
|---|---|---|
| 1 | 数据源 | **omofuna 补充 AniList**（中文标题是 AniList 补不了的缺口） |
| 2 | 重复处理 | **新增 + merge 治理**：omofuna 中文 title 用 `selectByTitleOrOriginal` 精确查重，命中跳过；AniList 日文牌不动；同番重复靠项目**既有 merge 功能**手动合并（omofuna 无日文原名，「中文反填日文占位」无法精确命中，已实测确认并放弃） |
| 3 | 同步范围 | **type 1 日漫 + 5 动画 + 24 剧场**（不要国漫/美漫/特摄/漫画） |
| 4 | 分类标签 | **不导入**（后宫/校园/热血…站方分类质量参差，先不污染 tag 体系） |
| 5 | 同步内容 | 只**名称（中文）/ 年份 / 封面**三样，`original_title` 留空 |
| 6 | 触发方式 | **前端弹层按年份勾选 → 后端异步任务**（抓取 486 页约 20~40 分钟，同步阻塞不现实）→ 前端**轮询进度**；刷新页面可恢复进度 |
| 7 | 抓取引擎 | **Node + puppeteer-core 连系统 Chrome**（复用 render 管线底座；纯后端 HTTP 过不了验证） |

## 3. 架构总览

```
前端勾选年份 → POST /api/media/sync-omofuna {years}
  → OmofunaSyncTaskService.create() 建内存任务(RUNNING) 立即返回 taskId
  → @Async(syncExecutor) 线程：ProcessBuilder 调 node omofuna.js
      └ puppeteer 连系统 Chrome → 过验证 → 按 URL 翻页抓 3 分类 × 多年 → 每页 stdout 进度行 + 每 5 页写一次 JSON checkpoint
  → exit 0 → OmofunaSyncService.importFromJson(JSON) 逐条 upsert（selectByTitleOrOriginal 查重 → 新增中文牌 / 命中跳过）
  → 任务置 DONE{added, skipped}；前端轮询 GET /api/media/sync-omofuna/{taskId} → 完成 loadMedia()
```

**无 DB 迁移、无 Media/MediaMapper 改动**（V11/V12 已备好 year/original_title/cover_url 三列；`selectByTitleOrOriginal`/`insert`/`updateById` 均已有）。

## 4. Node 抓取脚本 `backend/scripts/omofuna.js`

### 4.1 CLI

```
node omofuna.js --years 2026,2025 --out tmp/omofuna.json [--delay 300] [--headed] [--chrome <path>]
```

- `--years` 必填逗号分隔；`--out` 必填；`--headed` 显式窗口（默认 `headless:'new'`）；`--chrome` 后端调用时必传。
- 退出码 0 成功 / 非 0 失败；进度行全 ASCII 打印 stdout（避免 Windows 管道中文乱码）。

### 4.2 关键实现

- 常量：`CATEGORIES=[{id:1},{id:5},{id:24}]`、`BASE`、`MAX_PAGES_PER_YEAR_CAT=30`、`MAX_CONSECUTIVE_FAILURES=5`、`CARD_SELECTOR='a.lazyload[href^="/anime/"]'`。
- **验证页**：`goto` 后 `document.title.includes('系统安全验证') || !!input.verify_submit` 检测；有则 `b.click()` 后轮询卡片出现（200ms 间隔，20s 超时），超时重载一次再判。
- **字段提取**：卡片 `title` 属性、`data-original` 封面、href 正则抽 32hex hash；年份取 URL 年（实测列表年份精准，不解析 span）。
- **翻页终止**：`page=1..MAX_PAGES`，遇 0 卡片 break；本页全部为已见 hash（fresh=0）→ 视为到尾 break；`Set<hash>` 全局去重（同一番可同时挂日漫/动画/剧场，保留首次）。三者共同防 MaccMS 越界重复末页死循环。
- **限速/重试**：默认串行单 page，页间 `--delay` 300ms；`goto` 异常/验证未过/卡片未渲染最多重试 2 次指数退避；连续失败 >5 熔断中止。
- **进度行**（每页一行，后端正则解析）：`[omofuna] page=2026/1/2 items=72 total=140`
- **JSON**（UTF-8，每 5 页 checkpoint 覆写，末尾必写）：
  ```json
  {"generatedAt":"...","years":[2026,2025],"items":[{"title":"中文标题","year":2026,"coverUrl":"...","categoryId":1,"hash":"32hex"}],"stats":{"pages":486,"items":34210,"failedPages":2}}
  ```
- `package.json` 加 `"omofuna": "node omofuna.js"`（puppeteer-core ^23 已装，无新依赖）。

## 5. 后端改造

### 5.1 AsyncConfig

新增 `@Bean("syncExecutor")`：`ThreadPoolTaskExecutor` core1/max1/**queue0**/`omofuna-sync-` 前缀。**不改动** embeddingExecutor/coverExecutor。理由：抓取 20~40 分钟，占 coverExecutor 会堵死封面下载队列；单线程天然保证同刻仅一个抓取任务，配合 create() 的 RUNNING 预检双保险。

### 5.2 `OmofunaSyncService`（导入，纯逻辑可单测）

复用 AniList upsert 骨架：`record SyncResult(int added, int skipped)`、`importFromJson(Path json)` 读 `items` 数组逐条：

```java
// 命中已有：selectByTitleOrOriginal(title) 非空 → skipped++；
//   若命中且 coverPath 为空且本次带封面 → 补 coverUrl + updateById + downloadAsync 补下
// 未命中：new Media() → title=中文, originalTitle=null, year, coverUrl,
//   mediaFormat="VIDEO", status="WANT", confirmed=1, createdAt=now → insert → downloadAsync(id, cover)
```

要点：`originalTitle` **显式留空**（区别于 AniList 填日文）——使 AniList 日文牌与 omofuna 中文牌并存，靠 merge 手动合。空 title 脏数据忽略不计 skipped。

### 5.3 `OmofunaSyncTaskService`（内存任务表 + @Async 执行）

- `record OmofunaTask(taskId, status[RUNNING/DONE/ERROR], years, processedPages, itemsFound, added, skipped, message, createdAt, updatedAt)`，`ConcurrentHashMap` 存（不持久化，重启丢——个人工具可接受，`/current` + 提示文案兜底），容量 >5 淘汰最旧非 RUNNING。
- `create(years)`：校验 years 非空/2000~2026/无 RUNNING → 短 UUID taskId → put RUNNING。
- `execute(taskId, years)` `@Async("syncExecutor")`：
  1. `Files.createTempDirectory("vt-omofuna-")`，`out=work/omofuna.json`。
  2. `ProcessBuilder(nodePath,"omofuna.js","--years","...","--out",abs,"--chrome",chromePath)`，`pb.directory(scriptsDir)`（复制 RecommendVideoService 候选兜底解析）、`redirectErrorStream(true)`。
  3. **起 reader 线程**逐行读 stdout 正则 `\[omofuna\] page=(\d+)/(\d+)/(\d+) items=(\d+) total=(\d+)` 更新 processedPages/itemsFound（先 drain 防管道写满死锁）；主线程 `waitFor(60, MINUTES)` 超时 `destroyForcibly` → ERROR。
  4. exit≠0 → ERROR + 尾部输出；产物缺失 → ERROR；exit 0 → `omofunaSyncService.importFromJson(out)` → DONE。
  5. finally 删临时目录。
- 工具链路径注入 `videotagger.render.*`（env `RENDER_*` 可覆盖）。

### 5.4 `OmofunaSyncController`

- `POST /api/media/sync-omofuna` body `{years}` → 校验空/越界/已有 RUNNING（400）→ `create` + **controller 直接调** `execute`（@Async 代理从 controller 调才生效，避开自调用失效）→ 返回 `{taskId, status:RUNNING}`。
- `GET /api/media/sync-omofuna/{taskId}` → 任务状态，不存在 404。
- `GET /api/media/sync-omofuna/current` → 最近任务（前端刷新恢复；RUNNING 续轮询 / DONE/ERROR 展示 / null 全新）。Spring 字面 `current` 优先于 `{taskId}` 模板匹配。

## 6. 前端改造

### 6.1 入口与弹层（index.html）

- 媒体 toolbar 加 `<button id="media-sync-omofuna" class="btn-mini" title="按年份从 omofuna 抓取中文标题导入（日漫/动画/剧场）">⇄ 同步中文番剧</button>`（放「补下封面」旁）。
- 复制 `#media-sync-modal` 结构做 `#omofuna-sync-modal`：标题「同步番剧（omofuna 中文源）」；hint 说明「抓取中文标题 / 日漫·动画·剧场 / 已存在自动跳过 / 耗时约 20~40 分钟可后台运行」；`#omofuna-sync-year-grid` + `#omofuna-sync-year-all/clear`（复用 `.sync-year-grid`）；进度条 `#omofuna-sync-progress`（`.sync-progress`）；`#omofuna-sync-status`（`.status`）；actions `#omofuna-sync-cancel` + `#omofuna-sync-start`(`btn-primary`)。

### 6.2 交互（app.js）

- `openOmofunaSyncModal()`：生成 2000~2026 chips（复用现有）→ `checkOmofunaCurrent()` 刷新恢复。
- `startOmofunaSync()`：收集 `.on` 年份 → POST → 拿 taskId → 禁开始按钮 → `pollOmofunaTask` `setInterval(2000)`。
- `pollOmofunaTask(taskId)`：GET 状态；RUNNING →「正在抓取：已抓 N 页，M 条」+ 进度条动画；DONE → 清定时器、toast「新增 X，跳过 Y」、`loadMedia()`；ERROR → 展示 message。
- `checkOmofunaCurrent()`：`GET /current`，非 null 按状态续轮询/展示。
- fetch 全部相对路径 `/api/xxx`。

### 6.3 样式（app.css）

- **必补**：取消按钮样式由 `:is(#edit-cancel, #media-modal-cancel, ...)` 显式列 ID 匹配——补 `#omofuna-sync-cancel` 到两处 `:is()` 选择器，否则新弹层取消按钮无样式。
- 新增不确定进度条动画 `.sync-progress`/`.sync-progress-fill`（`var(--grad)` 滑动，贴合现有深色霓虹）。

## 7. 测试

1. `OmofunaSyncServiceTest`（纯 JUnit + Mockito mock MediaMapper/CoverService，**无需 MockWebServer**）：新增建媒体字段断言（title=中文/year/originalTitle=null/mediaFormat=VIDEO/status=WANT/confirmed=1）、查重跳过（命中不 insert + 缺封面补 URL 重下）、空 title 忽略、coverUrl 空不触发下载。
2. `OmofunaSyncControllerTest`（`@WebMvcTest(OmofunaSyncController.class)` + `@MockBean OmofunaSyncTaskService`）：POST 合法 → 200+taskId+verify execute；空 years → 400；已有 RUNNING → 400；GET 任务 200 / 不存在 404；GET current。
3. `OmofunaSyncTaskServiceTest`（可选）：create/get/current/reject 的 map 逻辑（不测 @Async execute 的 ProcessBuilder）。
4. **Node 脚本不单测**，靠真实抓取验证（见 §9）。

## 8. 兼容性

- 纯新增端点/服务/前端元素，现有 API 不破坏。
- 无 schema 变更；omofuna 导入的 media 与 AniList 导入同结构（仅 original_title 为 NULL），详情/列表/搜索/推荐全链路天然兼容。
- 封面复用 coverExecutor 渐进下载，失败降级无封面，`retry-covers` 兜底。

## 9. 验证方案

1. **CLI 单年试跑**（最优先）：`node omofuna.js --years 2026 --out tmp/omofuna.json`——验证放行/卡片提取/翻页终止/去重/年份准确。
2. **单测**：`mvn test -o -Dtest='OmofunaSyncServiceTest,OmofunaSyncControllerTest'`。
3. **端到端**：起后端 → 媒体页点「⇄ 同步中文番剧」→ 勾 2026 → 开始 → 进度递增 → DONE toast → `loadMedia()` 出现中文标题记录。
4. **幂等**：重跑 2026 → added=0、skipped=上次新增数。
5. **merge 联动**：把某 AniList 日文记录 title 改中文 → 重跑该年 → 命中跳过。
6. **封面**：抽查 `/covers/{id}.jpg`；中断后「⇩ 补下封面」验证兜底。

## 10. 非目标 / 推迟项

**后续再说**：
- omofuna 分类标签（后宫/校园/热血…）导入。
- 抓取断点续跑（node checkpoint resume）。
- 抓取并发多 tab（`--concurrency` 预留，默认 1）。
- 同步来源标识列（`source`）与按来源筛选。

**本轮明确不做**：
- 中文↔日文原名自动匹配（无数据来源，靠 merge 手动合）。
- 自动改/清 AniList 日文牌。
- 国漫/美漫/特摄分类同步。
- 精确首播日期、剧情/评分/集同步。
