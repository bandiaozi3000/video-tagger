# v0.19 片段视频与截图导出实施计划

- **日期**：2026-08-24
- **版本**：v0.19.0～v0.19.2
- **状态**：Phase 1/2/3 代码实现完成，待真实视频、浏览器录制授权与 Electron 人工验收
- **设计文档**：`docs/superpowers/specs/2026-08-24-video-tagger-v019-clip-export-design.md`
- **主计划约定**：本文件是 v0.19 的唯一执行计划。后续需求变更先更新设计文档，再同步更新本文件的阶段、任务、验收和变更记录；不另建漂移的 v0.19 子计划。

## 1. 实施原则

1. 先数据兼容，再做导出能力；旧扩展、旧片段和无 `endSec` 请求不能被破坏。
2. 本地 ffmpeg 是可靠主链路，浏览器录屏放到最后阶段。
3. 所有文件路径由服务端根据 clip id / videoFp 和白名单生成，不接受任意客户端路径。
4. 长耗时导出异步化；临时文件成功校验后再替换正式产物。
5. 每阶段完成后更新主设计文档、执行计划和当天工作日志；代码变更需按项目规则补 CHANGELOG/story（是否升版按版本决策规则处理）。
6. UI 继续使用项目现有毛玻璃弹层、深色霓虹、统一反馈组件，不使用原生对话框。

## 2. 现状基线核查

- 片段实体：`backend/src/main/java/com/videotagger/entity/Clip.java`；当前有 `timestampSec/videoDuration`，无 `endSec`。
- 保存/编辑 DTO：`backend/src/main/java/com/videotagger/service/SaveClipRequest.java`。
- 片段接口：`backend/src/main/java/com/videotagger/controller/ClipController.java`。
- 片段业务：`backend/src/main/java/com/videotagger/service/ClipService.java`。
- SQLite 基线：`backend/src/main/resources/db/sqlite-schema.sql`。
- MySQL 迁移：`backend/src/main/resources/db/migration/`，当前已到 V19。
- SQLite 迁移：由 `SqliteSchemaMigrator` 读取 `db/migration-sqlite`，当前基线版本为 1。
- 扩展打标：`extension/content.js`，当前只提交 `timestampSec/videoDuration`。
- Web UI：`backend/src/main/resources/static/index.html/app.js/app.css`。
- 桌面壳：`desktop/main.js`，负责启动后端和注入资源；不把业务逻辑放入 Electron 壳。
- 推荐导出已有 Node/ffmpeg 配置，可复用路径解析和进程编排经验，但不复用推荐导出的产物模型。

## 3. 阶段总览

| 阶段 | 目标 | 产出 | 里程碑 |
|---|---|---|---|
| Phase 0 | 详细设计冻结与实现前验证 | 主 spec、主 plan、测试矩阵、目录/接口确认 | 用户确认后开始 |
| Phase 1 / v0.19.0 | 数据模型、本地视频导出、单帧截图 | 双库迁移、Clip 时间区间、异步本地导出、详情产物区 | 本地链路可用 |
| Phase 2 / v0.19.1 | 连续截图与任务体验 | 间隔/上限、进度、取消、元数据、清理 | 图片批量链路可用 |
| Phase 3 / v0.19.2 | 浏览器录屏回退 | MediaRecorder、预览、WEBM 上传、手动停止 | 无本地源视频也可产出 |
| Phase 4 | 集成验收与文档收口 | Web/Electron 验证、测试结果、文档同步 | 用户验收 |

## 4. Phase 0：用户确认前（已完成）

本阶段只允许文档操作：

- [x] 核对现有 Clip、扩展、双库迁移和前端布局边界；
- [x] 确认 v0.19 关键拍板：精确模式、指纹命名、30 分钟上限、覆盖、手动停止；
- [x] 创建 v0.19 唯一主设计文档；
- [x] 创建 v0.19 唯一执行计划；
- [x] 记录工作日志和项目记忆；
- [x] 用户确认设计和计划；
- [x] 用户确认后进入 Phase 1；

