# v0.19 片段视频与截图导出设计

- **日期**：2026-08-24
- **版本范围**：v0.19.0～v0.19.2
- **状态**：Phase 1/2/3 已实现，待真实视频、浏览器录制授权与 Electron 人工验收
- **主文档约定**：本文件是 v0.19 的唯一主需求/设计文档。后续 v0.19 需求变更、新增、方案调整和实现状态均直接更新本文件，并在变更记录中追加；不得为同一大版本创建互不关联的需求主文档。
- **关联执行计划**：`docs/superpowers/plans/2026-08-24-video-tagger-v019-clip-export-plan.md`

## 1. 背景与目标

当前片段模型只有瞬时标记：

```text
url + timestampSec + videoDuration + tag/note + cover
```

用户可以回到原网页，但不能把“某个时间区间”保存成独立视频或图片产物。v0.19 为片段补齐起止区间，并提供本地导出与浏览器回退，使链路变为：

```text
记录起止时间 → 定位本地源视频 → ffmpeg 精确导出
                         ↘ 找不到 → 浏览器实时录制回退
                  → 单帧/连续截图 → 查看、下载、清理
```

目标不是替代完整视频库，而是把已标记的高价值片段变成可独立保存和复用的素材。

## 2. 已确认决策

以下决策已由用户确认，实施时不再重新拍板：

1. **分阶段交付**：v0.19.0 先做数据模型、本地视频导出和单帧截图；v0.19.1 做连续截图与任务体验；v0.19.2 做浏览器录屏回退。
2. **本地导出默认精确模式**：重新编码，优先保证起止时间准确；不以 `-c copy` 快速切割作为默认。
3. **本地源视频按指纹命名**：`data/videos/{videoFp}.扩展名`；后端不接受任意客户端本地路径。
4. **默认最大导出时长 30 分钟**：配置化，防止误导出整部视频、无限录制或占满磁盘。
5. **重复导出覆盖旧产物**：同一片段、同一产物类型只保留最新版本；新任务失败时保留旧成功产物。
6. **无结束时间时允许手动停止**：兼容历史片段和浏览器录屏；本地 ffmpeg 仍须有可确定的结束时间。
7. **截图两种形态都做**：单帧截图 + 区间连续截图。
8. **新增 `endSec`**：现有 `timestampSec` 为开始时间；旧数据不强行回填，空值按兼容规则处理。
9. **本地链路优先，浏览器链路回退**：浏览器录屏须明确告知实时录制的精度、权限和画面限制。

## 3. 范围与非目标

### 3.1 v0.19 范围

- 片段开始/结束时间的保存、编辑、校验和展示；
- 本地视频库目录配置与 `videoFp` 文件定位；
- ffmpeg 精确模式导出 MP4；
- 单帧 JPEG 截图；
- 每秒（及后续可选间隔）连续截图；
- 片段导出产物的查看、播放、下载、覆盖和删除；
- 找不到本地源视频时的浏览器 `getDisplayMedia` / `MediaRecorder` 回退；
- 导出任务状态、失败反馈、超时和取消；
- MySQL 与 SQLite schema 迁移；
- 删除片段/集/媒体时清理导出产物。

### 3.2 非目标

- 不建立完整的视频资产索引系统；
- 不允许 API 接收任意本地路径并读取；
- 不默认实现多个导出版本的历史管理；
- 不把浏览器录屏结果声称为帧级精确剪辑；
- 不在 v0.19 首期做远程/局域网视频库；
- 不改变现有封面语义：导出截图是独立产物，不覆盖片段封面；
- 不因为本功能自动升桌面版版本号或产品大版本号，版本决策遵循项目既有规则。

## 4. 数据模型

### 4.1 Clip 字段

现有字段保持兼容：

```text
clips.timestamp_sec   → 开始时间（秒）
clips.video_duration   → 原视频总时长（秒，可空）
```

新增：

```text
clips.end_sec          → 结束时间（秒，可空）
```

Java 映射：

```java
private Double timestampSec;
private Double endSec;
private Double videoDuration;
```

请求 DTO `SaveClipRequest` 同步增加 `Double endSec`。旧扩展、旧前端和历史请求不带该字段时必须仍能保存。

