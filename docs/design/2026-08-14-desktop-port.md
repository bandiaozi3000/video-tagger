# 桌面版改造方案 v1 —— Electron 壳 + Spring Boot 子进程 + SQLite

> 日期：2026-08-14　性质：架构改造方案，**已与用户确认全部关键决策（含壳方案）**，可进入实施。
> 目标：**原生桌面体验、离线、不依赖浏览器访问方式**，功能不变，仅 Windows 平台。
> 壳方案：**Electron**（经 Tauri / WebView2+Java / Electron 三方案对比后选定）。

---

## 0. 决策记录（已拍板）

| # | 决策 | 结论 | 说明 |
|---|---|---|---|
| D1 | 动机 | 原生桌面体验，不要浏览器访问，离线 | 排除渐进式「保留浏览器访问」 |
| D2 | 数据存储 | **完全 SQLite**，数据一次性迁移过去 | 不用双轨，MySQL 迁移后退休 |
| D3 | UI 方案 | **Electron 壳复用现有 6500 行前端** | 前端零重写，工期 3 个月 → 1.5 个月 |
| D4 | 视频导出 | 打包/复用浏览器内核，保留完整功能 | 检测系统 Chrome，缺则提示安装 |
| D5 | 平台 | 仅 Windows | electron-builder 打 .exe |
| D6 | 文档 | 先出本方案文档，确认后开工 | — |
| D7 | 壳技术 | **Electron**（非 WebView2+Java、非 Tauri） | 见第 4 节对比 |
| D8 | 浏览器扩展 | **连桌面版本地子进程** | 扩展打标 → 桌面版子进程 API；打标入口保留 |
| D9 | 同步功能（AniList/omofuna） | **暂不考虑**，手动维护 | 库里数据已大致齐全；同步 UI/入口桌面版不启用 |
| D10 | MinIO 路径迁移 | 数据库字段 + **前端拼接逻辑一起变更** | 避免图片/视频指向失效 |
| D11 | 搜索召回 | **暂不考虑**（后置优化） | 阶段 2 只留「能跑的 LIKE 兜底」，不追求召回 |

---

## 1. 背景与动机

当前 video-tagger 是 Spring Boot 后端 + vanilla JS 单页前端，浏览器访问 localhost 使用。用户诉求：**原生桌面应用（双击即用）、离线可用、不依赖浏览器访问方式**。

核心约束：**功能不变**。已迭代 18 个版本的功能密度极高，任何重写都必须保住既有行为。

---

## 2. 现状资产盘点（复用 vs 替换）

### 2.1 可复用资产（尽量不动）

| 资产 | 规模 | 处理 |
|---|---|---|
| Spring Boot 后端逻辑 | 8300 行 / 112 Java 文件，50 service / 15 controller / 16 mapper / 16 entity | **原样内嵌**，逻辑 0 重写 |
| 前端 UI | 6500 行 app.js + index.html + app.css（毛玻璃/暗色/弹窗规范） | **原样复用**，由内嵌服务 serve |
| 推荐导出模板 | recommend-{chapter,overview,stream}.html | 原样复用 |
| 数据库 schema | Flyway V1~V19，18 张表 | **迁移数据 + 重建为 SQLite 库** |
| 浏览器扩展 | extension/（content.js） | **连桌面版本地子进程**，打标入口保留（D8） |

### 2.2 需替换/摘除

| 组件 | 现状 | 桌面版处理 | 工作量 |
|---|---|---|---|
| MySQL | 元数据存储，18 表 | → **SQLite（xerial JDBC 嵌入式）** | 🟡 中 |
| Milvus + etcd | 向量检索 | **摘除**（向量开关默认关，纯关键词检索） | 🟢 小 |
| MinIO | 媒体/封面对象存储 | → **本地文件系统**（路径直读；**数据库字段 + 前端拼接逻辑一起改**，D10） | 🟡 中 |
| node + puppeteer | 视频导出抓帧 | 保留为可选子系统，复用系统 Chrome | 🟡 中 |
| AniList/omofuna 同步 | 外部番剧源同步 | **桌面版不启用**（D9），手动维护；代码保留 Web 版用 | 🟢 小 |
| 浏览器访问方式 | 浏览器开 localhost | → Electron 桌面窗口（无地址栏/标签页） | 🟢 小 |

