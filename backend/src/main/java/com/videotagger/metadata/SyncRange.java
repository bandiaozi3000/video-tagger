package com.videotagger.metadata;

/**
 * 一段 Bangumi 查询区间（`air_date` 过滤用）。
 *
 * 设计规格：`docs/superpowers/specs/2026-09-21-bangumi-sync-simplify-design.md` §4/§5。
 *
 * @param index 顺序号（0 起，前端显示「第 x/y 段」）
 * @param from  含（`YYYY-MM-DD`）
 * @param to    不含（`YYYY-MM-DD`）
 * @param label 中文标签（`2024 春（4–6月）`）
 */
public record SyncRange(int index, String from, String to, String label) {
}
