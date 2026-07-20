# Video Tagger —— 网页视频片段打标签与语义搜索工具 · 设计文档（v2）

- 日期：2026-07-20（v2：架构由 Python 桌面端改为 Java + MySQL + Milvus + Docker）
- 状态：设计已确认（API 提供商待定，以抽象接口解耦）
- 平台：Windows + Docker Desktop；浏览器扩展（Chrome/Edge，Manifest V3）+ Web UI

## 1. 背景与目标

媒体工作者剪辑视频时寻找素材困难：需要一种方式在**观看网页视频的过程中**快速标记感兴趣的片段（记录片名、网址、精确到秒的播放进度、自定义标签），之后能通过**自然语言搜索**找回相关片段并一键跳回对应位置。

本工具**不做**视频画面/语音的 AI 内容分析，标签由用户观看时手动输入，语义搜索作用于标签文本。

技术选型（已与用户确认）：**Java (Spring Boot) 后端 + MySQL 8（全文检索）+ Milvus（向量检索）+ Docker Compose 一键部署 + 浏览器扩展/Web UI**。定位为本地私有化部署的个人工具，同时作为 Java 技术栈练手项目。

### 核心场景

1. 用户在浏览器（B站、YouTube、任意含 `<video>` 的网页）看视频，发现感兴趣的片段。
2. 按快捷键（默认 `Alt+S`），扩展抓取 `{网址, 页面标题, 当前播放进度}`，并在**视频页面内弹出打标签浮层**（片名与时间戳已预填、可编辑）。
3. 用户输入标签（如「高燃战斗」）和可选备注，扩展 POST 给 Java 后端保存。
4. 日后打开 Web UI（`http://localhost:8080`）输入自然语言（如「主角爆种的片段」），后端以混合检索返回相关片段列表。
5. 点击结果，浏览器打开对应网址并自动定位到记录的时间点。

## 2. 总体架构

```
┌────────────────────────────────────────────────┐
│ 浏览器                                          │
│  ├─ 扩展 (MV3)                                  │
│  │   background.js  快捷键/消息转发              │
│  │   content.js     抓<video>、页面内打标签浮层、  │
│  │                  回看 seek                    │
│  └─ Web UI（搜索页，由 Spring Boot 托管静态资源）  │
└───────────────────┬────────────────────────────┘
                    │ HTTP  http://localhost:8080
┌───────────────────▼────────────────────────────┐
│ Docker Compose（一键部署）                       │
│  ├─ app (Spring Boot, Java 17)                  │
│  │   ├─ ClipController   接收扩展推送，保存标签    │
│  │   ├─ SearchController 混合检索                 │
│  │   ├─ JumpController   回看跳转队列             │
│  │   ├─ 关键词召回 → MySQL FULLTEXT (ngram)       │
│  │   ├─ 向量召回   → Milvus ANN (cosine)          │
│  │   └─ RRF 融合 + Embedding API 客户端           │
│  ├─ mysql:8（clips 表 + 全文索引 + 待补任务表）     │
│  └─ milvus-standalone（依赖 etcd + minio）        │
└───────────────────┬────────────────────────────┘
                    │ OpenAI 兼容接口（可选）
                    ▼
             远端 Embedding API
```

### 通信方案

- 后端对外仅暴露 `8080` 端口（可配置），绑定宿主机回环地址即可被浏览器扩展与 Web UI 访问；compose 内部服务以服务名互访，不对外暴露 MySQL/Milvus 端口。
- 扩展通过 `chrome.commands` 注册 `Alt+S`，content script 读取 `<video>` 信息后**在页面内渲染打标签浮层**（Shadow DOM 隔离样式，不污染原页面），确认后由 background POST 到后端。
- **CORS**：后端放行 `chrome-extension://<扩展ID>` 与 `http://localhost:8080` 来源。

### 与原桌面方案的关键差异

