package com.videotagger.metadata;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

/**
 * 「年 / 季 / 月 多选」→「最少的查询区间」——纯函数，好测。
 *
 * 设计规格 §4。规则：
 * ① **年**是限定符；**季/月**是可选的细分；
 * ② 选了细分 → 只查细分（年 × 季展开成 3 个月、年 × 月展开成 1 个月，两者取**并集**）；
 * ③ 没选细分 → 整年（12 个月）；
 * ④ 相邻月**合并**成一个区间；
 * ⑤ **超过 3 个月的区间按自然季度切开** —— 这是绕开 Bangumi `total` 1000 条上限的关键
 *    （实测：按年查 2024 全年 `total=1000`（撞顶），按季查 2024 春 = 255 条）。
 *
 * 为什么逐段查：实测**同一请求里多段 `air_date` 会 AND 成 0 条**，多选只能拆成多次请求。
 */
public final class SyncRangePlanner {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private SyncRangePlanner() {
    }

    /** 季 → 月份（与 {@code BangumiMetadataProvider.dateRange} 的划分保持一致）。 */
    private static List<Integer> seasonMonths(String season) {
        String normalized = season == null ? "" : season.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "WINTER" -> List.of(1, 2, 3);
            case "SPRING" -> List.of(4, 5, 6);
            case "SUMMER" -> List.of(7, 8, 9);
            case "FALL", "AUTUMN" -> List.of(10, 11, 12);
            default -> throw new IllegalArgumentException("季度无效: " + season);
        };
    }

    public static List<SyncRange> plan(List<Integer> years, List<String> seasons, List<Integer> months) {
        List<Integer> yearList = new ArrayList<>(new LinkedHashSet<>(
                years == null ? List.of() : years.stream().filter(y -> y != null).toList()));
        yearList.removeIf(y -> y < 1900 || y > 2200);
        yearList.sort(Integer::compareTo);
        if (yearList.isEmpty()) {
            throw new IllegalArgumentException("请至少选择一个有效年份（1900–2200）");
        }
        Set<Integer> monthPick = new TreeSet<>(months == null ? List.of() : months);
        monthPick.removeIf(m -> m < 1 || m > 12);
        List<String> seasonPick = new ArrayList<>(new LinkedHashSet<>(
                seasons == null ? List.of() : seasons.stream().filter(s -> s != null && !s.isBlank()).toList()));
        boolean hasDetail = !monthPick.isEmpty() || !seasonPick.isEmpty();

        TreeSet<YearMonth> picked = new TreeSet<>();
        for (Integer year : yearList) {
            if (!hasDetail) {
                for (int month = 1; month <= 12; month++) {
                    picked.add(YearMonth.of(year, month));
                }
                continue;
            }
            for (Integer month : monthPick) {
                picked.add(YearMonth.of(year, month));
            }
            for (String season : seasonPick) {
                for (Integer month : seasonMonths(season)) {
                    picked.add(YearMonth.of(year, month));
                }
            }
        }

        List<YearMonth[]> merged = mergeAdjacent(picked);
        List<YearMonth[]> chunks = new ArrayList<>();
        for (YearMonth[] span : merged) {
            splitByQuarter(span[0], span[1], chunks);
        }
        List<SyncRange> ranges = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            YearMonth start = chunks.get(i)[0];
            YearMonth end = chunks.get(i)[1];
            ranges.add(new SyncRange(i, start.atDay(1).format(DAY), end.plusMonths(1).atDay(1).format(DAY),
                    label(start, end)));
        }
        return ranges;
    }

    /** 相邻月合并：[start, endInclusive] 闭区间。 */
    private static List<YearMonth[]> mergeAdjacent(TreeSet<YearMonth> months) {
        List<YearMonth[]> spans = new ArrayList<>();
        YearMonth start = null;
        YearMonth previous = null;
        for (YearMonth month : months) {
            if (start == null) {
                start = month;
            } else if (!month.equals(previous.plusMonths(1))) {
                spans.add(new YearMonth[]{start, previous});
                start = month;
            }
            previous = month;
        }
        if (start != null) {
            spans.add(new YearMonth[]{start, previous});
        }
        return spans;
    }

    /** 跨季度就切开：一段最多 3 个月（否则按年查会撞 1000 条上限）。 */
    private static void splitByQuarter(YearMonth start, YearMonth end, List<YearMonth[]> out) {
        YearMonth cursor = start;
        while (!cursor.isAfter(end)) {
            YearMonth quarterEnd = YearMonth.of(cursor.getYear(), ((cursor.getMonthValue() - 1) / 3) * 3 + 3);
            YearMonth chunkEnd = quarterEnd.isAfter(end) ? end : quarterEnd;
            out.add(new YearMonth[]{cursor, chunkEnd});
            cursor = chunkEnd.plusMonths(1);
        }
    }

    private static String label(YearMonth start, YearMonth end) {
        String season = seasonName(start, end);
        if (season != null) {
            return start.getYear() + " " + season + "（" + start.getMonthValue() + "–" + end.getMonthValue() + "月）";
        }
        if (start.equals(end)) {
            return start.getYear() + " 年 " + start.getMonthValue() + " 月";
        }
        return start.getYear() + " 年 " + start.getMonthValue() + "–" + end.getMonthValue() + " 月";
    }

    /** 整季才有季节名（1–3 冬 / 4–6 春 / 7–9 夏 / 10–12 秋）。 */
    private static String seasonName(YearMonth start, YearMonth end) {
        if (start.getYear() != end.getYear()) {
            return null;
        }
        int months = (int) (java.time.temporal.ChronoUnit.MONTHS.between(start, end) + 1);
        if (months != 3) {
            return null;
        }
        return switch (start.getMonthValue()) {
            case 1 -> "冬";
            case 4 -> "春";
            case 7 -> "夏";
            case 10 -> "秋";
            default -> null;
        };
    }
}
