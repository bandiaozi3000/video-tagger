# Video Tagger 帧封面设计总结（片段截帧 + 集自选高能画面 + 番剧兜底）

- 日期：2026-08-03
- 状态：grilling 确认，待实施（分两期）
- 关联文档：实施计划 `plans/2026-08-03-video-tagger-frame-cover-phase1~2-plan.md`
- 前情：v0.3 遗留待办「帧截图辅助记忆（远期可选）」本次兑现。

## 1. 背景与定位

v0.3 番剧三层打标已让番剧有封面（og:image），但**集与片段仍是纯文字行/卡片**，列表里靠标题与标签辨认，辨识度低。本次为每集与每个片段补封面：

- **片段封面** = 扩展截取当前视频帧（用户按下 Alt+S 的那一帧，天然是「值得回看的画面」）。
- **集封面** = 从该集已有片段帧里**自选高能画面**（用户自己打过标的那一帧），无片段时手动上传兜底；未选时**智能默认**为该集被标记最多的片段帧。
- **番剧封面兜底** = 无 og:image 的番剧，用其下被标记最多/最近的片段帧自动兜底。

定位延续「工具 + 练手」：封面纯展示、绝不进入向量化/搜索（图片 RAG 是另一大工程，YAGNI）。

## 2. 已确认决策（grilling 拍板）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 截帧时刻 | **时间戳同源**：普通模式 Alt+S 按下时、连续模式每次保存时、快存按键时——读 `currentTime` 的同一瞬间截帧，帧与时间戳严格对齐。 |
| 2 | 传输方式 | **base64 内嵌**保存请求（`coverDataUrl` 字段），单请求原子保存，封面与片段永不分离；体积 +33%（~30KB→40KB），个人工具可接受。 |
| 3 | 集封面来源 | **从该集片段帧自选 + 手动上传兜底**；详情页点选一条截帧即设为集封面，零重复截图。 |
| 4 | 深挖范围 | **全做**：番剧兜底 + 集封面智能默认 + 搜索/时间线/相似卡片缩略图。 |
| 5 | 缩略图规格 | 降采样 320px 宽 + JPEG 0.7 ≈ 20–40KB；try/catch 降级无封面，不阻塞保存主链路（秒级原则）。 |
| 6 | 存储 | `data/covers/clip/{clipId}.jpg`、`data/covers/ep/{epId}-{ver}.jpg`（集封面可替换，文件名带版本戳防缓存旧图）；番剧封面维持 `{animeId}.{ext}`。 |
| 7 | schema | Flyway **V6**：`episode.cover_path`、`clips.cover_path` 可空列。 |
| 8 | 生命周期 | 删片段/集/番剧时**级联删除封面文件**（顺手补番剧封面删除遗漏）。 |

## 3. 数据模型变更

```sql
-- V6__frame_cover.sql
ALTER TABLE episode ADD COLUMN cover_path VARCHAR(512) NULL;
ALTER TABLE clips   ADD COLUMN cover_path VARCHAR(512) NULL;
```

- `clips.cover_path`：扩展截帧落盘后的静态路径。
- `episode.cover_path`：用户自选/上传的集封面（**显式覆盖**）；为空时查询端解析到「智能默认」。
- 番剧兜底**不落库**：`anime.cover_path` 仍为空即走运行时解析，避免冗余写。

## 4. 封面解析规则（智能兜底）

「代表性片段」统一 = **该集/该番剧下被 clip_tag 标记次数最多的片段，平分按 created_at 最新**。

```
effectiveCover(episode)  = episode.cover_path ?? representativeClipCover(episode)
effectiveCover(anime)    = anime.cover_path   ?? representativeClipCover(anime)
```

- 集：`EpisodeDetail.coverPath` 为解析后的有效值；搜索结果的集卡片同样解析。
- 番剧：`AnimeSummary` 增 `fallbackCoverPath`，前端取 `coverPath || fallbackCoverPath`；`AnimeDetail` 在服务端解析。
- 实现用 MySQL 标量子查询（兼容，可读），不做窗口函数。

## 5. API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/episodes/{id}/cover` | multipart 上传集封面（兜底） |
| POST | `/api/episodes/{id}/cover-from-clip/{clipId}` | 复制片段封面字节为集封面（自选高能画面） |

保存链路无需新端点：`POST /api/clips` 的 `coverDataUrl`（base64）随保存落片段封面。

## 6. 风险与注意点

1. **CORS/DRM 截帧失败**：跨源直链视频无 CORS 头 → `canvas.toBlob/toDataURL` 抛 `SecurityError`；DRM 流可能黑帧。→ 扩展端 try/catch 返回 null，降级无封面，不影响保存。
2. **payload 上限**：`coverDataUrl` 校验 `@Size(max=300000)`（base64 约 40KB，留余量防畸形请求）。
3. **路径安全**：`deleteCover` 解析 `/covers/**` 路径时防目录穿越（只允许 coverDir 内相对路径）。
4. **base64 解码失败**：服务端解码/落盘失败一律降级为无封面，不反噬保存事务。
5. **集封面缓存**：`ep/{epId}-{ver}.jpg` 版本戳 = 写入时间戳；替换时清理旧文件。
6. **级联清理**：删片段删其 cover 文件；删番剧删动漫/集/片段所有 cover 文件（现 AnimeService.delete 只删库，本次补文件）。
7. **内容安全**：`all_frames:false` 拿不到 iframe 嵌套播放器的 video——与现有 grab 同一限制，非新问题。

## 7. 范围界定（YAGNI）

本期不做：图片向量化/以图搜图、多尺寸图（缩略图 320px 单规格足够卡片辨识）、帧级 OCR/场景检测、图片云存储。

## 8. 分两期规划

- **Phase 1 · 片段封面**：V6 + 实体 + CoverService 重构 + 保存链路落封面 + 扩展截帧/传输 + 前端片段卡片缩略图。
- **Phase 2 · 集/番剧封面**：集封面自选/上传/智能默认 + 番剧兜底 + 级联删封面文件 + 前端集行封面与选封面弹层。