### 4.2 时间语义与兼容规则

- `timestampSec >= 0`；
- `endSec == null`：表示旧式瞬时标记，或用户尚未录入终点；
- `endSec != null` 时必须满足 `endSec > timestampSec`；
- `videoDuration != null` 时，`timestampSec <= videoDuration`；
- `endSec != null` 时，`endSec <= videoDuration`；
- 为兼容旧片段，导出时的有效结束时间按以下顺序计算：
  1. `endSec`；
  2. `videoDuration`；
  3. 无法确定，返回可理解的业务错误（不猜测、不默认整部视频）。
- 单帧截图在没有结束时间时仍可使用 `timestampSec`；
- 浏览器录屏在没有结束时间时允许用户手动停止；
- 连续截图必须有结束时间，或进入“手动停止”模式。

### 4.3 数据库迁移

当前 MySQL 迁移链已到 V19，不能沿用旧 TODO 中的 V17 编号：

- MySQL：新增 `V20__clip_end_sec.sql`，`ALTER TABLE clips ADD COLUMN end_sec DOUBLE NULL`；
- SQLite：新增 `db/migration-sqlite/v02.sql`，`ALTER TABLE clips ADD COLUMN end_sec REAL`；
- `db/sqlite-schema.sql` 的新库基线同步包含 `end_sec`；
- 老数据全部保持 `NULL`；不进行不可逆的结束时间回填；
- SQLite 迁移按现有 `PRAGMA user_version` 机制顺序执行。

如采用导出产物元数据表，新增 `clip_export` 表必须在本文件和对应迁移中同步登记；v0.19.0 优先可用固定目录与文件名实现，避免无必要扩大 schema。

## 5. 本地视频库

### 5.1 目录配置

```yaml
videotagger:
  clip-export:
    video-dir: ${VIDEO_LIBRARY_DIR:${VT_DATA_DIR:data}/videos}
    max-duration-sec: ${CLIP_EXPORT_MAX_DURATION_SEC:1800}
```

默认目录为 `${VT_DATA_DIR}/videos`，桌面版随数据目录移动；Web/本地运行也可通过环境变量覆盖。

### 5.2 文件命名与定位

支持的源视频扩展名首期为：

```text
mp4 / mkv / webm / mov / avi / flv
```

定位规则：

```text
{video-dir}/{videoFp}.{extension}
```

首期只扫描视频库根目录，不递归扫描。过滤规则：

- 文件名 stem 必须精确等于 `videoFp`；
- 扩展名必须在允许列表；
- 解析后的路径必须仍位于配置的视频库目录内；
- 同一指纹匹配多个文件时返回“源文件冲突”，不自行猜选；
- 不接受请求体传入任意 `sourcePath`。

后续如需递归扫描、目录索引或 UI 选择目录，另在 v0.19 主文档中追加变更，不另起版本需求文档。

## 6. 视频导出

### 6.1 精确模式

v0.19 默认重新编码，示意命令：

```bash
ffmpeg -ss START -i INPUT -t DURATION \
  -c:v libx264 -preset fast -crf 20 \
  -c:a aac -movflags +faststart OUTPUT.mp4
```

实际实现必须对路径使用 `ProcessBuilder` 参数数组，不能拼接 shell 命令。`DURATION = END - START`。

`-c copy` 快速模式暂不作为默认 UI 能力；如果后续提供，必须明确标注可能存在关键帧偏移。

### 6.2 产物路径

```text
data/clip-videos/{clipId}.mp4
```

使用 `{clipId}.mp4.part` 等临时文件，ffmpeg 成功、文件非空并通过基本校验后，再原子替换正式文件。重复成功导出覆盖旧产物，失败不破坏旧产物。

### 6.3 限制

- 默认单次导出最长 1800 秒；
- 起止时间无法确定时拒绝本地导出；
- ffmpeg 不存在、输入冲突、超时、非零退出码、空文件、磁盘不足均返回明确错误；
- 建议使用异步任务，避免 HTTP 请求被长时间阻塞；
- 任务状态：`PENDING / RUNNING / SUCCEEDED / FAILED / CANCELLED`。

## 7. 截图导出

### 7.1 单帧

