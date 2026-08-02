# Video Tagger 功能深化 · 实施方案（v1）

> **For agentic workers:** 按 Phase 顺序实施，Phase 间存在依赖，不要跨 Phase 并行提交。任务清单用 `- [ ]` 跟踪。

**Goal:** 在初版最小闭环之上完成「地基修复 → 打标效率 → 时间线视图 → 相似推荐与统计」的功能深化，让工具"更完整、更像那么回事"。

**对应规格：** `docs/superpowers/specs/2026-08-02-video-tagger-enhancement-design.md`

**排期顺序：** `Phase 0（地基）→ Phase 1（牌二 打标效率）→ Phase 2（牌一 时间线视图）→ Phase 3（牌三 相似+统计）→ Phase 4（工程化收尾，可选）`

## Global Constraints

- 保持初版约束：包根 `com.videotagger`；端口 8080；不引前端框架与构建链；提交格式 `type: 中文描述`。
- **密钥管理**：真实 API key 只允许存在于 `.env`（gitignore）；`application.yml` 兜底默认值必须为空；后端绑定 `127.0.0.1`。
- **快捷键**：快捷标签位一律用 `Ctrl+Shift+数字`（禁 `Alt+数字`，浏览器切标签页冲突），全量可自定义。
- **去重语义**：误触判定 = 同 URL 且 |Δtimestamp| < 3s 且 tag 相同；同片段补标（tag 不同）走"追加标签"，不新建也不吞数据。
- **URL 归一化**：保存时计算 `video_fp` 落库；剔除 tracking 参数（pn/from/spm/rid/param/list 等），保留分 P 参数（p/index）。
- **schema 迁移**：引入 Flyway；`schema.sql` 仅保留作初始化基线，后续变更走 `V*__*.sql`。
- **统计图表**：原生 SVG，不引图表库。

---

## Phase 0：地基（必修，先于一切功能）

### 0.1 密钥与暴露面

- [ ] 清空 `backend/src/main/resources/application.yml` 中 `embedding.base-url / api-key` 的硬编码兜底默认值（改为 `${EMBEDDING_BASE_URL:}` / `${EMBEDDING_API_KEY:}`）。
- [ ] `application.yml` 增加 `server.address: 127.0.0.1`。
- [ ] 校验 `.env.example` 字段说明齐全。
- **验收**：`git diff` 无 `sk-` 前缀泄漏；应用仅监听回环地址。

### 0.2 Milvus 冷启动竞态（语义搜索永久哑火）

- [ ] `docker-compose.yml` 为 `milvus` 增加 healthcheck（如 `curl -sf http://localhost:9091/healthz`；若镜像无 curl，改用 `wget`/`python3`），`app` 的 `depends_on` 改为 `milvus: condition: service_healthy`。
- [ ] `MilvusVectorStore` 增加**禁用态自动重连**：`@Scheduled(fixedDelay=60s)` 在 `enabled==false` 时尝试重连（`connect + ensureCollection`，幂等），成功后置 `enabled=true` 并打日志。
- **验收**：冷启动 `docker compose up -d`，等待 Milvus 就绪后约 60s 内日志出现"Milvus 连接成功"，语义搜索自动恢复（无需重启 app）。

### 0.3 3 秒去重修复（静默吞数据）

- [ ] `ClipMapper` 新增方法：按 `url + created_at 窗口 + ABS(timestamp_sec - 目标) < 3` 查最近记录。
- [ ] `ClipService.save` 逻辑改为：命中误触记录且 **tag 相同** → `deduped=true`；命中但 tag 不同 → 视为新记录（或走追加）。
- [ ] `extension/content.js` 消费保存响应：`deduped=true` 时浮层 toast「该片段刚已保存」，不关闭浮层。
- **验收**：连按两次同片段 → 提示已保存；同 URL 3s 内补不同 tag → 新建成功。

### 0.4 编辑 / 删除 / 追加标签（牌二的依赖）

- [ ] 引入 Flyway：`pom.xml` 加依赖，`application.yml` 配 `spring.flyway.*`，新增 `V1__baseline.sql`（迁移当前 clips / embedding_tasks 结构），停用 `spring.sql.init`。
- [ ] `ClipService` 新增 `update(id, SaveClipRequest)` 与 `delete(id)`；`tag` 或 `note` 变化时：删除 Milvus 旧向量 + 投新 embedding 任务（`EmbeddingTaskService` 支持"重建向量"路径）。
- [ ] 追加标签语义：`PUT /api/clips/{id}?appendTag=true` 将新 tag 与原 tag 合并去重。
- [ ] `ClipController`：`PUT /api/clips/{id}`、`DELETE /api/clips/{id}`。
- [ ] Web UI 卡片增加编辑弹窗 / 删除确认。
- [ ] 测试：`ClipServiceIT` 增 update/delete 用例；`ClipControllerTest` 增接口用例。
- **验收**：改 tag 后搜索结果与相似推荐立即反映新向量（异步生成后）。