## 5. Phase 1：v0.19.0 本地链路（实现完成，待真实媒体验收）

### 已完成

- [x] `endSec`、MySQL V20、SQLite v02 与新库基线；
- [x] 旧 DTO 构造器/旧 JSON 兼容，开始/结束/总时长校验；
- [x] 本地视频目录配置、指纹+白名单扩展名解析、冲突/越界拒绝；
- [x] 独立内存导出任务、异步 ffmpeg、超时/取消/并发保护、临时文件原子替换；
- [x] 精确 MP4、单帧 JPEG、产物列表/访问/删除和片段删除清理；
- [x] Web 片段详情导出操作、区间展示、编辑结束时间；扩展开始/结束时间编辑与连续模式兼容。

### 5.1 数据库与实体

1. 新增 MySQL `V20__clip_end_sec.sql`。
2. 新增 SQLite `db/migration-sqlite/v02.sql`。
3. 更新 `db/sqlite-schema.sql` 的 clips 表。
4. `Clip` 增加 `endSec`。
5. `SaveClipRequest` 增加 `endSec`，保留旧构造器/旧 JSON 兼容。
6. 检查 MyBatis `SELECT *`、动态映射和所有 clips 查询无需额外列清单；若存在显式列清单，同步增加 `end_sec AS endSec`。
7. 在 service 层集中实现时间校验与有效结束时间解析，避免 controller、ffmpeg、前端各自复制规则。

**测试**：迁移单测、旧请求保存、合法/非法区间、空值兼容、`videoDuration` 边界。

### 5.2 本地视频配置与定位

1. 新增 `ClipExportProperties` 配置类：`videoDir`、`maxDurationSec`、允许扩展名、ffmpeg 路径、任务超时、上传限制。
2. 默认视频目录为 `${VT_DATA_DIR:data}/videos`。
3. 实现 `LocalVideoResolver`：按 `videoFp` + 白名单扩展名扫描根目录。
4. 对多个匹配返回冲突结果；对目录外路径、符号链接/规范化后的越界路径做拒绝或明确策略。
5. 检查桌面打包是否需要创建 `videos` 目录；如果需要，补 `VideoTaggerApplication.ensureDataDirs()`，不改变已有数据目录行为。

**测试**：唯一命中、无命中、多命中、非法扩展名、路径越界、配置覆盖。

### 5.3 导出任务基础设施

1. 新增 clip 导出任务领域模型/内存任务注册或复用现有通用异步模式；不要直接复用推荐导出任务的业务表，除非评估后确认生命周期完全一致。
2. 定义状态：`PENDING/RUNNING/SUCCEEDED/FAILED/CANCELLED`。
3. 实现任务创建、状态查询、取消、错误信息和进程句柄管理。
4. 任务执行使用 `ProcessBuilder` 参数数组，不经过 shell。
5. 实现超时、进程销毁、应用退出时的清理策略；任务失败不覆盖旧产物。
6. 增加并发限制，至少防止同一 clip 的同一产物类型并发写入。

**测试**：成功、非零退出、超时、取消、重复提交、旧文件保留、应用重启状态。

### 5.4 视频导出

1. 实现本地 MP4 精确模式参数：`-ss start -i input -t duration` + H.264/AAC + `+faststart`。
2. 使用临时文件，如 `{clipId}.mp4.part`。
3. 成功后检查退出码、文件存在、文件非空，必要时调用 ffprobe 检查基本时长，再原子替换 `{clipId}.mp4`。
4. 应用 30 分钟默认上限；超限在 service 层拒绝。
5. 为找不到源、冲突、ffmpeg 缺失、时间未知、超时、磁盘不足提供可识别错误码/消息。

**测试**：真实小视频冒烟（有音频/无音频各一份）、参数正确性、输出时长误差、失败不覆盖。

### 5.5 单帧截图

1. 实现单帧时间策略：middle/start/end/custom。
2. 使用 ffmpeg 输出 JPEG 到 `{data}/clip-images/{clipId}/single.jpg`。
3. 临时文件 + 成功替换；不写 cover_path/detail_cover_path。
4. 输出元数据至少能返回类型、URL、大小、生成时间。

