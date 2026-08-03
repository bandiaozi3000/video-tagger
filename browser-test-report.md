# 浏览器功能检测报告（agent-browser + Edge）

检测时间：2026-08-02
检测方式：以 Windows 自带 Edge（含未打包扩展）打开真实网站（B站），按 README 的功能清单逐项实测。
后端：本地运行（非 Docker），MySQL/Milvus 等基础设施容器运行中。

---

## 一、严重问题（影响 Web UI 全部交互）

### ❌ 1. 弹窗 CSS 覆盖 `hidden` 属性，两个弹窗永远显示并挡住全页面

- **位置**：`backend/src/main/resources/static/app.css` 第 262 行
- **原因**：`.modal-overlay { display: flex; }` 会覆盖 HTML 元素上 `hidden` 属性对应的 `[hidden] { display:none }`（作者样式优先于 UA 样式）。`#similar-modal` 与 `#edit-modal` 计算样式均为 `display: flex`，**自页面加载起就持续可见**，并以 `position:fixed; inset:0; z-index:100; rgba(0,0,0,.6)` 黑色半透明遮罩盖住整页。
- **后果**（实测全部失效）：
  - 点搜索结果卡片「跳转回看」无反应（点击被遮罩拦截）
  - 点「相似」按钮不触发 `openSimilar()`（网络请求未发出）
  - 点「编辑」「删除」无反应
  - 点顶部导航「时间线」「统计」无法切换视图（`#view-stats` 仍为不可见）
- **修复建议**：给 `.modal-overlay` 增加 `[hidden]` 兜底，例如：
  ```css
  .modal-overlay[hidden] { display: none; }
  .modal-overlay { display: flex; ... }
  ```

---

## 二、功能未启用 / 与 README 不符

### ⚠️ 2. 混合语义搜索未启用（降级为纯关键词）

- **现象**：搜索页显示「语义搜索未启用（未配置 Embedding API），当前为关键词搜索」。
- **排查**：`.env` 中已配置 `EMBEDDING_BASE_URL / API_KEY / MODEL / DIM`（阿里云兼容接口），但 `application.yml` 的 embedding 配置只从环境变量注入（`.env` 仅由 `docker compose` 加载）。当前后端是以本地 `mvn spring-boot:run` 方式运行（`docker ps` 中无 `app` 容器），启动进程未注入 `EMBEDDING_*` 环境变量，故语义搜索不可用。
- **结论**：非代码 bug，属启动/注入方式问题。按 README 用 `docker compose up -d` 启动全栈即可注入 `.env`。
- **待办**：以注入环境变量的方式重启后端后，需复测向量召回是否真正工作（Milvus 集合、embedding 维度 1024）。

---

## 三、次要观察

### ℹ️ 3. 直接浏览器访问 API 返回 XML 而非 JSON

- 直接访问 `http://localhost:8080/api/stats`（浏览器地址栏，Accept 含 `application/xml;q=0.9`）时返回 XML（`<StatsResponse>...`），而非 JSON。
- 前端 `fetch()` 默认 `Accept: */*`，实测可正常拿到 JSON（搜索、时间线、相似、标签接口均返回 JSON 且数据结构正确），**不影响当前 SPA**。
- 原因疑似 classpath 中存在 XML 序列化器且内容协商被触发。属可选改进：统一 API 响应为 JSON（如强制 `produces=application/json` 或清理不必要的 XML 依赖），避免被外部/脚本客户端误用。

### ⚠️ 4. `Alt+S` 浏览器命令快捷键未能通过自动化触发

- 自动化合成按键无法触发浏览器级 `chrome.commands` 快捷键，故 `Alt+S` 未能实测。
- 但 `Alt+S` 触发的代码路径（background → `grab-video` → `show-overlay`）与已验证通过的 `Ctrl+Shift+1` 完全相同，扩展其余功能全部实测正常。
- **建议人工验证一次**：在带扩展的浏览器打开含 `<video>` 的页面按 `Alt+S`。

---

## 四、实测通过的功能

### 扩展（在 B站 视频页实测，全部通过）

| 功能 | 验证方式 | 结果 |
|---|---|---|
| 打标浮层（Alt+S 同路径） | `Ctrl+Shift+1` 弹出浮层，标题/时间/标签/备注齐全 | ✅ |
| 快捷标签位 `Ctrl+Shift+1~9` | 设置页配置后，按下自动填入预设标签 | ✅ |
| 静默直存 | 设置页勾选后按下，toast「已保存「预设标签A」」，不弹浮层 | ✅ |
| 保存片段（含备注） | 浮层保存成功，Web 端可见 | ✅ |
| 重复片段提示 | 同位置重复打标，浮层提示「已存过」+「追加标签 / 仍然新增」 | ✅ |
| 追加标签合并 | 点「追加标签」后合并到原片段（`重复测试 + 补录`） | ✅ |
| 连续打标模式 | 计数「已连续保存 1/2 条」，浮层不关闭 | ✅ |
| 标签自动补全 | 输入「烹」下拉出现「烹饪教程」 | ✅ |
| 回看 seek | 后端跳转队列 + content script 轮询逻辑存在（受弹窗 bug 阻塞未能端到端验证） | ⚠️ 部分 |

### 后端 API（直接访问验证，全部返回正确 JSON/数据）

