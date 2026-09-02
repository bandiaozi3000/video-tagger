# 技术科普（按日记录）

> 本清单沉淀**技术基础知识 / 概念科普**——讲清「某个技术是什么 / 怎么用」。按日期每日记录：每日一段、往底部追加，顶部有目录索引可快速定位日期。
>
> **机制**：
> - **与 `technology.md` 的区别**：technology.md 记**项目排障 / 技术方案**（遇到什么问题 → 怎么解决 → 原理）；本文件记**通用技术知识科普**（这个技术是什么、核心概念、特点、适用场景），不绑定具体排障。
> - **记录内容**：**定义 / 核心概念 / 特点（优点与局限）/ 适用场景 / 例子** 等必要信息。
> - **触发方式**：用户要求记录某项技术知识 / 概念时。
>
> 相邻文档：技术排障 → `docs/learn/technology.md`；问题清单（bug）→ `docs/testing/issues.md`。

## 目录（按日期）

- [2026-08-10](#2026-08-10)
- [2026-08-17](#2026-08-17)
- [2026-08-26](#2026-08-26)

---

## 记录模板（新内容按此追加）

```
### 一句话标题
- **日期**：YYYY-MM-DD
- **定义**：xxx
- **核心概念**：xxx
- **特点**：xxx（优点 / 局限）
- **适用场景**：xxx
- **例子**：xxx
```

---

## 2026-08-10

### SVG（可缩放矢量图形）

- **日期**：2026-08-10
- **定义**：SVG = **S**calable **V**ector **G**raphics（可缩放矢量图形），一种基于 XML 文本的**矢量图形**格式，浏览器原生渲染，常用于网页图标 / logo / 图形。
- **核心概念**：
  - **矢量 vs 位图**：矢量用**数学公式**描述图形（圆心 + 半径 + 颜色 = 一个圆），**任意缩放都清晰**；位图（PNG / JPG）是**像素点阵**，放大就糊。
  - SVG 本质是**一段文本**：像写 HTML 一样用 `<svg>` 标签声明形状（`<rect>` 方块、`<path>` 路径、`<circle>` 圆），支持渐变、滤镜。
- **特点**：
  - **优点**：体积小（几何图形一个图标往往几百字节）；无限缩放不糊；能用渐变 / 滤镜做视觉；可编程、可动画（CSS / JS 控制）；可内联进 HTML 或独立 `.svg` 文件。
  - **局限**：不适合照片 / 写实画面（矢量描述会爆量）；老浏览器兼容性差（现代浏览器已全支持）。
- **适用场景**：图标、logo、favicon、图表、插画、几何图形为主的东西。**不适用**：照片、写实画面（用 JPG / PNG）。
- **例子**：本项目 `static/favicon.svg`——霓虹渐变圆角块 + 白色播放三角 + 金色小星，整个文件仅 783 字节，浏览器 tab 缩到 16px 依然锐利。
- **涉及技术**：XML / HTML `<svg>` / CSS 动画 / 渐变。

### 归一化（Normalization）

- **日期**：2026-08-10
- **定义**：归一化 = 把**不同形式的数据转换成统一的标准形式**，消除表示差异与噪音，使数据可比、可匹配、可处理。
- **核心概念**（按语境区分）：
  - **文本归一化**：去标点/空格、转小写、统一等价词（如 `baby↔宝贝`）、去虚词——让「我爱你BABY」和「爱你宝贝」归到同一标准形「爱你宝贝」，机器才能比对。本文档语境即此。
  - **数据归一化（数值）**：把不同量纲的数值缩放到统一范围（如 0~1），供算法 / 图表 / 模型使用。
  - **数据库规范化（范式）**：拆分表结构消除数据冗余（本项目的 media/clip 分层即类似思路）。
- **特点**：
  - **优点**：消除「表示差异」让机器能比对（匹配 / 去重 / 搜索更准）；规则集中在代码里，**可维护、可单测**。
  - **代价**：可能丢失细节（如括号内信息）；等价词 / 虚词规则表需**持续维护**。
- **适用场景**：标题 / 名称匹配、搜索、去重、数据预处理、机器学习输入清洗。
- **例子**：本项目媒体识别——`util/MediaTitleNormalizer` 把「我爱你BABY」归一化（去「我」+ `baby→宝贝`）→「爱你宝贝」，与库里「爱你宝贝」归一化后相等 → 相似度 1.0（实现细节见 `technology.md` 片段媒体识别段）。
- **涉及技术**：Java 正则 / 字符替换、字符串比较、编辑距离。

---

## 2026-08-17

### asar（Electron 应用打包归档格式）

- **日期**：2026-08-17
- **定义**：asar（**A**tom **S**hell **AR**chive，源自 Electron 前身 Atom Shell）= 把应用的全部代码与资源（JS / JSON / 图片等）**拼装成单个文件**的归档格式。桌面版壳代码 `resources/app.asar` 即此格式。
- **核心概念**：
  - **单文件目录**：一个 asar = 「文件目录表（JSON header，含每个文件的路径/偏移/大小）+ 各文件内容**明文拼接**」。类似无压缩的 zip / tar。
  - **Electron 内置透明支持**：Electron patch 了 Node 的 `fs` 与 `require`，应用内把 asar 当普通目录用（`require('./main')`、`fs.readFile()` 自动从 asar 解出），开发者感知不到归档。
- **特点**：
  - **优点**：读性能好（Windows 加载上千小文件慢，单文件按偏移读更快）；文件数从几千降到 1（Windows 处理海量小文件 / 安装慢）；避免深路径超 260 字符。
  - **局限**：**不压缩、不加密**——`asar extract` 一分钟即可解出全部明文源码，Electron 应用保护「防君子不防小人」。
- **适用场景**：任何 Electron 应用的分发打包（`app.asar` 即应用入口代码）；**不适用**：需要加密保护源码的场景（Electron 先天做不到）。
- **例子**：本项目桌面版 `release/VideoTagger/resources/app.asar`（35KB）——内含 `main.js` / `preload.js` / `update.js` / `package.json` 四个文件，对应 `desktop/package.json` 的 `build.files` 配置；electron-builder 打包时收进 asar，后端 `video-tagger-backend.jar` 则作为独立 extraResources 放 `resources/app/`（jar 与壳代码两路互不打包）。在线更新只替换 jar，**app.asar 内的壳代码不在更新范围**，改壳须整包重发。
- **涉及技术**：Electron / electron-builder / Node `fs` 模块 patch。

---

## 2026-08-26

### Flyway（数据库版本控制 / 迁移工具）

- **日期**：2026-08-26
- **定义**：Flyway 是**数据库版本控制工具**——像 Git 管理代码一样，用「带版本号的迁移脚本」管理数据库 schema 的演进。应用启动时自动对比「本地迁移脚本」与「数据库内的版本账本」，**只执行缺失的迁移**，不动已应用的。
- **核心概念**：
  - **迁移脚本**：命名硬规定 `V<序号>__<描述>.sql`，序号严格递增（`V1__baseline.sql` … `V20__clip_end_sec.sql` … `V23__metadata_library.sql`）。一个文件 = 一次 schema 变更（建表 / 加列 / 改索引）。
  - **版本账本 `flyway_schema_history`**：Flyway 的"账本"，每行 = 一条已执行迁移，记录 `version / description / checksum / installed_rank / success`。`success=0` 表示该次执行失败。
  - **启动执行流程**：① 扫描 classpath 的迁移文件 → ② 读账本 → ③ 算出待执行集 → ④ 按版本号升序执行 → ⑤ 记入账本。
  - **outOfOrder（乱序补跑）**：默认 `false` 只执行「版本号 > 账本最高版本」的迁移；`true` 允许补跑中间缺失的历史版本（按版本号升序）。
  - **checksum 校验**：每个已应用迁移的文件内容哈希存进账本；本地文件被改动 → 启动报 `Migration checksum mismatch` 拒绝运行。**禁止回头改已应用的迁移**——要改 schema 就写新版本，别动旧文件。
  - **baseline（接管老库）**：`baseline-on-migrate=true` + `baselineVersion` 把「已有表结构的老库」标记为已应用到某版本，Flyway 从下一版开始接管。
- **特点**：
  - **优点**：schema 演进可版本化、可评审、可回放；空库一键建全、旧库只跑增量、多环境（dev / prod）不漂移；迁移失败可 `repair` 后重试。
  - **局限**：**无内置回滚**（undo 为付费版功能）；MySQL DDL 隐式提交，单条迁移中途失败已执行的 DDL 不会自动撤销；`outOfOrder` 长期开启会让迁移历史顺序错乱、新环境难追踪，一般只用于一次性补历史空洞。
- **适用场景**：任何需要「数据库 schema 随代码版本演进」的项目。本项目中 **Web/MySQL 侧用 Flyway**；**SQLite 桌面版禁用 Flyway**，改用自研 MigrationTool + `PRAGMA user_version` + `migration-sqlite/vNN.sql` 按序执行（双库两套机制，见 `technology.md` 双库方言段与项目记忆）。
- **例子**：2026-08-26 MySQL 数据恢复后，恢复库账本停在 V22，而代码里有 V20/V23 未应用 → 默认 `outOfOrder=false` 启动报 `Detected resolved migration not applied to database: 20` 拒绝启动 → 以 `SPRING_FLYWAY_OUT_OF_ORDER=true` 启动补跑 **V20（clips 加 end_sec 列）+ V23（v0.22 六张新表）**，核对 `flyway_schema_history` 全部 `success=1`、新表/新列就位。
- **涉及技术**：Flyway / MySQL DDL / `flyway_schema_history` / checksum 校验 / baseline / outOfOrder / MigrationTool（SQLite 自研）。
