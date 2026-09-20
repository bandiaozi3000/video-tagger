package com.videotagger.service;

/**
 * 清单导出行（候选/已选通用）：只要「序号 标题 年份 集数 标签」这类能直接念给别人的字段。
 *
 * 为什么不并进 {@link MediaSummary}：那个 record 是**按位映射**且被媒体墙的 4 条 SQL 共用，
 * 加字段要同步改 4 处列顺序（错配即静默错位）；而导出是一次性动作、上限 500 行，
 * 单独一条查询既零风险，也不会给媒体墙加上「每行三个标签 UNION 聚合」的开销。
 *
 * ⚠️ 本 record 仍然按位映射：字段顺序必须与 {@code MediaMapper.listExportRows} 的 SELECT 列顺序一致。
 */
public record MediaExportRow(Long id, String title, Integer year, String subcategory, String mediaFormat,
                             String source, Long episodeCount, Long clipCount, String tags) {
}
