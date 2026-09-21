package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 导出清单「去重」的同系列归组（2026-09-21）。
 *
 * 用例数据取自真实库（实测 `external_relation` 里两组）：
 * ① 草莓棉花糖 6917(2005) --番外篇--> 6672 OVA 第1期(2007) / 6648 OVA 第2期(2007)
 * ② 现视研 7066(2004) --续集/前传--> 6799 现视研2(2007) / 6600 现视研 OVA(2006)
 */
class SeriesDedupeTest {

    private static MediaExportRow row(long id, String title, Integer year) {
        return new MediaExportRow(id, title, year, null, "VIDEO", null, 1L, 3L, null);
    }

    @Test
    void 本体保留_番外篇折到本体() {
        List<MediaExportRow> rows = List.of(
                row(6917, "草莓棉花糖", 2005),
                row(6648, "草莓棉花糖 OVA 2卷", 2007),
                row(6672, "草莓棉花糖 OVA 1卷", 2007));
        List<LinkedPair> pairs = List.of(
                new LinkedPair(6917, 6648, "番外篇"),
                new LinkedPair(6917, 6672, "番外篇"));

        Map<Long, Long> base = SeriesDedupe.baseOf(rows, pairs);

        assertEquals(6917L, base.get(6917L));
        assertEquals(6917L, base.get(6648L), "OVA 第2期应折到本体");
        assertEquals(6917L, base.get(6672L), "OVA 第1期应折到本体");
    }

    @Test
    void 续集前传成对出现_仍归一组_且取年份最早() {
        List<MediaExportRow> rows = List.of(
                row(7066, "现视研", 2004),
                row(6799, "现视研2", 2007),
                row(6600, "现视研 OVA", 2006));
        List<LinkedPair> pairs = List.of(
                new LinkedPair(7066, 6799, "续集"),
                new LinkedPair(6799, 6600, "前传"),
                new LinkedPair(6799, 7066, "前传"));

        Map<Long, Long> base = SeriesDedupe.baseOf(rows, pairs);

        assertEquals(7066L, base.get(6799L));
        assertEquals(7066L, base.get(6600L), "链式关系也要传导到同一本体");
    }

    @Test
    void 同年时取标题最短_再看id() {
        List<MediaExportRow> rows = List.of(
                row(1946, "超超超超超喜欢你的100个女朋友第三季", 2025),
                row(2200, "超超超超超喜欢你的100个女朋友第二季", 2025),
                row(2792, "超超超超超喜欢你的100个女朋友", 2022));
        List<LinkedPair> pairs = List.of(
                new LinkedPair(2792, 2200, "续集"),
                new LinkedPair(1946, 2200, "前传"));

        assertEquals(2792L, SeriesDedupe.baseOf(rows, pairs).get(2200L));
    }

    @Test
    void 无关联_或另一头不在清单里_不动() {
        List<MediaExportRow> rows = List.of(row(1, "孤独摇滚", 2022), row(2, "芙莉莲", 2023));
        Map<Long, Long> alone = SeriesDedupe.baseOf(rows, List.of());
        assertEquals(1L, alone.get(1L));
        assertEquals(2L, alone.get(2L));

        // 关系的另一端不在本次清单 → 不归组（否则会把清单外的本体当基准）
        Map<Long, Long> partial = SeriesDedupe.baseOf(List.of(row(6648, "草莓棉花糖 OVA 2卷", 2007)),
                List.of(new LinkedPair(6917, 6648, "番外篇")));
        assertEquals(6648L, partial.get(6648L));
    }
}
