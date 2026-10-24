package com.videotagger.service;

import java.util.List;

/**
 * v0.32 媒体趋势统计（第一部分）：筛选命中的媒体按首播年份的计数结果。
 *
 * <p>一条线 = 一个筛选条件的命中集；`years` 是**横轴刻度**（所有线共用同一份 → 多线天然对齐），
 * `points` 与 `years` **等长等序**，缺失年已补 0（前端不做补 0 逻辑）。
 *
 * <p>`years` 的取值规则（规格 §3.2）：
 * <ul>
 *   <li>`year` 维度**无勾选** → 全库有效年份区间（2026-10-03 实测 1983–2026）</li>
 *   <li>`year` 维度**有勾选** → 勾选的年份集合（升序）</li>
 * </ul>
 */
public record StatsTrendResponse(List<Integer> years, long total, List<Point> points) {

    public record Point(Integer year, long count) {
    }
}