- 无系统托盘、无全局热键：搜索页是浏览器标签页；打标签浮层由扩展注入页面内完成，无需切换窗口。
- 标签数据与向量分离存储（MySQL / Milvus），需处理双写一致性（见第 5 节）。

## 3. 模块设计

### 3.1 后端（Java 17 / Spring Boot 3 / MyBatis-Plus / milvus-sdk-java）

```
backend/
├── Dockerfile                     # 多阶段构建：Maven 打包 → JRE 运行
├── pom.xml
└── src/main/
    ├── java/com/videotagger/
    │   ├── controller/
    │   │   ├── ClipController.java      # POST /api/clips 保存标签（扩展调用）
    │   │   ├── SearchController.java    # GET  /api/search?q= 混合检索
    │   │   └── JumpController.java      # 回看跳转队列的写入与查询
    │   ├── service/
    │   │   ├── ClipService.java         # 保存：先写 MySQL，再投递向量任务
    │   │   ├── SearchService.java       # 两路召回 + RRF 融合
    │   │   ├── EmbeddingClient.java     # OpenAI 兼容 Embedding API 客户端
    │   │   └── EmbeddingTaskService.java# 向量异步生成/失败重试
    │   ├── mapper/                      # MyBatis-Plus：ClipMapper, EmbeddingTaskMapper
    │   ├── milvus/
    │   │   ├── MilvusCollectionManager.java # 启动时建 collection/索引（按配置维度）
    │   │   └── VectorSearchService.java     # 向量写入与 ANN 查询
    │   └── config/
    │       ├── AsyncConfig.java         # 向量任务线程池
    │       └── CorsConfig.java          # 放行扩展来源
    └── resources/
        ├── application.yml              # 端口、MySQL/Milvus 连接、Embedding API 配置
        └── static/                      # Web UI（index.html / app.css / app.js）
```

### 3.2 浏览器扩展（Manifest V3）

```
extension/
├── manifest.json    # 权限：commands, storage；content_scripts 全 URL 注入
├── background.js    # 快捷键(Alt+S)；转发保存请求到后端；打开回看标签页
├── content.js       # 定位 <video> 读 currentTime；渲染打标签浮层；轮询回看指令并 seek
├── overlay.css      # 浮层样式（Shadow DOM 内加载）
└── options.html     # 设置页（后端地址/端口）
```

### 3.3 Web UI（静态页，打进 jar 的 `static/`）

- 原生 HTML + CSS + JS（fetch 调 `/api/search`），**不引入前端框架与构建链**，保持 Docker 镜像构建简单；后续如需可平滑升级 Vue。
- 深色卡片风（见第 7 节）。

## 4. 数据模型

### 4.1 MySQL 8（`video_tagger` 库，utf8mb4）

```sql
CREATE TABLE clips (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    title         VARCHAR(512) NOT NULL,          -- 片名（取自页面标题，可编辑）
    url           VARCHAR(1024) NOT NULL,         -- 视频页面网址（回看用）
    timestamp_sec DOUBLE NOT NULL,                -- 播放进度，秒（浮点，精确到毫秒）
    tag           VARCHAR(512) NOT NULL,          -- 用户输入的标签
    note          TEXT,                           -- 可选备注
    created_at    BIGINT NOT NULL,                -- Unix 毫秒时间戳
    FULLTEXT KEY ft_title_tag_note (title, tag, note) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE embedding_tasks (                    -- 向量待生成/重试队列
    clip_id     BIGINT PRIMARY KEY,
    status      VARCHAR(16) NOT NULL,             -- PENDING / DONE / FAILED
    retry_count INT NOT NULL DEFAULT 0,
    updated_at  BIGINT NOT NULL
);
```

片名中的「第几季第几集」不做结构化拆分：保留在 `title` 文本中（多数站点标题自带 S01E03 或「第3集」），由用户在打标签浮层中修正。`title` 与 `tag`、`note` 一并进入 ngram 全文索引参与关键词召回。