- 默认位置：`(start + end) / 2`；没有 end 时使用 start；
- UI 可选：开始、中点、结束、自定义时间；
- 输出：`data/clip-images/{clipId}/single.jpg`；
- JPEG，质量建议 85；
- 单帧截图不修改任何封面字段。

### 7.2 连续截图

- 默认每 1 秒 1 帧；
- 实现可提供每 1/2/5 秒一帧；
- 输出：`data/clip-images/{clipId}/frame-0001.jpg` 等；
- 默认最多 300 张，超出时要求降低频率或缩短区间；
- 需要确定结束时间；无结束时间时只能进入用户手动停止的浏览器模式；
- 重复导出同类型连续截图覆盖该片段目录，任务失败保留旧目录。

## 8. 浏览器录屏回退

### 8.1 触发条件

片段详情发起导出时，后端先检查本地视频库：

- 找到唯一源文件 → 走本地 ffmpeg；
- 找不到 → 提供“浏览器录制回退”；
- 多个匹配 → 先提示冲突，也可由用户选择暂时走浏览器回退。

### 8.2 交互状态

```text
检测源文件 → 打开原视频 → 用户确认起点 → 授权 getDisplayMedia
→ 3 秒倒计时 → MediaRecorder 录制
→ 到达结束时间或用户手动停止 → 录制预览
→ 重新录制 / 上传保存
```

必须告知：

- 需要选择正在播放原视频的标签页或窗口；
- 录制可能包含播放器 UI、弹幕、广告或浏览器声音；
- 跨域页面不能保证自动 seek；
- 不切换标签页可减少录制中断；
- 浏览器录制存在少量时间误差，不等同于本地精确截取。

### 8.3 格式

前端按能力检测优先使用：

```text
video/webm;codecs=vp9,opus
video/webm;codecs=vp8,opus
video/webm
```

不假定浏览器能直接录 MP4。回退产物首期保存 WEBM；如要转 MP4，交给后端 ffmpeg 作为后续增强。

无 `endSec` 时允许“手动停止”，并在产物元信息中标记为浏览器回退/手动结束。

## 9. API 设计

### 9.1 现有片段接口扩展

```text
POST /api/clips
PUT  /api/clips/{id}
```

请求增加：

```json
{
  "timestampSec": 120.5,
  "endSec": 148.0
}
```

不带 `endSec` 的旧请求行为不变。

### 9.2 导出任务

```text
POST /api/clips/{id}/export-video
GET  /api/clips/export-tasks/{taskId}
POST /api/clips/{id}/export-images
```

建议导出请求：

```json
{"mode":"local","format":"mp4","quality":"precise"}
```

截图请求：

```json
{"mode":"single","at":"middle"}
```

或：

```json
{"mode":"sequence","intervalSec":1}
```

长任务返回 `{taskId,status}`，不让 HTTP 请求同步等待 ffmpeg。

### 9.3 产物查询/访问

```text
GET    /api/clips/{id}/exports
GET    /api/clips/{id}/exports/{artifact}
DELETE /api/clips/{id}/exports/{artifact}
```

视频访问需支持 Range，供详情页 `<video controls>` 拖动播放。服务端只根据 clip id 和白名单产物类型生成路径，不接受任意路径参数。

### 9.4 浏览器上传

```text
POST /api/clips/{id}/exports/video   multipart/form-data
POST /api/clips/{id}/exports/images  multipart/form-data
```

视频不使用 base64 JSON 上传；必须限制 MIME、扩展名、单文件大小和总请求大小，临时文件校验后再替换正式产物。

## 10. 前端设计

遵循现有毛玻璃、深色霓虹和统一弹层规范，不使用原生 `prompt/confirm/alert`。

### 10.1 扩展打标浮层

当前单一时间戳改为：

```text
开始 02:00    结束 02:28
```

- 开始默认当前播放时间；
- 结束默认空；
- 提供“以当前时间设为结束”；
- 显示 `mm:ss`，传输浮点秒；
- 非法区间在浮层内即时提示；
- 连续打标中开始时间继续跟随播放，用户手填的结束时间不被定时器覆盖；
- 结束为空时保持旧式瞬时标记兼容。

### 10.2 Web 编辑