---

## 3. 目标架构

```
                    ┌─────────────────────────┐
                    │  浏览器扩展（content.js） │  ← 打标入口，HTTP 连桌面版子进程
                    └───────────┬─────────────┘
                                │ 本地 HTTP
┌───────────────────────────────┴──────────────────┐
│  video-tagger-desktop（Electron 壳，主进程）        │
│  ┌────────────────────────────────────────┐      │
│  │  BrowserWindow（无菜单栏/无地址栏/无标签页） │      │  ← 加载 http://127.0.0.1:PORT
│  └────────────────────────────────────────┘      │
│            │ 本地 HTTP                            │
│  ┌────────────────────────────────────────┐      │
│  │  Spring Boot 子进程（复用现有 8300 行）    │      │  ← spawn java -jar，绑定 127.0.0.1
│  │  ├─ SQLite（xerial JDBC）               │      │
│  │  ├─ 本地文件存储（替代 MinIO）            │      │
│  │  ├─ 纯关键词检索（摘 Milvus，LIKE 兜底）   │      │
│  │  └─ 同步功能禁用（AniList/omofuna，D9）   │      │
│  └────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘
```

**扩展链路（D8）**：浏览器扩展继续作为打标入口，其 API 请求指向桌面版子进程的本地端口（127.0.0.1），与 BrowserWindow 共用同一后端。桌面版启动时子进程就绪后扩展即可用。

**要点**：
- **Electron 主进程**启动时，先 `child_process.spawn('java', ['-jar', jarPath, '--server.port=PORT'])` 拉起 Spring Boot 子进程；轮询 `/actuator/health` 返回 200 后，打开 BrowserWindow 加载该端口页面。
- BrowserWindow = 原生桌面窗口，**无浏览器 UI**（隐藏菜单栏、无地址栏、无标签页、无插件），用户感知就是原生应用。
- **JRE 随应用打包**（jlink 裁剪），用户无需预装 Java。
- 本地端口只绑定 127.0.0.1，不对外暴露。
- 退出时（`will-quit`）优雅关闭子进程（`actuator/shutdown` 兜底 kill PID），数据落 SQLite 文件，**离线可用**。

---

## 4. 关键技术决策：壳技术选型（已定 Electron）✅

> 前端用了大量现代 CSS（`backdrop-filter` 毛玻璃 26 处、`grid` 9 处、`aspect-ratio` 11 处、`gap` 143 处），**内核必须支持**。三个候选在 Windows 上内核全是 Chromium 系（Electron 自带 / Tauri 用系统 Edge / WebView2 也是系统 Edge），CSS 渲染一关全过。真正分水岭在**后端融入方式**与**成熟度**。

### 4.1 三方案对比

| 维度 | WebView2 + Java 壳 | Electron + Java 子进程 | Tauri + Java 子进程 |
|---|---|---|---|
| 后端融入 | 同进程内嵌 | `spawn java -jar` 子进程 + HTTP | `spawn java -jar` 子进程 + HTTP |
| Java 绑定成熟度 | ❌ 无成熟库，自写 COM 风险高 | ✅ 路径成熟，现成模板 | ✅ Tauri v2 sidecar |
| 包体（含 JRE+jar） | ~50-70MB | ~135-150MB（多带 Chromium 85MB） | ~55-70MB |
| 内存 / 启动 | 低 / 快 | 高（100-400MB）/ 慢（1-2s） | 低 / 快 |
| 壳语言 | Java | JS（项目已有 node 基础） | Rust（第三门语言） |
| 生态 / 踩坑 | 无 | 100k+ npm 包，文档全 | 插件 500+，较新 |
| 整体风险 | 🔴 高 | 🟢 最低 | 🟡 中 |

### 4.2 选定：Electron ✅

