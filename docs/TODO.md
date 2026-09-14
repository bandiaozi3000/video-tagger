# 待办清单

> 记录方式：**是否记录 / 更新由用户人工告知**，AI 不主动维护。

## 待办（2026-08-03 晚记录）

- [ ] **验证 0.45 阈值修复**：IDEA 重启 Spring Boot → 浏览器搜乱码 `zxcvbnmasdfghjkl` 应返回**空**（修复前返回 3 条无关片段，匹配分 0.02）。代码已编译未生效，背景见 `docs/worklog/2026-08-03.md`。
- [ ] **近义检索（高燃/热血）**：方案 A 检查向量覆盖缺口（当前仅 6 条向量）；方案 B 标签规范化（LLM 归组扩到标签层，治「高然/高燃」分裂）再议。

## 片段自动录屏/截取导出视频（v0.19 候选，2026-08-10 存档）

**场景**：片段有起止时间，希望自动「录屏」并存储到系统。可行性已确认，方案已拍板，暂存待做。

**已拍板决策**：
- **两条链路都要**：本地文件 → ffmpeg 截取；无本地文件 → 浏览器录屏回退。
- **加 `end_sec` 字段**（V17 迁移，clip 表加 `end_sec DOUBLE NULL`，null 兜底 = `videoDuration`）；打标签支持起止录入，旧数据不破坏。
- **本地视频库目录**：约定如 `data/videos/`，按 `videoFp` 指纹定位源文件（用户把视频放入/映射该目录）。
- **截屏（补充确认）**：形态**两者都要**（单帧 = 起止中点/指定时刻一张；区间连截 = 每秒 1 帧成组）；用途 = **独立图片产物**存 `data/clip-images/`，可下载/查看，不动封面。

**实现计划**（4 阶段）：
1. **数据模型**：V17 迁移 + Clip entity/DTO/请求加 `endSec`。
2. **本地产出**（`ClipVideoService`，ffmpeg）：
   - 视频：`POST /api/clips/{id}/export-video`，`-ss start -to end -c copy` 剪出 `data/clip-videos/{id}.mp4`。
   - 截屏：`POST /api/clips/{id}/export-images`——单帧 `-ss 中点 -frames:v 1` + 区间连截 `-vf fps=1`，存 `data/clip-images/{id}_*.jpg`。
3. **在线录屏/截屏回退**：前端 `getDisplayMedia` + `MediaRecorder`（录屏）+ 流帧快照（截屏），打开 clip.url → 用户跳 start → 定时录到 end → webm/图片上传后端存 `data/clip-videos|images/`。
4. **前端 UI**：片段列表/详情加「导出视频」「截屏」按钮，产物可播放/下载；打标签弹层支持起止。

**关键点**：视频库目录约定是阶段 2 的前提（`data/videos/` 按 videoFp 定位）；录屏受浏览器实时录制限制（精度/质量，跨域无法自动跳转需用户手动）；后端需 ffmpeg 路径（参考推荐导出 BGM）。

## 推荐草稿自动保存 + 模板复用 + 工具箱布局（2026-08-10 确认，暂不开工）

**需求**（grill 确认 + 用户拍板）：
1. **推荐草稿自动保存**：推荐向导全部配置（勾选媒体 + 文案 + 分组/排序 + 三滑块 + 时长 + 背景）改动**自动存后端草稿**（防抖），刷新/重开**自动恢复**，不用重新配。
2. **推荐模板复用**：从当前配置**另存为命名模板**，模板**列表/载入/删除**，下次做推荐直接载入复用。
3. **工具区布局**：导出任务 / 草稿 / 模板收进**一个「工具箱」按钮**（点开下拉/面板看全部）——防后续相关功能多占 tab。

**已拍板**：草稿+模板**都存后端**（数据库新表）；草稿**自动保存**；模板**完整管理**（命名/列表/载入/删除）；**工具箱点开**布局；**草稿含 BGM、模板不含 BGM**（BGM base64 大，模板不该背上）。

**实现方向**：后端 V18 迁移 `recommend_draft`（单条）/`recommend_template`（多模板）表 + API（GET/PUT draft、templates CRUD，config 存 JSON）；前端配置收集/还原 + 防抖自动存草稿 + 加载恢复 + 模板管理 UI + 工具箱收纳。

**状态**：需求完整确认，**暂不开工**（用户「先不改」），存档待做。规则：需求变动后须先确认「是否开工」才动手（见记忆 confirm-before-start-on-change）。

## 桌面版：SQLite schema 版本迁移机制 + 在线更新（2026-08-16 记录，方案已出待拍板）

**背景**：桌面版（SQLite）把 Flyway 关了（`flyway.enabled: false`），靠 `spring.sql.init` 每次启动跑 `sqlite-schema.sql`（16 表全 `CREATE TABLE IF NOT EXISTS`，无版本跟踪、无 ALTER 迁移）。→ **新增表能靠打新包自动生效，但已有表加列/改列/数据迁移打新包无效**（IF NOT EXISTS 对已存在表整体跳过），且用户 SQLite 库在各自机器 `data/`，只能靠程序内迁移代码去 ALTER。

