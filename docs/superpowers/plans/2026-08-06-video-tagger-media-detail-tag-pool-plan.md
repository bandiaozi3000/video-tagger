# 详情页标签池实施计划（媒体/集/片段，v0.11）

> spec：`specs/2026-08-06-video-tagger-media-detail-tag-pool-design.md`
> 媒体拍板：三级聚合 / 替换标签区 / 分级配色；集拍板：集内聚合；片段拍板：作品内热度

## P0 媒体详情页标签池（已完成）

- [x] 确认 `GET /api/tags/manage?mediaId&page=1&size=1000` 返回 TagUsage(refCount=三级聚合)
- [x] 确认 `MediaDetail.tags` 为作品级标签（含 id，可删）
- [x] `renderDetailTags` 改 async：拉聚合 + 合并作品级 `d.tags` + `tagStatTier` 分档 + `tag-pool-chip` 渲染（count 降序 + ×N 徽标 + 可删 ×），保留添加输入框，失败兜底
- [x] `.tag-pool-chip` 五档配色（灰/紫/粉/橙/金，字号光晕递增）

## P1 后端：集内聚合接口

- [x] `TagMapper.countByEpisode(episodeId)`：episode_tag ∪ 该集下 clip_tag UNION 聚合（refCount=集内引用总数）
- [x] `TagAdminService.episodeStats(episodeId)` → `List<TagUsage>`
- [x] `TagController` `GET /api/tags/episode-stats?episodeId=`
- [x] 单测：`TagAdminServiceTest.episodeStatsDelegatesToMapper` + `TagControllerTest.episodeStatsReturnsAggregatedTags`（全量 100 例绿）

## P2 前端：集详情页标签池

- [x] `renderEpisodeDetailTags` 改 async：拉 episode-stats + 合并 `ep.tags`（集标签可删 ×）+ 分档渲染 + 保留添加 + 兜底
- [x] index.html 标题「集标签」→「集标签池」

## P3 前端：片段详情页标签池

- [x] index.html 片段详情页新增「片段标签」区（`#clip-detail-tags`）
- [x] `renderClipTags(clip, mediaId)`：clip.tag 拆词 + manage?mediaId 作品内热度 + 分档渲染（count>0 带徽标，0 灰档），纯展示
- [x] `renderClipDetailHead` 接入调用

## P4 验证 + 收尾

- [x] `node --check`；id 交叉检查；`mvn process-resources` 同步 target
- [x] 全量非 IT 单测 100 例绿；CHANGELOG/worklog 记录
- [ ] 待用户：`docker compose build app` 重建 + Ctrl+F5 实测（媒体/集/片段三处分级配色、次数、删除、添加）
