package com.videotagger.metadata;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 年/季/月多选 → 查询区间（2026-09-21，设计规格 §4）。
 *
 * 关键约束来自真接口实测：`total` 硬上限 1000（按年查会撞顶、按季不会），
 * 且**同一请求多段 air_date 会 AND 成 0 条** → 所以必须切成多段逐段查。
 */
class SyncRangePlannerTest {

    private static String dump(List<SyncRange> ranges) {
        return ranges.stream().map(r -> r.from() + "~" + r.to()).reduce((a, b) -> a + " | " + b).orElse("");
    }

    @Test
    void 整年拆成四个季度() {
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of(), List.of());
        assertEquals(4, ranges.size(), "按年查会撞 1000 上限 → 必须按季拆");
        assertEquals("2024-01-01~2024-04-01 | 2024-04-01~2024-07-01 | 2024-07-01~2024-10-01 | 2024-10-01~2025-01-01",
                dump(ranges));
        assertEquals("2024 冬（1–3月）", ranges.get(0).label());
        assertEquals("2024 春（4–6月）", ranges.get(1).label());
        assertEquals("2024 秋（10–12月）", ranges.get(3).label());
    }

    @Test
    void 单选一季就是一段() {
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of("SPRING"), List.of());
        assertEquals(1, ranges.size());
        assertEquals("2024-04-01", ranges.get(0).from());
        assertEquals("2024-07-01", ranges.get(0).to());
        assertEquals(0, ranges.get(0).index());
    }

    @Test
    void 春加夏是两段而不是六个月的巨段() {
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of("SPRING", "SUMMER"), List.of());
        assertEquals(2, ranges.size());
        assertEquals("2024-04-01~2024-07-01 | 2024-07-01~2024-10-01", dump(ranges));
    }

    @Test
    void 选不连续的两个月就是两段() {
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of(), List.of(1, 4));
        assertEquals(2, ranges.size());
        assertEquals("2024-01-01~2024-02-01 | 2024-04-01~2024-05-01", dump(ranges));
        assertEquals("2024 年 1 月", ranges.get(0).label());
    }

    @Test
    void 季与月取并集() {
        // 春 = 4–6 月，加选 1 月 → {1,4,5,6} 月：1 月与春**不相邻** → 两段
        // （勘误：设计规格初稿把这里写成“1–3 月”，错了 —— 春是 4–6 月，不是 1–3 月）
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of("SPRING"), List.of(1));
        assertEquals(2, ranges.size());
        assertEquals("2024-01-01~2024-02-01 | 2024-04-01~2024-07-01", dump(ranges));
        assertEquals("2024 年 1 月", ranges.get(0).label());
        assertEquals("2024 春（4–6月）", ranges.get(1).label());
    }

    @Test
    void 同一季度内相邻月合并成一段() {
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of(), List.of(4, 5));
        assertEquals(1, ranges.size());
        assertEquals("2024-04-01~2024-06-01", dump(ranges));
        assertEquals("2024 年 4–5 月", ranges.get(0).label());
    }

    @Test
    void 跨季度边界的月份各成一段() {
        // 3 月（冬末）+ 4 月（春首）：相邻但跨季度 → 仍切两段（每段 ≤ 3 个月且季度对齐）
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024), List.of(), List.of(3, 4));
        assertEquals(2, ranges.size());
        assertEquals("2024-03-01~2024-04-01 | 2024-04-01~2024-05-01", dump(ranges));
    }

    @Test
    void 多年乘月份() {
        List<SyncRange> ranges = SyncRangePlanner.plan(List.of(2024, 2023), List.of(), List.of(10));
        assertEquals(2, ranges.size(), "年份排序后 2023 在前");
        assertEquals("2023-10-01~2023-11-01 | 2024-10-01~2024-11-01", dump(ranges));
        assertEquals(0, ranges.get(0).index());
        assertEquals(1, ranges.get(1).index(), "index 连续，前端显示第 x/y 段用");
    }

    @Test
    void 多年无细分_每年四段() {
        assertEquals(8, SyncRangePlanner.plan(List.of(2023, 2024), List.of(), List.of()).size());
    }

    @Test
    void 无年或非法季度要报错() {
        assertThrows(IllegalArgumentException.class, () -> SyncRangePlanner.plan(List.of(), List.of(), List.of()));
        assertThrows(IllegalArgumentException.class, () -> SyncRangePlanner.plan(null, null, null));
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> SyncRangePlanner.plan(List.of(2024), List.of("不存在的季"), List.of()));
        assertTrue(e.getMessage().contains("季度无效"));
    }

    @Test
    void 非法月与非法年被过滤_若全非法则报错() {
        // 月 0/13 被丢弃、年 1800 被丢弃 → 只剩 2024 整年
        assertEquals(4, SyncRangePlanner.plan(List.of(1800, 2024), List.of(), List.of(0, 13)).size());
        assertThrows(IllegalArgumentException.class, () -> SyncRangePlanner.plan(List.of(1800), List.of(), List.of()));
    }
}
