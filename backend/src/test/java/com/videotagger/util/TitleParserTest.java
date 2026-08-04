package com.videotagger.util;

import com.videotagger.util.TitleParser.ParsedTitle;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TitleParserTest {

    @Test
    void bilibiliPageTitle() {
        ParsedTitle p = TitleParser.parse("葬送的芙莉莲 第3集_哔哩哔哩_bilibili");
        assertEquals("葬送的芙莉莲", p.mediaTitle());
        assertNull(p.season());
        assertEquals(3, p.episodeNo());
    }

    @Test
    void chineseSeasonAndEpisode() {
        ParsedTitle p = TitleParser.parse("芙莉莲 第二季 第1话");
        assertEquals("芙莉莲", p.mediaTitle());
        assertEquals(2, p.season());
        assertEquals(1, p.episodeNo());
    }

    @Test
    void sxxExxPattern() {
        ParsedTitle p = TitleParser.parse("Frieren S2E1");
        assertEquals("Frieren", p.mediaTitle());
        assertEquals(2, p.season());
        assertEquals(1, p.episodeNo());
    }

    @Test
    void seasonAndEpisodeEnglish() {
        ParsedTitle p = TitleParser.parse("葬送的芙莉莲 Season 2 Episode 5");
        assertEquals("葬送的芙莉莲", p.mediaTitle());
        assertEquals(2, p.season());
        assertEquals(5, p.episodeNo());
    }

    @Test
    void bracketPrefixCleaned() {
        ParsedTitle p = TitleParser.parse("【4月】葬送的芙莉莲 魔法考试篇 第1集");
        assertEquals("葬送的芙莉莲 魔法考试篇", p.mediaTitle());
        assertEquals(1, p.episodeNo());
    }

    @Test
    void youtubeSuffixStripped() {
        ParsedTitle p = TitleParser.parse("Sword Art Online Episode 3 | YouTube");
        assertEquals("Sword Art Online", p.mediaTitle());
        assertEquals(3, p.episodeNo());
    }

    @Test
    void bareEpNumber() {
        ParsedTitle p = TitleParser.parse("剑风传奇 第7话");
        assertEquals("剑风传奇", p.mediaTitle());
        assertEquals(7, p.episodeNo());
    }

    @Test
    void unparseableFallsBackToWholeTitle() {
        ParsedTitle p = TitleParser.parse("一部没有规律的标题文本");
        assertEquals("一部没有规律的标题文本", p.mediaTitle());
        assertNull(p.season());
        assertNull(p.episodeNo());
    }

    @Test
    void nullTitleGivesEmpty() {
        ParsedTitle p = TitleParser.parse(null);
        assertEquals("", p.mediaTitle());
        assertNull(p.episodeNo());
    }

    @Test
    void chineseNumbers() {
        assertEquals(10, TitleParser.cnToInt("十"));
        assertEquals(15, TitleParser.cnToInt("十五"));
        assertEquals(21, TitleParser.cnToInt("二十一"));
        assertEquals(2, TitleParser.cnToInt("二"));
    }

    @Test
    void subcategoryDetectedForSeriesMarks() {
        // 含集/季标记 → 子分类「番剧」
        assertEquals("番剧", TitleParser.parse("芙莉莲 第3集").subcategory());
        assertEquals("番剧", TitleParser.parse("芙莉莲 S2E1").subcategory());
        assertEquals("番剧", TitleParser.parse("芙莉莲 Season 2").subcategory());
    }

    @Test
    void subcategoryNullWithoutSeriesMarks() {
        // 无集/季标记（电影等单篇）→ 未分类
        assertNull(TitleParser.parse("你的名字。").subcategory());
    }
}
