# v0.24 素材渠道化 + Animeko 互操作实施计划

- **日期**：2026-09-02
- **版本**：v0.24.0
- **状态**：G1 设计定稿；G2（M1）开始实施
- **主设计**：`docs/superpowers/specs/2026-09-02-video-tagger-v024-material-channel-design.md`

## 1. 实施目标

1. Animeko 观看事实（已看/播放位置）回流 video-tagger，成为打标与回顾的上下文。
2. Clip/素材模型承载"渠道线索"，素材化管线按 C1 本地池 → C2 Animeko → C3 网页直链 → C4 录屏 依次取源。
3. 播放前台移交 Animeko：v0.23 片源 UI 冻结并从主入口隐藏，引擎层复用；老数据不受影响。
4. 互操作侧只读 Animeko DB/定位其文件，契约驱动测试 + 一次人工校准；可选 fork CLI 作批量预取加速器。
5. 双库（MySQL/SQLite）同步演进，兼容既有 episode/clip/asset/秒级字段。

## 2. 执行原则

- 先契约与迁移，再服务与 UI；每个阶段先跑定向测试。
- Animeko 侧读取一律隔离 adapter，agent 自测走 fixture（隔离副本），不依赖真实 Animeko 常开。
- 导入不破坏既有数据：只新增 watched 时间等幂等字段；无映射的记录只计数上报不建档。
- 阶段顺序 M1（观看回灌）→ M3（素材化管线）→ M2（现场热键打标）；fork CLI 视需要插入。
- UI 沿用现有风格与规范；"打开原视频"重构前先确认入口使用面。

## 3. 阶段与门禁

### G1 文档与决策（✅ 本计划 + 主设计 = G1 完成）
- 唯一 v0.24 主设计/主计划落盘；ADR D1-D7 记录（见主设计 §2）。
- 版本决策：按 0.24 立项，0.23 已封存基线。

### G2 M1 Animeko 观看导入（观看回灌）

目标：Animeko `playback_history_record` 导入 → 本地 Episode 标记 `watched_at` → 提供状态/导入 API，可离线自测。

任务：
1. 迁移：MySQL `V28` + SQLite `v10`（main+test）为 `episode` 加 `watched_at`；`sqlite-schema.sql` 基线同步；`SqliteSchemaMigratorTest` 版本断言 9→10。
2. Entity/Mapper：`Episode.watchedAt`；`EpisodeMapper.markWatched(id, watchedAt)`。
3. 配置：`videotagger.animeko-db-path`（env `VT_ANIMEKO_DB`），缺省空=功能关闭。
4. Reader：只读 Animeko SQLite，取 `playback_history_record`（过滤 `deletedAtMillis`），字段=episodeId/subjectId/positionMillis/durationMillis/updatedAtMillis。
5. 匹配与写入：`external_work(provider='BANGUMI', external_id=subjectId)` → `external_episode(provider_episode_id=episodeId)` → `episode_id` 非空则 `markWatched(updatedAtMillis)`。计数 imported / noMapping / noEpisode / deleted，最新 N 条优先。
6. Controller：`GET /api/animeko/watch/status`（DB 可达 + 记录数预览）、`POST /api/animeko/watch/import`（返回汇总）。
7. 测试：临时 SQLite fixture（构造 playback_history 行 + 本地 external_work/episode 数据）覆盖 reader、匹配、幂等、deleted 过滤。
8. 契约校准（需用户一次）：真实 Animeko 放一集→暂停→dump 比对 → 锁定字段契约。

门禁：定向 Maven 测试通过 + 隔离副本导入与真实 DB 只读启动验证；UI（最近观看展示/导入按钮）留待 G4 统一做或本阶段最小入口。

### G3 M3 素材化管线渠道化

目标：素材化从"单一本地路径"抽成 C1→C4 渠道链；Clip 增加渠道线索字段。

任务：
1. 迁移：Clip/素材引用增加渠道线索字段（`channel_hints` JSON 或分列），M2 打标写入渠道线索。
2. 管线重构：`MaterializationService` 按 C1(指纹) → C2(Animeko registry/文件定位) → C3(受控下载任务) → C4(录屏) 求值；产物落 `clip-videos/images`，失败只标记缺素材。
3. C2 定位器：读 Animeko 缓存 registry（episodeId→本地文件），文件缺失返回待预取提示。
4. "打开原视频"重构为本地区间回顾播放（文件在场），缺文件回退原网页。
门禁：渠道链定向测试 + 真实本地文件端到端裁剪（data/ 真实视频）。

### G4 M2 现场热键打标（Animeko 前台暂停 → 打标浮层）

目标：video-tagger 桌面壳全局热键 → 读 Animeko playhead → 建标签/片段（带 C2 渠道线索），文件在场当场剪。

任务：
1. Desktop 壳：全局热键注册 + 浮层窗口（Electron）；热键处理器读 playhead（300~500ms 补偿/双读取 updatedAt 大者）。
2. 打标提交 API：携带 episodeId/position/duration 与媒体映射 → 建 Clip（复用保存链路）+ 渠道线索。
3. 场外映射缺失（Animeko 看过但 video-tagger 无 MediaEntry/Episode）：返回建档引导（复用同步中心）。
门禁：模拟 playhead fixture 全自动 + 一次人工校准（真实暂停打标剧本）。

### G5 Animeko fork CLI（可选加速器）

任务：`--test-task batch-cache --subject <bangumiId> --eps <csv>`，进程内 `EpisodeCacheRequester.request(...)`（显式缓存 autoCached=false），全部落盘退出。骨架见附录。
门禁：本机真实 Animeko 播放集后跑 CLI → 缓存目录出现该集文件。

### G6 收尾
- v0.23 播放/片源 UI 从主入口隐藏（功能开关），引擎保留；验收稳定后按模块清理。
- CHANGELOG 0.24.0、story 叙事、worklog、rules 无冲突项复查。
- 端到端门禁：资料同步后复测 + agent-browser CDP 重验后的 Web/Electron 黄金路径。

## 4. 测试基建（先行）

1. **agent-browser CDP 重验**：本机 Chrome CDP 能否自启（worklog 记过失败）；不行则记录修复或改用手动浏览器验收。
2. **Animeko fixture 生成**：脚本拷贝真实 DB 隔离副本（db + -wal）到测试用路径 + 造缓存 registry 行；迁移测试沿用既有"隔离副本启动"手法。
3. **人工校准剧本**：放一集（少女与战车 第2集等已知用例）→ 播放≥5s → 暂停 → dump `playback_history_record` → 与 adapter 读取比对。

## 5. 附录：Animeko fork CLI 骨架（参考，暂不入代码库）

```
TestTasks.handleTestTask 增加分支 "batch-cache":
  args: --subject 40310 --eps 2,3,5
  1. koin 取 EpisodeCacheRequester + EpisodeListFetcher(bangumi)
  2. for ep in eps:
       subjectInfo/episodeInfo = bangumi 查询
       requester.request(EpisodeCacheRequest(subjectInfo, episodeInfo))
       等待 stage == Done（显式缓存 autoCached=false，文件落 MediaCacheStorage）
  3. 打印结果 json，exitProcess(0)
注意：运行期间勿并行 BT 播放；视频文件存 cache 目录，episodeId 映射由 Animeko registry 持有
```