- **理由**：成熟度最高、踩坑文档全、项目已有 node 基础（`backend/scripts` 已有 node_modules + package.json）；Spring Boot 集成是成熟模式（`spawn java -jar` + 健康检查 + BrowserWindow），有现成模板参照。
- **代价**：包体 ~135-150MB、内存偏高——个人本地库可接受，换取零学习成本和最高确定性。
- **排除理由**：
  - WebView2+Java：无成熟 Java 绑定库，手写 COM 生命周期管理风险过高，不值得为省包体冒险。
  - Tauri：壳要学 Rust（项目无基础），收益（更小包体）对"仅 Windows 本地单机"场景不关键。

### 4.3 Electron 实现要点

1. **主进程**：`spawn('java', ['-jar', jar, '--server.port=PORT'])`，`windowsHide: true`；轮询 `/actuator/health` 就绪后开 BrowserWindow。
2. **安全**：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；现有前端纯 HTTP 调本地 API，无需 Node API，零改动。
3. **端口**：固定本地端口（如 9010，避开 Windows 保留端口段 8080-8090），绑定 127.0.0.1；开发/生产分离。
4. **退出**：`will-quit` 时 `actuator/shutdown` 优雅关闭子进程，兜底记录 PID kill，防进程残留。
5. **打包**：electron-builder，JRE 用 jlink 裁剪后随 `extraFiles` 打包进 resources。

---

## 5. 数据迁移方案（MySQL → SQLite）

### 5.1 迁移工具设计

**一次性命令行工具**（复用现有 entity + mapper），放独立模块：

```
流程：启动迁移工具 → 连配置的 MySQL → 按外键顺序读表 → 写入 SQLite → 行数校验 → 完成
```

表读取顺序（依赖序）：`media → episode → clip → tag/media_tag → collection/collection_item → 各设置/字典表 → title_mapping → recommend_preset`

### 5.2 三类迁移数据

| 类型 | 内容 | 处理 |
|---|---|---|
| 元数据 | 18 张表（媒体/集/片段/标签/收藏/设置） | entity/mapper 直读直写，字段对位 |
| 媒体文件 | 封面/视频/BGM 的 MinIO 对象 | **下载到本地目录 + 路径改写**；且**前端拼 URL 逻辑一并改**（D10），否则图片/video 指向失效 |
| 向量数据 | Milvus 里的 embedding | **不迁移**（向量功能默认关，纯关键词检索） |

### 5.3 SQLite 化三个技术要点

1. **MyBatis-Plus 方言**：有 sqlite 方言支持，但需扫一遍全部 SQL——`JSON 字段`、`FULLTEXT`（ngram 分词）、`LIKE` 通配、`LIMIT` 语法在 SQLite 要适配。
2. **⚠️ 搜索：语法兼容必须做，召回优化后置（D11）**：MySQL 的 ngram 全文语法、`JSON_CONTAINS` 等函数在 SQLite 是**报错不是效果差**，会让应用起不来。所以阶段 2 必须：
   - 把 ngram 全文/JSON 函数 SQL 全部改写为 SQLite 可执行的 **LIKE 兜底**（能用不崩）；
   - **召回质量优化不做**（用户拍板后置），FTS5/自定义分词/JVM 倒排等方案全部移入"后期优化"清单。
3. **Flyway 迁移文件**：现有 V1~V19 是 MySQL 语法，SQLite 库需换一套建表语句（V1__sqlite_baseline.sql），旧文件留作迁移工具读取源。

---

## 6. 分阶段实施计划

| 阶段 | 内容 | 产出 | 预估 |
|---|---|---|---|
| **1. Electron 工程骨架** | 建 desktop 壳工程（main/preload/package.json），`spawn java -jar` 拉起现有 Spring Boot，健康检查后开 BrowserWindow 加载本地页面 | 壳能打开窗口加载现有页面，CSS 全渲染 | 3~5 天 |
| **2. 存储层 SQLite 化** | MyBatis-Plus 方言适配、**ngram/JSON 函数改写 LIKE 兜底（D11）**、**本地文件路径 + 前端拼接逻辑一并改（D10）**、摘 Milvus | 后端全量跑在 SQLite，搜索能用 | 1~2 周 |
| **3. 数据迁移工具** | 一次性迁移工具 + 行数校验 + 媒体文件落地 | MySQL 数据完整入 SQLite | 1 周 |
| **4. 桌面版集成** | 扩展接子进程（D8）、同步功能禁用（D9）、视频导出适配（检测 Chrome + ffmpeg/node 本地化）、Electron 下载/退出清理 | 桌面版全功能可用 | 1~2 周 |
| **5. 打包分发** | electron-builder 打 .exe（JRE jlink 裁剪随包）、数据目录规划（%APPDATA%）、安装/升级 | 可分发安装包 | 3~5 天 |
| **合计** | | | **约 1~1.5 个月** |
| 后期（不做） | 搜索召回优化（FTS5/自定义分词/倒排）、AniList/omofuna 同步、向量检索 | 用户拍板后置 | — |

