package com.videotagger.service;

import com.videotagger.AbstractMySqlIT;
import com.videotagger.TestTagSeed;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Media;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * v0.32 第一部分（媒体趋势统计）的门禁。
 *
 * <p>为什么必须有这个测试：趋势查询是**新写的聚合 SQL**，但它**逐字复用**媒体页那批 filter 常量。
 * 复用是双刃的 —— 常量改了这里会跟着变（好事），但**新写的 GROUP BY 与排序/门槛**编译期看不出来，
 * 尤其 `JSON_EXTRACT` 的「JSON null 会被 CAST 成 0」这个坑（规格 §4.2）只有真 MySQL 能验。
 * 因此在真 MySQL 容器里跑（`AbstractMySqlIT`）。
 *
 * <p>隔离手段：探针媒体标题带唯一前缀 + 每条查询都带 `q=前缀`（同 `MediaFilterMultiIT` 的做法）。
 */
class StatsTrendIT extends AbstractMySqlIT {

    @Autowired
    StatsService statsService;
    @Autowired
    MediaService mediaService;
    @Autowired
    MediaMapper mediaMapper;
    @Autowired
    ExternalWorkMapper externalWorkMapper;
    @Autowired
    MediaTagMapper mediaTagMapper;
    @Autowired
    TagMapper tagMapper;

    private final String prefix = "趋势探针" + System.nanoTime();
    private long a;
    private long b;
    private long c;
    private long d;
    private long tagIsekai;   // 异世界
    private long tagScifi;    // 科幻

    /**
     * 探针数据（`q=前缀` 圈定）：
     * A 2020 异世界      奇幻          无评分
     * B 2021 异世界      奇幻+战斗     个人 8.0 / BGM 6.0（50 票，**故意低于门槛**）
     * C 2021 科幻        恋爱          个人无 / BGM 7.5（500 票）
     * D 2022 异世界+科幻 奇幻          个人无 / BGM 9.0（300 票）
     */
    @BeforeEach
    void seed() {
        tagIsekai = TestTagSeed.ensure(tagMapper, prefix + "异世界");
        tagScifi = TestTagSeed.ensure(tagMapper, prefix + "科幻");
        a = media("A", 2020, null);
        b = media("B", 2021, new BigDecimal("8.0"));
        c = media("C", 2021, null);
        d = media("D", 2022, null);
        work(a, "[\"奇幻\"]", "{\"rating\":{\"score\":null,\"total\":0}}");
        work(b, "[\"奇幻\",\"战斗\"]", "{\"rating\":{\"score\":6.0,\"total\":50}}");
        work(c, "[\"恋爱\"]", "{\"rating\":{\"score\":7.5,\"total\":500}}");
        work(d, "[\"奇幻\"]", "{\"rating\":{\"score\":9.0,\"total\":300}}");
        mediaTagMapper.insertIgnore(a, tagIsekai);
        mediaTagMapper.insertIgnore(b, tagIsekai);
        mediaTagMapper.insertIgnore(c, tagScifi);
        mediaTagMapper.insertIgnore(d, tagIsekai);
        mediaTagMapper.insertIgnore(d, tagScifi);
    }

    @Test
    void countsPerYearAndFillsMissingYears() {
        StatsTrendResponse r = trend(null, null, null, null);
        assertEquals(4, r.total(), "四部探针都要算上");
        assertEquals(1, countOf(r, 2020), "2020 只有 A");
        assertEquals(2, countOf(r, 2021), "2021 有 B、C");
        assertEquals(1, countOf(r, 2022), "2022 只有 D");
        assertEquals(r.years().size(), r.points().size(), "points 与 years 必须等长等序（前端不做补 0）");
        assertTrue(r.years().containsAll(List.of(2020, 2021, 2022)), "三段年份都要在横轴里");
    }

    @Test
    void yearFilterNarrowsTheAxis() {
        StatsTrendResponse r = trend(null, null, null, List.of(2021, 2022));
        assertEquals(List.of(2021, 2022), r.years(), "勾了年份 → 横轴就是勾选集合（升序）");
        assertEquals(2, countOf(r, 2021));
        assertEquals(1, countOf(r, 2022));
        assertEquals(3, r.total(), "勾了年份也影响命中集本身（与媒体页同口径）");
    }

    @Test
    void tagModeAndOrFollowTheMediaPage() {
        StatsTrendResponse or = trend(List.of(tagIsekai, tagScifi), "OR", null, null);
        assertEquals(4, or.total(), "OR = 命中任一标签（A、B 有异世界；C 有科幻；D 两个都有）");
        StatsTrendResponse and = trend(List.of(tagIsekai, tagScifi), "AND", null, null);
        assertEquals(1, and.total(), "AND = 两个标签都要有（只剩 D）");
        assertEquals(1, countOf(and, 2022));
    }