---

## Phase 1：牌二 打标效率（连续打标 + 快捷标签位）

**目标**：打标从"中断看片"变"顺手即标"。

### 1.1 后端

- [ ] `GET /api/tags?prefix=&limit=`：`GROUP BY tag` 带次数与最近使用，前缀模糊匹配，供补全。
- **验收**：输入 `高` 返回含"高燃"等已有标签及次数。

### 1.2 扩展

- [ ] `manifest.json` 保持 Alt+S 主命令；快捷标签位不走 `chrome.commands`，改由 `content.js` 监听 `ctrl+shift+digit`（避开命令数限制与浏览器冲突）。
- [ ] `options.html/js` 扩展配置界面：后端地址 + 9 个快捷槽位标签 + "静默直存"开关。
- [ ] `content.js` 浮层改造：
  - 连续打标模式开关：保存后不关，tag 保持、时间戳每 0.5s 跟随播放进度，显示"已连续保存 N 条"；
  - 标签补全下拉（调 `/api/tags`）；
  - 打开浮层时查同视频 ±10s 已存记录 → 提示「12:34 已存过'高燃'」+「追加标签 / 仍然新增」；
  - 消费 `deduped` 提示（Phase 0.3 已完成）。
- **验收（手动）**：看片时连续标 5 个点全程不碰键盘；Ctrl+Shift+1 预填对应标签；补全命中已有标签；重复片段提示合并。

---

## Phase 2：牌一 视频时间线视图

**目标**：把"一筐标签"变成"一张地图"。

### 2.1 数据与归一化

- [ ] Flyway `V2__clips_add_video_fp.sql`：`clips` 加 `video_fp VARCHAR(64)`、`video_duration DOUBLE NULL`。
- [ ] 新增 `VideoFingerprint.normalize(url)`：去 tracking 参数、保留分 P 参数、稳定哈希。
- [ ] 扩展打标时计算并上报 `videoFp` 与 `videoDuration`（`video.duration`）；`SaveClipRequest` 增字段。
- **验收**：同一视频带/不带 tracking 参数聚成同一个 `video_fp`；分 P 视频 P 号保留。

### 2.2 后端

- [ ] `GET /api/videos?limit=&cursor=`：按 `video_fp` 聚合（条数、最新标记时间、标题样例），keyset 分页。
- [ ] `GET /api/videos/{fp}/clips`：时间线标记点（按 `timestamp_sec` 升序，含分 P 号）。
- **验收**：聚合正确、分页可滚动、标记点有序。

### 2.3 前端

- [ ] 新增"视频列表"页（按片名聚合，一行 = 一个视频）。
- [ ] 时间线视图：上段横轴时间线（按秒排布，点击跳转）+ 下段标记点列表（含编辑/删除/相似操作）。
- **验收（手动）**：进一个视频看到全部标记点沿时间轴排布，点击跳回对应秒，分 P 显示正确。

---

## Phase 3：牌三 相似推荐 + 统计面板

**目标**：造发现循环 + 造留存。

### 3.1 后端

- [ ] `GET /api/clips/{id}/similar?limit=`：同标签（含子串）优先 + 自身向量 ANN 近邻（排除自身）加权融合。
- [ ] `GET /api/stats`：总片段 / 视频 / 标签数；Top10 标签（含次数）；按站点分布；近 7 / 30 天趋势（均聚合查询，不加表）。
- **验收**：相似推荐同标签排前；统计数字与库内一致。

### 3.2 前端

- [ ] 导航新增"统计"页，原生 SVG 画柱状（站点分布 / Top 标签）与折线（趋势），深色卡片风。
- [ ] 卡片"相似"按钮 + 弹出相似片段面板。
- **验收（手动）**：从一条结果顺着找到一筐相似片段；统计页数据准确。

---

## Phase 4：工程化收尾（可选，按需）

- [ ] `@RestControllerAdvice` 全局异常处理，统一 `{code, message}` 错误体。
- [ ] 输入校验增强（URL 格式、timestamp 合理性、tag 长度）。
- [ ] README 补功能清单 + 截图；新增 `CHANGELOG.md`；版本 0.1.0 → 0.2.0。
- [ ] 测试补齐：Milvus 降级 / 重连、编辑-删除-重嵌入链路、跳转 hash 解析、扩展端（如可行）。
- [ ] 导出 / 导入 JSON（拍板后纳入）。

---

## 验收总纲

全链路手动验收：冷启动部署 → 语义搜索自动恢复 → 看片连续打标（含快捷位/补全/重复合并）→ 时间线浏览并跳回 → 相似推荐顺藤摸瓜 → 统计数字可信 → 编辑/删除/追加生效且向量一致。