**测试**：有/无 end、四种时间策略、非法 custom、覆盖、截图失败。

### 5.6 API 与前端

后端新增/扩展：

```text
POST /api/clips/{id}/export-video
POST /api/clips/{id}/export-images
GET  /api/clips/export-tasks/{taskId}
GET  /api/clips/{id}/exports
GET  /api/clips/{id}/exports/{artifact}
DELETE /api/clips/{id}/exports/{artifact}
```

实现要求：

- 导出长任务返回 taskId，不同步等待；
- 视频访问支持 Range；
- artifact 使用白名单枚举，不允许任意路径；
- multipart 限制待 Phase 3 上传时统一补齐。

前端：

1. Web 片段编辑弹窗增加结束时间。
2. 片段详情增加区间展示和“导出视频/截图/查看产物”。
3. 任务状态轮询、成功/失败/超时反馈。
4. 搜索结果和时间线对有区间片段显示 `start – end`，旧数据维持单时间显示。
5. 扩展浮层增加开始/结束时间和“以当前时间设为结束”；连续模式不覆盖用户手填 end。
6. 保持 `Alt+S`、快捷静默保存和旧配置兼容。

**前端测试**：`node --check`；Web 与桌面两布局；旧片段、空态、错误态、连续打标。

## 6. Phase 2：v0.19.1 连续截图与任务增强（实现完成，待真实视频验收）

1. 连续截图请求支持 `intervalSec=1/2/5`，服务端限制允许值。
2. 计算预计帧数并限制最多 300 张；超限返回可操作提示。
3. 输出 `{clipId}/frame-0001.jpg`，成功目录替换，失败保留旧目录。
4. 任务状态增加进度：已生成帧数/预计帧数、当前阶段、产物路径。
5. 支持取消：停止 ffmpeg，清理 `.part` 和未完成临时目录，不删除旧成功产物。
6. 产物列表显示格式、大小、时长/帧数、生成时间、来源（local/browser/manual）。
7. 增加孤儿文件后台清理，不阻塞启动；删除片段/集/媒体时覆盖全部产物。
8. 评估是否需要 `clip_export` 元数据表；若新增，先同步本 spec/plan 和双库迁移，再实现。

**测试**：间隔、边界、300 张上限、取消、重启、孤儿清理、级联删除、同片段并发。

## 7. Phase 3：v0.19.2 浏览器回退（实现完成，待真实授权/Electron 验收）

### 7.1 前端录制

1. 片段详情检测本地源不可用时展示回退入口和说明。
2. 打开原 URL，提供起点确认；无法自动 seek 时允许用户手动定位。
3. `navigator.mediaDevices.getDisplayMedia()` 请求视频/可选系统音频。
4. 按 `MediaRecorder.isTypeSupported` 选择 VP9/VP8 WEBM。
5. 3 秒倒计时后录制；有 end 时按时停止，无 end 时提供明显的手动停止按钮。
6. 录制完成后先本地预览，支持重新录制或上传保存。
7. 处理用户取消授权、轨道 ended、标签页切换、浏览器不支持和录制空文件。

### 7.2 后端上传

1. `POST /api/clips/{id}/exports/video` multipart 上传。
2. 限制 MIME、扩展名、大小、clip 存在性和任务冲突。
3. 临时保存、非空校验、必要时 ffprobe 校验后替换正式 WEBM。
4. 标记来源为 browser/manual-stop；不伪称精确裁剪。
5. 如需 MP4 转码，另作为小范围后续任务，不能阻塞 v0.19.2 WEBM 交付。

**测试**：Chrome/Electron、授权/拒绝、手动停止、结束自动停止、无音频、格式降级、上传失败、覆盖旧产物。

## 8. Phase 4：集成验证与收口

### 8.1 后端验证

按项目环境先导出 Maven PATH，优先离线执行：

```bash
mvn -q compile -o
mvn -q test -o -Dtest='Clip*Test,ClipExport*Test,SqliteSchemaMigratorTest' -DfailIfNoTests=false
```