    @Test
    void genreAndUsesSameJsonContainsSemantics() {
        StatsTrendResponse and = trend(null, null, List.of("奇幻", "战斗"), null);
        assertEquals(1, and.total(), "题材 AND（JSON_CONTAINS + JSON_QUOTE）= 每个词都要有 → 只剩 B");
        assertEquals(1, countOf(and, 2021));
    }

    /** 口径合一：趋势的 total 必须等于 `/api/media` 的命中数（countFiltered 同一批条件）。 */
    @Test
    void totalMatchesMediaListCount() {
        long listed = mediaService.count(null, null, null, null, null, null, null,
                List.of(tagIsekai, tagScifi), "AND", null, null, false, prefix, null, null);
        assertEquals(1, listed, "countFiltered 同条件应命中 1 部（D）");
        assertEquals(listed, trend(List.of(tagIsekai, tagScifi), "AND", null, null).total(),
                "同一个筛选条件，趋势 total 与媒体页命中数必须一致");
    }

    @Test
    void refsBgmModeAppliesVoteThreshold() {
        List<TrendRef> refs = refs(2021, "bgm");
        assertEquals(1, refs.size(), "2021 里 B 只有 50 票（低于门槛）→ 只剩 C");
        assertEquals(c, refs.get(0).id());
        assertEquals(0, new BigDecimal("7.5").compareTo(refs.get(0).bgmScore()));
        assertEquals(500L, refs.get(0).bgmVotes());
    }

    @Test
    void refsPersonalModeIgnoresVoteThreshold() {
        List<TrendRef> refs = refs(2021, "personal");
        assertEquals(1, refs.size(), "2021 只有 B 有个人评分");
        assertEquals(b, refs.get(0).id());
        assertEquals(0, new BigDecimal("8.0").compareTo(refs.get(0).personalRating()));
    }

    @Test
    void refsMixedPrefersPersonalThenFallsBackToBgm() {
        List<TrendRef> refs = refs(2021, "mixed");
        assertEquals(List.of(b, c), refs.stream().map(TrendRef::id).toList(),
                "个人评分优先（B），未评分的按 BGM 回落（C）");
        List<TrendRef> all = refs(null, "mixed");
        assertEquals(b, all.get(0).id(), "全区间首位仍是有个人评分的那部");
        assertTrue(all.stream().anyMatch(x -> x.personalRating() == null && x.bgmScore() != null),
                "回落项也要带上 BGM 分（卡片要显示两套分）");
    }

    /** JSON null 的 `rating.score` 被 CAST 成 **0 而非 NULL** —— 这是规格 §4.2 记的坑，这里钉住。 */
    @Test
    void jsonNullScoreBecomesZeroNotMissing() {
        List<TrendRef> refs = refs(2020, "bgm");
        assertTrue(refs.isEmpty(), "A 的 score/json null：不能因为「有 raw_json」就被当成有评分");
    }

    private StatsTrendResponse trend(List<Long> tagIds, String tagMode, List<String> genres, List<Integer> year) {
        return statsService.trend(null, null, null, null, null, year, null, tagIds, tagMode,
                genres == null ? null : "AND", null, prefix, genres, null);
    }

    private List<TrendRef> refs(Integer year, String scoreSource) {
        return statsService.trendRefs(null, null, null, null, null, null, null, null, null, null,
                prefix, null, null, year, scoreSource, 5);
    }

    private long countOf(StatsTrendResponse r, int year) {
        return r.points().stream().filter(p -> p.year() == year).mapToLong(StatsTrendResponse.Point::count)
                .findFirst().orElseThrow(() -> new AssertionError("横轴里没有 " + year));
    }

    private long media(String suffix, Integer year, BigDecimal rating) {
        Media m = new Media();
        m.setTitle(prefix + suffix);
        m.setYear(year);
        m.setRating(rating);
        m.setStatus("DONE");
        m.setCreatedAt(System.currentTimeMillis());
        mediaMapper.insert(m);
        return m.getId();
    }

    private void work(long mediaId, String genresJson, String rawJson) {
        ExternalWork w = new ExternalWork();
        w.setProvider("BANGUMI");
        w.setExternalId(prefix + mediaId);
        w.setMediaId(mediaId);
        w.setGenresJson(genresJson);
        w.setRawJson(rawJson);
        w.setSyncState("OK");
        long now = System.currentTimeMillis();
        w.setCreatedAt(now);
        w.setUpdatedAt(now);
        externalWorkMapper.insert(w);
    }
}