### 4.2 Milvus（collection：`clip_embeddings`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `clip_id` | Int64（主键） | 与 MySQL `clips.id` 一致 |
| `vector` | FloatVector(dim) | dim 由 Embedding 模型决定，读配置；默认 1024 |

- 索引：AUTOINDEX，度量 COSINE；应用启动时检查并创建 collection（`MilvusCollectionManager`）。
- 更换 Embedding 模型（维度变化）时需重建 collection，配置项 `embedding.model` 记录在 collection 描述中以便校验。

## 5. 搜索设计与双写一致性

### 5.1 混合检索（多路召回）

```
查询词 q
 ├─ 路1 关键词召回：MATCH(title,tag,note) AGAINST(q NATURAL LANGUAGE MODE) → TopK
 └─ 路2 向量召回：q → Embedding API → Milvus ANN (cosine) → TopK
        ↓
 RRF 融合（k=60）：score(d) = Σ 1/(k + rank_i(d))   （Java 侧实现）
        ↓
 结果列表：片名、时间戳（mm:ss）、标签、备注、综合分
```

- **API 抽象层**：`EmbeddingClient` 按 OpenAI 兼容接口实现（`base-url + api-key + model` 配在 `application.yml`，兼容智谱/阿里百炼/DeepSeek/OpenAI 等）。**提供商待定**，可留空。
- **降级策略**：未配置 API Key 或调用失败时，自动退化为纯关键词召回，功能完整可用，Web UI 提示「语义搜索未启用」。
- 大模型重排序（LLM rerank）：**不做**（YAGNI）。两路 RRF 对个人千级标签库足够，后续按实际体验再议。
- 关于 Milvus 的定位说明：千级标签用 Milvus 属于**有意为之的练手选型**（用户已确认知晓其设计目标为大规模向量场景），架构上向量层独立封装在 `VectorSearchService`，未来可替换为 pgvector/sqlite-vec 而不影响其他模块。

### 5.2 双写一致性（MySQL ↔ Milvus）

1. 保存标签：事务内写 `clips` + 写 `embedding_tasks(PENDING)`；向量生成走 `@Async` 线程池，**不阻塞扩展的保存响应**。
2. 异步任务：调 Embedding API → 写 Milvus → 置 `DONE`；失败则 `retry_count+1`，指数退避重试，超过 5 次置 `FAILED`。
3. 应用启动时扫描 `PENDING/FAILED` 任务补做（覆盖宕机、API 临时不可用等场景）。
4. 删除标签：先删 MySQL，再按 `clip_id` 删 Milvus（失败容忍：孤儿向量不影响召回正确性，定期清理即可——第一版不做定期清理任务）。

## 6. 回看跳转设计

1. Web UI 点击结果 → 调后端写入内存「待跳转」队列（`url → timestamp`，TTL 30 秒），随后 `window.open(url)`：
   - URL 可拼接时间参数（YouTube `&t=123s`、B站 `?t=123`）→ 由后端在返回结果时直接拼好。
   - 其他站点 → 原样打开，由扩展兜底。
2. 扩展 content script 在页面加载后轮询后端「本 URL 是否有待跳转标记」，有则定位 `<video>` 元素 `currentTime = timestamp` 并通知后端清除标记（30 秒超时自动过期）。

## 7. UI 设计（要求：现代化、符合潮流）

整体走**深色模式 + 现代卡片风**。

- **Web UI（搜索页）**：纯 CSS 实现——近黑灰底色（`#1e1e2e` 系）+ 单一强调色（淡紫 `#cba6f7`）；顶部大号圆角搜索框（占位提示、清空按钮、搜索中 loading）；结果**卡片列表**——片名一行、时间戳高亮徽章（`12:34`）、标签与备注次之、匹配度以细分条弱化展示；卡片 hover 微抬升 + 强调色描边；点击/回车即跳转；150ms 淡入动效，克制不炫技。
- **扩展打标签浮层**：Shadow DOM 隔离样式；右上角滑入的圆角小卡片，半透明磨砂（`backdrop-filter: blur`）；片名+时间戳徽章可点击编辑；标签输入框自动聚焦，`Enter` 保存 / `Esc` 取消；保存成功浮层淡出并显示轻提示，不阻塞看视频。
- **图标**：SVG 内联（标签、搜索、播放），不引图标库依赖。
- **字体**：`"Microsoft YaHei UI", system-ui, sans-serif`。