### 实施状态（2026-08-14 全部完成 ✅）

| 阶段 | 状态 | 实际落地与差异 |
|---|---|---|
| 1 Electron 工程骨架 | ✅ | desktop/ 完成；spawn + 健康检查 + BrowserWindow + 三段式退出清理（before-quit 阻塞式，will-quit 不等待 async 的坑已修） |
| 2 存储层 SQLite 化 | ✅ | 18 张表 sqlite-schema.sql；MATCH→LIKE、CONCAT→`\|\|`、INSERT IGNORE→OR IGNORE、SUBSTRING_INDEX/FROM_UNIXTIME 改写；MyBatisConfig 加 SQLITE 方言 |
| 3 数据迁移工具 | ✅ | MigrationTool：MySQL→SQLite 全 18 表 0.9s 迁移 + 行数校验；PropertiesLauncher 从 fat jar 跑自定义 main；封面目录整体拷贝 |
| 4 桌面版集成 | ✅ | 首次启动迁移引导对话框；同步功能禁用（OmofunaSyncController @ConditionalOnProperty + MediaController syncEnabled）；Electron will-download 接管另存为；工具链检测注入 |
| 5 打包分发 | ✅ | electron-builder 打 exe 372MB；**JRE 未 jlink 裁剪**（jdeps 分析 Spring 反射缺类风险，改打包完整 JRE）；数据目录 %APPDATA%/video-tagger/data |

**关键差异修正**：
- **MinIO 路径改写不存在**：封面实际存本地 `data/covers`（cover_path 存 `/covers/xxx.jpg` 相对路径），非 MinIO 对象存储。D10 的"前端拼接逻辑改"无需做，迁移只拷封面目录。
- **JRE 不裁剪**：jdeps 对 Spring/MyBatis/Jackson 反射加载类分析不全，jlink 裁剪风险高，改打包完整 JRE（包体 +300MB，换取功能 100% 可靠）。
- **APP_MODE 桌面模式**：项目内置 `?appMode=recommend` 推荐工具精简模式，但本桌面版要完整功能，壳加载**不加**该参数走完整视图。

---

## 7. 工程目录规划

```
video-tagger/
├── backend/                    # 现有 Spring Boot（微改：数据源可切 SQLite）
├── desktop/                    # 【新增】Electron 壳工程
│   ├── package.json            # electron + electron-builder 依赖与打包配置
│   ├── main.js                 # 主进程：spawn java -jar + 健康检查 + BrowserWindow + 退出清理
│   ├── preload.js              # contextBridge 安全桥（现有前端纯 HTTP，可能不需要）
│   └── resources/
│       ├── jre/                # jlink 裁剪的 JRE（随包分发，用户无需装 Java）
│       └── app/                # backend 构建出的 video-tagger.jar
├── migration-tool/             # 【新增】一次性 MySQL→SQLite 迁移工具
└── data/
    ├── sqlite/video_tagger.db  # 【新增】桌面版本地库
    └── media/                  # 【新增】本地媒体/封面目录
```

**backend 改动原则**：数据源改为可配置（MySQL / SQLite 双 profile），默认 SQLite；其余业务逻辑不动。

**desktop 壳改动原则**：壳只负责「拉起子进程 → 健康检查 → 开窗 → 退出清理」，不含任何业务逻辑；前端资源由 Spring Boot 子进程 serve，壳不打包静态资源。

---