| 接口 | 结果 |
|---|---|
| `POST /api/clips` 保存 | ✅（扩展实测多笔） |
| `GET /api/search?q=` 混合检索 | ✅ 返回结果（含 semanticEnabled 降级标记） |
| `GET /api/videos` 视频列表 | ✅ 2 个视频，聚合正确 |
| `GET /api/videos/{fp}/clips` 时间线片段 | ✅ 按指纹聚合返回全部片段 |
| `GET /api/search/similar?id=` 相似推荐 | ✅ 同标签片段召回（含 jumpUrl/score） |
| `GET /api/tags?prefix=` 标签补全 | ✅ 前缀匹配返回 |
| `GET /api/clips/near` 邻近重复检测 | ✅（浮层重复提示依赖它，实测触发） |
| `GET /api/stats` 统计 | ✅ 数据完整（总量/Top标签/站点/近30天趋势字段齐全） |

### Web UI（受弹窗 bug 影响无法点击的部分未计入通过项）

| 功能 | 结果 |
|---|---|
| 搜索视图渲染 | ✅（搜索框、结果卡片正常渲染、搜索可用） |
| 时间线 / 统计 视图导航 | ❌ 被弹窗遮罩拦截 |
| 编辑 / 删除 / 相似 / 跳转 | ❌ 被弹窗遮罩拦截 |

---

## 五、遗留事项

1. ~~修复 `app.css` 弹窗 `display:flex` 覆盖 `hidden` 的 bug~~ → 已修复（见第六节自检）。
2. ~~以 docker compose 或注入环境变量重启后端，复测语义搜索~~ → 已修复（见第六节自检）。
3. 人工验证 `Alt+S` 浏览器快捷键。
4. **测试数据说明**：本次检测在 B站 实际视频页（「蒜香猪排超详细教程」「也算是米饭仙人了一期」等自动连播视频）创建了若干真实标签片段（烹饪教程、重复测试/补录、连续模式、预设标签A，共 6 条）。如不需要，可用 Web UI 删除或清库；如需保留可忽略。另在扩展设置页配置了槽位 1=「预设标签A」、槽位 2=「静默标签B」并开启了「静默直存」。

---

## 六、修复与自检结果（归档）

修复时间：2026-08-02
修复方式：修正代码 + 重启后端（本地 `mvn spring-boot:run`，注入 `.env` 中 `EMBEDDING_*` 环境变量）

### 修复内容

| 编号 | 问题 | 修复 |
|---|---|---|
| 1 | `.modal-overlay { display:flex }` 覆盖 `hidden`，弹窗永远显示挡住全页 | `app.css` 增加 `.modal-overlay[hidden] { display: none; }`，并同步到 `target/classes/static/app.css` |
| 2 | 语义搜索未启用（`.env` 环境变量未注入） | 停掉 IDEA 调试会话，改用本地 `mvn spring-boot:run` 启动并注入 `EMBEDDING_BASE_URL / API_KEY / MODEL / DIM` |
| 3 | 直接浏览器访问 API 返回 XML | 未改动（前端 `fetch()` 拿 JSON，不影响 SPA；列为可选改进） |
| 4 | `Alt+S` 浏览器命令未自动化验证 | 无法自动化触发浏览器级命令，维持人工验证 |

### 自检结果（Edge 实测）

| 功能 | 结果 | 证据 |
|---|---|---|
| 弹窗初始隐藏 | ✅ | `#similar-modal` / `#edit-modal` 初始 `is visible=false` |
| 混合语义搜索 | ✅ | `/api/search` 返回 `semanticEnabled:true`，搜索页语义降级提示隐藏；「烹饪」可召回到跨视频相关片段 |
| 搜索关键词 | ✅ | 输入「烹饪」「连续模式」均返回结果 |
| 跳转回看 | ✅ | 点结果卡片新开标签页 `BV1GiGA6bEGZ/?t=37`，视频从 37s 起播 |
| 相似片段推荐 | ✅ | 弹窗打开，返回 5 条相似卡片，可关闭 |
| 标签编辑 | ✅ | 编辑弹窗正确填充数据，改备注保存后搜索可查到「编辑自检OK」 |
| 标签删除 | ✅ | confirm 对话框出现，接受后结果 6→5 条 |
| 时间线视图 | ✅ | 视频列表 → 点入视频，显示标题 + 3 个标记点 + 3 张卡片 |
| 统计面板 | ✅ | 总量 6/2/4、Top 标签、站点条形图(1)、近30天趋势(30 条形) |
| 扩展（重启后回归） | ✅ | Ctrl+Shift+1 静默保存 toast「已保存「预设标签A」」，落库后统计计数 +1 |

### 启动方式变更说明

- 后端运行方式从 **IDEA 调试会话** 改为 **`mvn spring-boot:run`（后台进程）**，以注入 `.env` 的 Embedding 配置。
- 若从 IDEA 直接再启动，需在运行配置中配置 `EMBEDDING_BASE_URL` 等环境变量，否则语义搜索会回到降级状态。
- 启动日志关键行：`Milvus 连接成功，collection=clip_embeddings 就绪`、`Started VideoTaggerApplication in 8.222 seconds`。

### 自检结论

原报告中「严重问题 1」与「功能未启用 2」均已修复并经浏览器实测通过；Web UI 交互（跳转/相似/编辑/删除/时间线/统计）全部恢复可用。剩余「Alt+S 人工验证」「XML 内容协商（可选）」未处理。
