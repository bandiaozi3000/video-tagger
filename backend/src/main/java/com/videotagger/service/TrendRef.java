package com.videotagger.service;

import java.math.BigDecimal;

/**
 * v0.32 趋势小卡 / 视频定格用的代表作行。
 *
 * <p>⚠️ **列顺序必须与 `MediaMapper.listTrendRefs` 的 SELECT 逐字一致**（record 按位映射，
 * 历史上因列顺序错位把字符串塞进 Long 过）。
 *
 * <p>刻意**不复用 `MediaSummary`**：那是媒体卡片墙的 record，加字段要同步改 4 条查询，风险外溢；
 * 这里自带一份，风险隔离。
 *
 * <p>`bgmScore` / `bgmVotes` 来自 `external_work.raw_json` 的 `JSON_EXTRACT`，**仅 MySQL 有值**；
 * ⚠️ Bangumi 的 JSON null 会被 CAST 成 **0（不是 NULL）**，所以「无评分」判定是 `bgmScore == null || bgmScore <= 0`。
 */
public record TrendRef(Long id, String title, Integer year, String mediaFormat, String coverPath,
                       String externalCoverUrl, String fallbackCoverPath, long episodeCount, long clipCount,
                       BigDecimal personalRating, BigDecimal bgmScore, Long bgmVotes) {
}