- [x] **补 SQLite schema 版本迁移**（✅ 已交付 2026-08-16，commit `9ce7eae`）：`SqliteSchemaMigrator` 用 SQLite 内建 `PRAGMA user_version` 存版本号；启动时读版本，0（全新库/首次部署）直接初始化为最新，0<当前<最新 按序执行 `db/migration-sqlite/vNN.sql`（纯 ALTER，ScriptUtils 逐条），每步递增；最新版本 = max(基线 v1, 目录最大 vNN)。以后每次改表结构 = 加 vNN.sql，不再动 sqlite-schema.sql 已有表定义。单测 5 项全过。**配套约定见 `db/migration-sqlite/README.md`**。
- [ ] **在线更新**：✅ **客户端 + 发布脚本已交付**（2026-08-16，commit `1fae834`）——`desktop/update.js`（清单拉取/下载+SHA 校验/pending 标记/应用替换/回滚）+ `main.js` 集成（boot 应用更新+失败回滚、窗口后检查）+ `desktop/publish.bat`（生成 latest.json）。**剩余**：① 配置托管并填 `desktop/package.json` 的 `updateUrl`（现空=功能关，详见记忆 desktop-online-update）；② 上传 jar+latest.json 到托管；③ 配好后重打包分发（让现有用户装上更新功能）。更新只替换 backend.jar，jre/node/ffmpeg 不动；升级改表结构须配套先发 vNN.sql（见上方 schema 迁移项）。

**背景文档**：2026-08-16 工作日志（docs/worklog/2026-08-16.md）。

## Remotion 多媒体混合推荐 POC（2026-09-14 记录）

**结论**：POC 已验收通过，Remotion 路线可行。**生产接线需用户单独授权后才能开工。**

**已交付**：`backend/remotion/`（场景计划纯函数 + 4 项单测、四类场景 Composition、Player 页面、Node renderer）；未提交的真实样本与成片在 `backend/remotion/poc/output/`（已 gitignore）。证据见 `docs/worklog/2026-09-14.md` 与 `docs/superpowers/specs/2026-09-14-video-tagger-remotion-multi-media-recommend-poc-design.md` §11。

### 待用户决定

- [ ] **是否进入生产接线**（1A 入口：推荐向导新增模板选项；2C 复用 `ids + mediaClips` 选择；导出/草稿/异步任务接线）。未授权前不动旧模板与 `RecommendVideoService`。
- [ ] **版本归属**：Remotion 生产接线属大改动，届时需拍板是否升版本（当前 POC 未升版、未进 CHANGELOG 功能节）。

### 待补齐验证（POC 遗留）

- [ ] **真实渲染补“同一媒体 2 个 Clip”分支**：8080 真实库中同一媒体只有 1 段可复用短素材，本次未伪造 Clip，该分支仅由单测覆盖。需指定一部具备 2+1 段可复用素材的媒体后补一次真实渲染。
- [ ] **Chrome Headless Shell 体积评估**：Remotion 首次渲染自动下载到 `backend/remotion/node_modules/.remotion`，实测**约 521MB**。需评估桌面打包与在线更新策略（更新只换 backend.jar，不含 node/浏览器资源）。
- [ ] **未验证能力**：BGM、1080P/4K、Electron 打包黄金路径、`calculateMetadata` 与 Player 输入不一致时的行为。
- [ ] **性能对比**：POC 冷 168.5s / 热 106.9s（27 秒成片、concurrency=1），尚未与现有 FFmpeg 链路做同条件对比，不能先下“更快”结论。
- [ ] **低优先**：两次渲染均出现 `webpack.cache.PackFileCacheStrategy: Caching failed for pack` 告警，暂判无害，未深挖。

## 媒体彻底删除/合并遗留 media_entry 孤儿行（2026-09-14 读码确认，待修复）

- [ ] **修复 + 双库迁移清理**：`MediaService` 全文无 `media_entry` 引用，`MediaEntryMapper` 也没有按媒体删除的方法 → `purge(mediaId)` 与 `merge(fromId, intoId)` 都不会删除该媒体的 `media_entry` 行，且 `merge` 后旧 `media_entry`（`media_id = fromId`）同样遗留。
- **严重度**：🟨 轻微（`ensureEntry` 按 `media_id` 查，孤儿行不影响功能；但会随删除持续累积，并留下指向已删媒体的 `external_work.media_entry_id` 历史痕迹）。
- **待验证**：上述结论来自读码，**尚未查库确认**实际孤儿数量；修复前建议先跑一次只读统计确认影响面。
- **背景**：本次回收站释放 Bangumi 关联的清理链路（`docs/worklog/2026-09-14.md`）。