## 8. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| **搜索语法不兼容直接崩**（ngram/JSON 函数，非召回问题） | 🔴 高 | 阶段 2 全量改写 LIKE 兜底，保证能跑；召回优化后置（D11） |
| **扩展连子进程的端口/权限** | 🟡 中 | 扩展配置指向本地端口（127.0.0.1）；子进程就绪后才可用；CORS 放行 localhost |
| **MinIO→本地路径改写漏项**（含前端拼接逻辑） | 🟡 中 | 迁移工具逐类路径改写 + **前端 URL 拼接处一并改（D10）** + 迁移后抽查 |
| **Electron 下载行为**（导出 HTML/视频无落点） | 🟡 中 | 主进程配 save dialog / shell.openPath，接管下载事件 |
| **jlink 裁剪 JRE 漏类**（Spring Boot + MyBatis-Plus + Jackson 反射） | 🟡 中 | jdeps 分析 + 全量功能冒烟验证后再定裁剪集 |
| **数据目录可写性**（装 Program Files 只读） | 🟡 中 | 库/媒体放 `%APPDATA%/video-tagger/`，安装目录只放程序 |
| Electron 子进程残留 / 端口冲突 | 🟡 中 | `will-quit` 优雅关闭 + PID 兜底 kill；端口探测避开保留段（参考 8080-8090 坑） |
| 测试基建（Testcontainers 起 MySQL） | 🟡 中 | SQLite 化后测试切本地数据源，保住回归保障 |
| 包体大（~135-150MB，含 Chromium + JRE） | 🟢 低 | JRE 用 jlink 裁剪最小集；可接受，换取成熟度 |
| SQLite 并发/写入性能 vs MySQL | 🟢 低 | 单用户桌面场景，SQLite 绰绰有余 |
| 子进程启动慢（Java 冷启动） | 🟢 低 | 开窗先显示 splash，健康检查就绪再切主界面 |
| 多实例/单实例锁 | 🟢 低 | app.requestSingleInstanceLock，防开俩窗口抢端口 |

---

## 9. 验收标准

| # | 验收项 | 状态 |
|---|---|---|
| 1 | 双击桌面图标直接进入应用，**全程不出现浏览器**（无地址栏/标签页/菜单栏） | ✅ win-unpacked + 安装器 exe 验证通过 |
| 2 | 断网可用：核心功能（检索可用/打标/收藏/导出）本地完成；同步功能不启用 | ✅ 数据全本地；同步已禁用 |
| 3 | 现有 MySQL 数据完整迁入 SQLite（行数校验一致，媒体文件可达） | ✅ 18 表全对齐 + 封面目录拷贝；API 实测（5524 媒体/搜索/标签/收藏） |
| 4 | 关键词搜索**可运行**（LIKE 兜底），召回优化后置 | ✅ 搜索"犬夜叉"正常召回；`semanticEnabled:false` |
| 5 | 浏览器扩展连桌面版子进程可正常打标 | ⏳ 壳端口 127.0.0.1 已就绪；扩展指向需手动配置（Web 版扩展改造未做，D8 部分） |
| 6 | 视频导出完整可用（复用系统 Chrome，无则明确提示） | ⏳ 工具链检测已注入；端到端导出未实测（可选功能） |
| 7 | 毛玻璃/暗色等 UI 效果在 Electron 内核下正常渲染 | ✅ 暗色主题、5 tab、页面完整渲染 |
| 8 | 退出应用无 Java 进程残留；单实例锁生效 | ✅ 打包版退出后 java 无残留；单实例锁已实现 |

**遗留（非阻塞）**：扩展改造（D8 完整落地）、视频导出端到端实测。核心产品路径已验证。

---

## 10. 下一步

- [x] ~~用户确认 WebView 内核选型~~ → 已定 **Electron**（D7）
- [x] 用户拍板：扩展连子进程（D8）、同步暂不做（D9）、MinIO 连前端逻辑改（D10）、搜索后置（D11）
- [x] 阶段 1~5 全部实施完成（2026-08-14）→ 产出 `desktop/dist/video-tagger-desktop-0.1.0.exe`
- [ ] 用户统一验收（按第 9 节验收表）
- [ ] 补 worklog + story + 记忆