片段编辑弹窗同步增加结束时间字段，允许修正历史数据；搜索卡片/时间线对有区间的片段显示 `start – end`，旧数据只显示 start。

### 10.3 片段详情

新增“片段产出”区域：

```text
片段区间：02:00 – 02:28
[导出视频] [截图] [查看产物]
```

已有产物展示：格式、大小、时长、生成时间；支持播放、下载、删除。第一阶段不把导出按钮铺满搜索列表。

## 11. 文件生命周期与安全

删除片段时清理：

```text
clips / clip_tag / embedding task/vector
片段缩略图 / 详情封面
clip-videos/{id}.*
clip-images/{id}/
```

删除集或媒体导致片段级联删除时同样清理。导出采用临时文件 + 成功后替换；旧成功产物在新任务成功前始终保留。

必须防护：

- 路径穿越；
- 任意文件读取/覆盖；
- 非白名单扩展名；
- 超大 multipart 请求；
- 任意 ffmpeg 参数注入；
- 任务重复提交造成进程/磁盘失控；
- 片段已删除但任务仍写入产物。

建议应用启动后异步清理孤儿文件，但不能阻塞启动。

## 12. 错误与反馈

至少区分：

```text
找不到源视频
源文件冲突
ffmpeg 不存在/不可执行
格式不支持
时间区间非法
超过 30 分钟
超过截图数量上限
导出超时
磁盘空间不足
权限被拒绝
浏览器录制格式不支持
上传失败
产物损坏
片段不存在
```

不使用含糊的统一“导出失败”。

## 13. 版本阶段交付

### v0.19.0

- `endSec` 与双库迁移；
- 扩展/Web 时间编辑与校验；
- 本地视频目录和指纹定位；
- ffmpeg 精确 MP4；
- 单帧 JPEG；
- 详情查看、播放、下载、删除；
- 基础任务/错误处理与测试。

### v0.19.1

- 连续截图；
- 1/2/5 秒间隔；
- 300 张上限；
- 异步任务进度、取消、重复任务处理；
- 产物列表元数据和生命周期增强；
- Range 播放、磁盘与孤儿清理增强。

### v0.19.2

- `getDisplayMedia` + `MediaRecorder`；
- 录制预览、重新录制、手动停止；
- WEBM multipart 上传；
- 权限/标签页选择/误差提示；
- Web 与 Electron 两种布局验证。

## 14. 验收标准

### 数据与兼容

- 新库拥有 `end_sec`；老 MySQL/SQLite 库启动后自动迁移；
- 不带 endSec 的旧扩展仍可保存；
- 有效区间可保存、编辑、查询；非法区间被前后端双重拒绝。

### 本地导出

- 唯一指纹源文件可导出精确 MP4；
- 起止时间和输出时长符合预期；
- 找不到、冲突、超时、ffmpeg 失败均有明确反馈；
- 重复导出覆盖成功，失败不损坏旧产物。

### 截图

- 单帧默认中点/无 end 用 start；
- 连续截图按间隔生成且不超过上限；
- 产物可查看、下载、删除，不影响封面。

### 回退录制

- 用户可授权标签页并完成 WEBM 录制；
- 无 end 可手动停止；
- 权限拒绝、格式不支持、上传失败均能回到可操作状态。

### 生命周期与安全

- 删除片段/集/媒体不会留下对应导出产物；
- 不能通过 API 读取数据目录外文件；
- 不能通过参数注入 shell/ffmpeg；
- 长任务不阻塞主请求，应用重启后的任务状态有明确处理策略。

## 15. 变更记录

| 日期 | 状态 | 变更 |
|---|---|---|
| 2026-08-24 | Phase 2/3 实现 | 完成连续截图（1/2/5 秒、300 张上限、进度、取消、临时目录替换、孤儿清理）、产物元数据与集/媒体级联清理；完成 `getDisplayMedia`/`MediaRecorder` 回退、预览/重录、自动或手动停止、WEBM multipart 上传、EBML/MIME/大小校验及来源持久化。真实授权和 Electron 实机验收待执行。 |

> 本文后续所有 v0.19 需求变更、新增和实现状态都在此表追加，并同步执行计划、工作日志和必要的项目记忆。