## 8. 错误处理

| 场景 | 处理 |
|---|---|
| 后端未启动（Docker 没起）时按快捷键 | 扩展 POST 失败，浏览器 notification 提示「请先启动 Video Tagger（docker compose up -d）」 |
| 页面无 `<video>` 元素 | 浮层不弹出，notification 提示 |
| content script 无法注入的页面（`chrome://`、新标签页、扩展商店等） | 快捷键无法触发浮层，notification 提示「该页面不支持」 |
| 宿主机 8080 端口被占用 | compose 启动失败，日志提示修改 `docker-compose.yml` 的端口映射（如 `8081:8080`），扩展与浏览器同步改地址 |
| 页面有多个 `<video>` | 取正在播放的；都不在播放取第一个，浮层中允许用户修正时间戳 |
| Embedding API 超时/失败 | 不阻塞保存；任务表重试（见 5.2） |
| MySQL / Milvus 未就绪 | 应用启动重试连接（依赖 compose `depends_on` + 自身重试），健康检查接口 `/actuator/health` |
| 重复按快捷键 | 同一 URL 3 秒内去重，避免连按产生重复记录 |
| 向量维度与 collection 不符（换模型） | 启动校验，日志报错并拒绝向量写入，关键词搜索不受影响 |

## 9. 部署（Docker 一键）

```
docker-compose.yml
├── mysql        mysql:8.0          （卷挂载数据；utf8mb4）
├── etcd         （Milvus 元数据）
├── minio        （Milvus 对象存储）
├── milvus       milvusdb/milvus:v2.4.x（实施计划中锁定具体小版本）
└── app          本地 Dockerfile 构建  （ports: 8080:8080；depends_on: mysql, milvus）
```

- MySQL 与 Milvus（etcd/minio）数据目录**卷挂载持久化**，`compose down` 不丢数据。
- 使用流程：装 Docker Desktop → 项目根目录 `docker compose up -d` → 浏览器开发者模式加载 `extension/` → 打开 `http://localhost:8080`。
- Embedding API Key 通过 compose 的环境变量注入，不硬编码。

## 10. 测试策略

- 单元测试（JUnit5 + Mockito）：`SearchService` 的 RRF 融合、`EmbeddingClient`（mock HTTP）、`EmbeddingTaskService` 重试逻辑。
- 集成测试：MySQL 用 Testcontainers 验证 FULLTEXT 召回与事务；Controller 层用 MockMvc；Milvus 交互以接口隔离，测试中用内存 fake 实现。
- 手动验收：B站/YouTube 打标签 → 浮层预填正确；Web UI 搜索展示；点击结果回看定位；`docker compose down/up` 后数据仍在。

## 11. 范围界定（YAGNI）

不做以下事项：

- 视频画面/语音的 AI 内容分析（CLIP/Whisper 等）——不做
- 本地播放器（PotPlayer/VLC/mpv）支持——不做（架构预留：后端接口与来源无关，未来可加）
- LLM 重排序、搜索结果的 AI 摘要生成——不做
- 多用户、云同步、账号体系——不做
- 标签的层级/分类管理——不做（第一版标签为自由文本）
- Attu（Milvus 可视化管理界面）——不做，排障时用 SDK/日志即可
- 前端框架与构建链——不做（原生静态页）

## 12. 待确定事项

- **Embedding API 提供商**：暂不定。实现按 OpenAI 兼容接口抽象，配置留空时降级关键词搜索。
- 扩展上架方式：第一版以「开发者模式加载已解压扩展」本地使用，不上架商店。