集成测试需 Docker 的 `*IT.java` 单独运行，不与本功能单测混跑。对 MySQL/SQLite 至少各执行一次迁移和 API 冒烟。

### 8.2 前端/扩展验证

- `node --check extension/content.js extension/background.js`；
- `node --check` 变更后的静态 JS；
- Web 9010/测试端口：时间编辑、详情导出、播放/下载、Range；
- Electron：桌面布局、数据目录、ffmpeg 路径、内置资源；
- 浏览器回退：授权、录制、上传和错误恢复；
- 改动静态资源后复制至 `backend/target/classes/static` 并 bump `index.html` cache-bust。

### 8.3 安全与清理验证

- 任意路径、`..`、符号链接和不允许扩展名；
- shell/ffmpeg 参数注入；
- 大文件/超时/并发；
- 删除级联和孤儿清理；
- 旧产物在新任务失败时仍可播放。

### 8.4 文档收口

每个阶段结束都要：

1. 更新本计划的完成状态与实际文件；
2. 更新主设计文档的变更记录/实现状态；
3. 追加当天 `docs/worklog/YYYY-MM-DD.md`；
4. 代码功能变更时同步 CHANGELOG；版本收尾时按规则同步 story；
5. 更新相关项目记忆正文、frontmatter description、`MEMORY.md` 索引三处。

## 9. 文件变更预览（用户确认后才执行）

### Phase 1 预计触及

```text
backend/src/main/java/com/videotagger/entity/Clip.java
backend/src/main/java/com/videotagger/service/SaveClipRequest.java
backend/src/main/java/com/videotagger/service/ClipService.java
backend/src/main/java/com/videotagger/controller/ClipController.java
backend/src/main/java/com/videotagger/...（导出配置、解析器、任务、Controller、响应 DTO）
backend/src/main/resources/db/migration/V20__clip_end_sec.sql
backend/src/main/resources/db/migration-sqlite/v02.sql
backend/src/main/resources/db/sqlite-schema.sql
backend/src/main/resources/application.yml
backend/src/main/resources/static/index.html
backend/src/main/resources/static/app.js
backend/src/main/resources/static/app.css
extension/content.js
extension/background.js
backend/src/test/java/...（新增/修改对应单测）
```

### Phase 2 预计追加

```text
backend/src/main/java/com/videotagger/...（连续截图与任务元数据）
backend/src/main/resources/db/migration/...（若确认新增产物表）
backend/src/main/resources/db/migration-sqlite/...（若确认新增产物表）
backend/src/main/resources/static/index.html
backend/src/main/resources/static/app.js
backend/src/main/resources/static/app.css
backend/src/test/java/...
```

### Phase 3 预计追加

```text
backend/src/main/java/com/videotagger/...（multipart 上传与产物访问）
backend/src/main/resources/application.yml
backend/src/main/resources/static/index.html
backend/src/main/resources/static/app.js
backend/src/main/resources/static/app.css
backend/src/test/java/...
```

以上是预计范围，不代表当前已经修改；实施过程中若发现新增/删除文件，必须先同步本计划或在阶段日志中说明。

## 10. 交付判定

只有同时满足以下条件才算 v0.19 阶段完成：

- 双库迁移和旧数据兼容测试通过；
- 本地精确视频、单帧截图、连续截图、浏览器回退按所属阶段通过；
- 任务取消/失败/超时不会破坏旧产物；
- 删除级联和路径安全验证通过；
- Web、Electron、扩展三端交互闭环通过；
- spec、plan、worklog、CHANGELOG/story（按适用范围）已同步；
- 用户完成验收。

## 11. 变更记录

| 日期 | 状态 | 变更 |
|---|---|---|
| 2026-08-24 | Phase 2/3 实现 | 连续截图、任务进度/取消、临时目录替换/孤儿清理、浏览器录制预览与 WEBM 上传已实现；离线编译/服务单测/Node 检查通过，真实视频、授权和 Electron 验收待执行。 |
